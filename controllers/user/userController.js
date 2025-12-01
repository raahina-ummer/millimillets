import dotenv from "dotenv";
import bcrypt from "bcrypt";
import User from "../../models/userSchema.js";
import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import {
  sendVerificationEmail,
  generateOtp,
} from "../../Helpers/emailandaotpservices.js";
import { generateUniqueReferralCode } from "../../Helpers/userReferral.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import Cart from "../../models/CartSchema.js";
import Wallet from "../../models/WalletSchema.js"
import ReferralOffer from "../../models/referralSchema.js"

dotenv.config();

const pageNotFound = async (req, res) => {
  try {
    return res.render("p-404");
  } catch (error) {
    console.log("Homepage Not Found");
    res.redirect("/pageNotFound");
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.SERVER_ERROR });
  }
};

// Controller - Homepage (Updated for your schema)
const loadHomepage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    let user = null;
    
    if (userId) {
      user = await User.findById(userId);
    }

    // Get best selling products (top 4)
    // Since you don't have popularity field, use newest products
    const products = await Product.find({ 
      isBlocked: false,
      status: "Available"
    })
      .populate('category')
      .sort({ createdAt: -1 }) // Newest first
      .limit(4);

        if (products.length > 0) {
      console.log('First product:', products[0].productName);
      console.log('Image path stored:', products[0].productImage);
      console.log('First image:', products[0].productImage[0]);
    }

    // Get active categories (top 3)
    const categories = await Category.find({ isListed: true })
      .sort({ name: 1 })
      .limit(3);

    // Get products with active offers for Summer Offer section
    const currentDate = new Date();
    const offerProducts = await Product.find({ 
      isBlocked: false,
      status: "Available",
      'productOffer.offerActive': true,
      'productOffer.discountPercentage': { $gt: 0 },
      $or: [
        { 'productOffer.offerEndDate': { $gte: currentDate } },
        { 'productOffer.offerEndDate': null }
      ]
    })
      .populate('category')
      .sort({ 'productOffer.discountPercentage': -1 }) // Highest discount first
      .limit(4);

    // If less than 4 offer products, fill with regular products
    if (offerProducts.length < 4) {
      const additionalProducts = await Product.find({
        isBlocked: false,
        status: "Available",
        _id: { $nin: offerProducts.map(p => p._id) }
      })
        .populate('category')
        .sort({ createdAt: -1 })
        .limit(4 - offerProducts.length);
      
      offerProducts.push(...additionalProducts);
    }

    res.render('home', {
      user,
      products,
      categories,
      offerProducts
    });
  } catch (error) {
    console.error('Error loading homepage:', error);
    res.status(500).send('Server Error');
  }
};

const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Something went wrong while signup!", error);
    res.status(Status.INTERNAL_SERVER_ERROR).send("Server Error");
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log(error);
  }
};

const signup = async (req, res) => {
  try {
    console.log("Signup Invoked");

    const { name, phone, email, password, cPassword, referralcode } = req.body;

    if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }

    const existUser = await User.findOne({ email });
    if (existUser) {
      return res.render("signup", {
        message: "User with this email already exists",
      });
    }

    // Generate OTP + Send Email
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) return res.json("email-error");

    const passwordHash = await securePassword(password);

    // Store temporary user session
    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, passwordHash };
    req.session.email = email;
    req.session.timer = new Date();

    // Store Referral Code If Provided And Valid
    if (referralcode) {
      const referUser = await User.findOne({ referralCode: referralcode });

      if (!referUser) {
        return res.render("signup", {
          message: "Invalid Referral Code",
        });
      }

      req.session.userData.referralCode = referralcode;
    }

    console.log("OTP:", otp);
    res.render("verifyOtp", { otpType: "SIGNUP_OTP" });

  } catch (error) {
    console.error("Signup error:", error);
    res.redirect("/pageNotFound");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    console.log("Entered OTP:", otp);
    console.log("Session OTP:", req.session.userOtp);

    // OTP Expiration Check
    const timeDiff = new Date() - req.session.timer;
    if (timeDiff > 60000) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    if (String(otp) !== String(req.session.userOtp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // OTP matched -> Save user
    const sessionUser = req.session.userData;

    const newUser = new User({
      name: sessionUser.name,
      email: sessionUser.email,
      phone: sessionUser.phone,
      password: sessionUser.passwordHash,
    });

    await newUser.save();

    // Generate referral code AFTER user exists
    newUser.referralCode = await generateUniqueReferralCode(newUser.name);
    await newUser.save();

    // If Referral was used
    if (sessionUser.referralCode) {
      const referUser = await User.findOne({
        referralCode: sessionUser.referralCode,
      });

      if (referUser) {
        newUser.referredBy = referUser._id;
        referUser.redeemedUsers.push(newUser._id);

        await referUser.save();

        // Wallet Logic
        let referredUserWallet = await Wallet.findOne({ userId: referUser._id });
        if (!referredUserWallet) {
          referredUserWallet = new Wallet({
            userId: referUser._id,
            balance: 50,
            transactions: [{
              type: "credit",
              amount: 50,
              reason: "Referral Reward",
            }],
          });
        } else {
          referredUserWallet.balance += 50;
          referredUserWallet.transactions.push({
            type: "credit",
            amount: 50,
            reason: "Referral Reward",
          });
        }

        await referredUserWallet.save();

        // Create Wallet for new user
        const newUserWallet = new Wallet({
          userId: newUser._id,
          balance: 100,
          transactions: [{
            type: "credit",
            amount: 100,
            reason: "Signup Referral Bonus",
          }],
        });

        await newUserWallet.save();
      }
    }

    // Login Session
    req.session.user = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
    };

    // Clean OTP
    delete req.session.userOtp;

    return res.status(200).json({ success: true, redirectUrl: "/" });

  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Server error verifying OTP",
    });
  }
};


const resendOtp = async (req, res) => {
  try {
    const email = req.session.userData || req.session.email;
    if (!email) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.timer = new Date();

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP", otp);
      res
        .status(Status.OK)
        .json({ success: true, message: "OTP Resent Successfully" });
    } else {
      res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Failed to resend OTP. Please try again",
      });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal Server Error. Please try again",
    });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email });
    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by Admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect Password" });
    }

    req.session.user = { id: findUser._id };
    res.redirect("/");
  } catch (error) {
    console.error("Login error", error);
    res.render("login", { message: "Login failed. Please try again later" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((error) => {
      if (error) {
        console.log("Session destruction error", error.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/login");
    });
  } catch (error) {
    console.log("Logout error", error);
    res.redirect("/pageNotFound");
  }
};

const loadShop = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;
    const userId = req.session.user.id;

    // Get filters from query
    const categoryId = req.query.category;
    const sortOption = req.query.sort || "newest";
    const searchQuery = req.query.search || "";

    // Price range
    let minPrice = req.query.minPrice
      ? parseFloat(req.query.minPrice)
      : undefined;
    let maxPrice = req.query.maxPrice
      ? parseFloat(req.query.maxPrice)
      : undefined;

    // Build query
    let query = {
      isBlocked: false,
      status: { $ne: "out of stock" },
    };

    // Category filter
    if (categoryId) {
      query.category = categoryId;
    }

    // Search filter
    if (searchQuery.trim()) {
      query.$or = [
        { productName: { $regex: `^${searchQuery}`, $options: "i" } },
        { description: { $regex: `^${searchQuery}`, $options: "i" } },
      ];
    }

    // Fetch products with category population
    let products = await Product.find(query).populate({
      path: "category",
      match: { isListed: true },
    });

    // Filter out products with unlisted categories
    products = products.filter((product) => product.category !== null);

    // Price filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      products = products.filter((product) => {
        const variant = product.variant && product.variant[0];
        const price = variant ? variant.salePrice : 0;

        if (minPrice !== undefined && maxPrice !== undefined) {
          return price >= minPrice && price <= maxPrice;
        } else if (minPrice !== undefined) {
          return price >= minPrice;
        } else {
          return price <= maxPrice;
        }
      });
    }

    // Sorting
    switch (sortOption) {
      case "price-asc":
        products.sort((a, b) => {
          const priceA = a.variant?.[0]?.salePrice || 0;
          const priceB = b.variant?.[0]?.salePrice || 0;
          return priceA - priceB;
        });
        break;
      case "price-desc":
        products.sort((a, b) => {
          const priceA = a.variant?.[0]?.salePrice || 0;
          const priceB = b.variant?.[0]?.salePrice || 0;
          return priceB - priceA;
        });
        break;
      case "name-asc":
        products.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case "name-desc":
        products.sort((a, b) => b.productName.localeCompare(a.productName));
        break;
      case "newest":
      default:
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    // Get categories with counts
    const categoryGroups = await Product.aggregate([
      {
        $match: {
          isBlocked: false,
          status: { $ne: "out of stock" },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      {
        $unwind: "$categoryInfo",
      },
      {
        $match: {
          "categoryInfo.isListed": true,
        },
      },
      {
        $group: {
          _id: "$category",
          name: { $first: "$categoryInfo.name" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    let cart = await Cart({ userId });
    let cartCount;
    cart && console.log(cart);

    if (cart) {
      cartCount = cart.products.length;
    }

    // Price ranges
    const priceRanges = [
      { min: 0, max: 500 },
      { min: 500, max: 1000 },
      { min: 1000, max: 2000 },
      { min: 2000, max: 5000 },
      { min: 5000, max: Infinity },
    ];

    res.render("shop", {
      products: products.slice(skip, skip + limit),
      categoryGroups,
      priceRanges,
      currentCategory: categoryId || null,
      currentSort: sortOption,
      currentPriceRange: { min: minPrice, max: maxPrice },
      currentPage: page,
      search: searchQuery,
      user: req.session.user || null,
      cartCount: cartCount ?? 0,
    });
  } catch (error) {
    console.error("Error loading shop:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).send("Server Error");
  }
};

export {
  loadHomepage,
  pageNotFound,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadShop,
};
