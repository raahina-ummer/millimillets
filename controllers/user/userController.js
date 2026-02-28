import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
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
import Wallet from "../../models/WalletSchema.js";

import { calculateFinalPrice, calculateBestOffer } from "../../Services/offerService.js";
import ReferralOffer from "../../models/referralSchema.js"
import logger from '../../utils/logger.js';

dotenv.config();

const pageNotFound = async (req, res) => {
  try {
    return res.render("p-404");
  } catch (error) {
    res.redirect("/pageNotFound");
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};


const loadHomepage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    let user = null;

    if (userId) {
      user = await User.findById(userId);
    }

    // Get best selling products

    const products = await Product.find({
      isBlocked: false,
      status: "Available"
    })
      .populate("category")
      .sort({ createdAt: -1 })
      .limit(3);

    const categories = await Category.find({ isListed: true })
      .sort({ name: 1 })
      .limit(3);

    const currentDate = new Date();

    let offerProductsRaw = await Product.find({
      isBlocked: false,
      status: "Available",
      "productOffer.offerActive": true,
      "productOffer.discountPercentage": { $gt: 0 },
      $or: [
        { "productOffer.offerEndDate": { $gte: currentDate } },
        { "productOffer.offerEndDate": null }
      ]
    })
      .populate('category')
      .sort({ 'productOffer.discountPercentage': -1 })
      .limit(4);

    // Fill remaining if less than 4
    if (offerProductsRaw.length < 4) {
      const additional = await Product.find({
        isBlocked: false,
        status: "Available",
        _id: { $nin: offerProductsRaw.map(p => p._id) }
      })
        .populate("category")
        .sort({ createdAt: -1 })
        .limit(4 - offerProductsRaw.length);

      offerProductsRaw.push(...additional);
    }

    const offerProducts = offerProductsRaw.map(product => {
      const finalPrice = calculateFinalPrice(product, product.category);
      const bestOffer = calculateBestOffer(product, product.category);

      const variant = product.variant?.[0];
      const basePrice =
        variant.salePrice && variant.salePrice < variant.regularPrice
          ? variant.salePrice
          : variant.regularPrice;

      return {
        ...product.toObject(),
        finalPrice,
        basePrice,
        discountPercentage: bestOffer?.discountPercentage || 0
      };
    });

    res.render("home", {
      user,
      products,
      categories,
      offerProducts
    });

  } catch (error) {
    console.error("Error loading homepage:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR
    });
  }
};


// const loadHomepage = async (req, res) => {
//   try {
//     const userId = req.session.user?.id;
//     let user = null;

//     if (userId) {
//       user = await User.findById(userId);
//     }

//     // Get best selling products 

//     const products = await Product.find({
//       isBlocked: false,
//       status: "Available"
//     })
//       .populate('category')
//       .sort({ createdAt: -1 })
//       .limit(3);


//     const categories = await Category.find({ isListed: true })
//       .sort({ name: 1 })
//       .limit(3);


//     const currentDate = new Date();
//     const offerProducts = await Product.find({
//       isBlocked: false,
//       status: "Available",
//       'productOffer.offerActive': true,
//       'productOffer.discountPercentage': { $gt: 0 },
//       $or: [
//         { 'productOffer.offerEndDate': { $gte: currentDate } },
//         { 'productOffer.offerEndDate': null }
//       ]
//     })
//       .populate('category')
//       .sort({ 'productOffer.discountPercentage': -1 }) 
//       .limit(4);

//     // If less than 4 offer products, fill with regular products
//     if (offerProducts.length < 4) {
//       const additionalProducts = await Product.find({
//         isBlocked: false,
//         status: "Available",
//         _id: { $nin: offerProducts.map(p => p._id) }
//       })
//         .populate('category')
//         .sort({ createdAt: -1 })
//         .limit(4 - offerProducts.length);

//       offerProducts.push(...additionalProducts);
//     }

//     res.render('home', {
//       user,
//       products,
//       categories,
//       offerProducts
//     });
//   } catch (error) {
//     console.error('Error loading homepage:', error);
//     return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.GENERAL.SERVER_ERROR });
//   }
// };

const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Something went wrong while signup!", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.GENERAL.SERVER_ERROR });
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
    const { name, phone, email, password, cPassword, referralcode } = req.body;

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit phone number",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (password !== cPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const existUser = await User.findOne({ email });
    if (existUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // referral validation
    if (referralcode) {
      const referUser = await User.findOne({ referralCode: referralcode });
      if (!referUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code",
        });
      }
    }

    const otp = generateOtp();
    console.log("otp", otp)
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.status(400).json({
        success: false,
        message: message.OTP.SEND_FAILED,
      });
    }

    const passwordHash = await securePassword(password);

    req.session.userOtp = otp;
    req.session.otpExpiry = Date.now() + 60 * 1000;
    req.session.userData = {
      name,
      phone,
      email,
      passwordHash,
      referralCode: referralcode || null,
    };
    req.session.email = email;

    return res.status(200).json({
      success: true,
      message: message.OTP.SENT,
      redirect: "/verifyOtp",
    });

  } catch (error) {
    console.error("Signup error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

const loadVerifyOtp = async (req, res) => {
  try {

    if (!req.session.email || !req.session.userOtp) {
      return res.redirect("/signup");
    }

    res.render("verifyOtp", {
      email: req.session.email,
      otpType: "SIGNUP_OTP",
    });
  } catch (error) {
    console.error("Load Verify OTP Error:", error);
    res.redirect("/pageNotFound");
  }
};
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.userOtp || !req.session.otpExpiry) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.OTP.EXPIRED,
      });
    }

    if (Date.now() > req.session.otpExpiry) {
      delete req.session.userOtp;
      delete req.session.otpExpiry;

      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.OTP.EXPIRED,
      });
    }

    if (String(otp) !== String(req.session.userOtp)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.OTP.INVALID,
      });
    }


    const sessionUser = req.session.userData;

    if (!sessionUser) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.OTP.EXPIRED,
      });
    }


    const newUserReferralCode = await generateUniqueReferralCode(sessionUser.name);

    const newUser = await User.create({
      name: sessionUser.name,
      email: sessionUser.email,
      phone: sessionUser.phone,
      password: sessionUser.passwordHash,
      referralCode: newUserReferralCode,
    });

    let wallet = await Wallet.findOne({ userId: newUser._id });

    if (!wallet) {
      wallet = await Wallet.create({
        userId: newUser._id,
        balance: 0,
        transactions: [],
      });
    }


    if (sessionUser.referralCode) {
      const referrer = await User.findOne({
        referralCode: sessionUser.referralCode,
      });

      if (referrer) {
        let referrerWallet = await Wallet.findOne({ userId: referrer._id });

        if (!referrerWallet) {
          referrerWallet = await Wallet.create({
            userId: referrer._id,
            balance: 0,
            transactions: [],
          });
        }

        const REFERRAL_REWARD_AMOUNT = 100;

        referrerWallet.balance += REFERRAL_REWARD_AMOUNT;
        referrerWallet.transactions.push({
          type: "credit",
          amount: REFERRAL_REWARD_AMOUNT,
          reason: "Referral Bonus",
          date: new Date(),
        });

        await referrerWallet.save();
      }
    }


    req.session.user = {
      id: newUser._id,
    };


    delete req.session.userOtp;
    delete req.session.otpExpiry;
    delete req.session.userData;

    return res.status(Status.OK).json({
      success: true,
      redirectUrl: "/",
    });

  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};



const resendOtp = async (req, res) => {
  try {
    const email = req.session.email;
    if (!email) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: message.OTP.SEND_FAILED });
    }
    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpExpiry = Date.now() + 60 * 1000;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP", otp);
      res.status(Status.OK).json({ success: true, message: message.OTP.SENT });
    } else {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.GENERAL.SERVER_ERROR,
      });


    }
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.GENERAL.SERVER_ERROR, });
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

    const findUser = await User.findOne({ email, isAdmin: false })


    if (!findUser) {
      return res.render("login", {
        message: message.AUTH.INVALID_CREDENTIALS
      });
    }

    if (findUser.isBlocked) {
      return res.render("login", {
        message: message.AUTH.ACCOUNT_BLOCKED
      });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", {
        message: message.AUTH.INVALID_CREDENTIALS
      });
    }

    req.session.user = { id: findUser._id, name: findUser.name };

    req.session.loginSuccess = true;

    res.redirect("/");

  } catch (error) {
    console.error("Login error", error);
    res.render("login", {
      message: "Login failed. Please try again later."
    });
  }
};



const logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.log("Logout error:", err);
      return res.redirect("/pageNotFound");
    }
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
};


const loadShop = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const userId = req.session?.user?.id || null;


    const { category, sort = "newest", search = "", minPrice, maxPrice } = req.query;

    const now = new Date();

    let sortStage = { createdAt: -1 };
    if (sort === "price-asc") sortStage = { finalPrice: 1 };
    if (sort === "price-desc") sortStage = { finalPrice: -1 };
    if (sort === "name-asc") sortStage = { productName: 1 };
    if (sort === "name-desc") sortStage = { productName: -1 };

    const matchStage = {
      isBlocked: false,
      status: "Available",
    };

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      matchStage.category = new mongoose.Types.ObjectId(category);
    }

    if (search.trim()) {
      matchStage.$or = [
        { productName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const productsAgg = await Product.aggregate([
      { $match: matchStage },

      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      { $match: { "category.isListed": true } },

      {
        $addFields: {
          firstVariant: { $arrayElemAt: ["$variant", 0] },
        },
      },

      /* ---------- VALID PRODUCT OFFER ---------- */
      {
        $addFields: {
          validProductOffer: {
            $cond: [
              {
                $and: [
                  "$productOffer.offerActive",
                  { $lte: ["$productOffer.offerStartDate", now] },
                  { $gte: ["$productOffer.offerEndDate", now] },
                ],
              },
              "$productOffer",
              null,
            ],
          },
        },
      },

      /* ---------- VALID CATEGORY OFFER ---------- */
      {
        $addFields: {
          validCategoryOffer: {
            $cond: [
              {
                $and: [
                  "$category.categoryOffer.offerActive",
                  { $lte: ["$category.categoryOffer.offerStartDate", now] },
                  { $gte: ["$category.categoryOffer.offerEndDate", now] },
                ],
              },
              "$category.categoryOffer",
              null,
            ],
          },
        },
      },

      /* ---------- PICK BEST OFFER ---------- */
      {
        $addFields: {
          appliedOffer: {
            $cond: [
              {
                $gte: [
                  { $ifNull: ["$validProductOffer.discountPercentage", 0] },
                  { $ifNull: ["$validCategoryOffer.discountPercentage", 0] },
                ],
              },
              "$validProductOffer",
              "$validCategoryOffer",
            ],
          },
        },
      },

      /* ---------- BASE PRICE (SALE > REGULAR) ---------- */
      {
        $addFields: {
          basePrice: {
            $cond: [
              {
                $and: [
                  { $gt: ["$firstVariant.salePrice", 0] },
                  { $lt: ["$firstVariant.salePrice", "$firstVariant.regularPrice"] },
                ],
              },
              "$firstVariant.salePrice",
              "$firstVariant.regularPrice",
            ],
          },
        },
      },

      /* ---------- DISCOUNT CALC WITH MAX CAP ---------- */
      {
        $addFields: {
          discountAmount: {
            $cond: [
              "$appliedOffer",
              {
                $min: [
                  {
                    $multiply: [
                      "$basePrice",
                      { $divide: ["$appliedOffer.discountPercentage", 100] },
                    ],
                  },
                  { $ifNull: ["$appliedOffer.maxDiscountAmount", 999999] },
                ],
              },
              0,
            ],
          },
        },
      },

      {
        $addFields: {
          finalPrice: {
            $round: [{ $subtract: ["$basePrice", "$discountAmount"] }, 0],
          },
          discountPercentage: {
            $ifNull: ["$appliedOffer.discountPercentage", 0],
          },
        },
      },

      /* ---------- PRICE FILTER ---------- */
      {
        $match: {
          ...(minPrice || maxPrice
            ? {
              finalPrice: {
                ...(minPrice && { $gte: Number(minPrice) }),
                ...(maxPrice && { $lte: Number(maxPrice) }),
              },
            }
            : {}),
        },
      },

      /* ---------- PAGINATION ---------- */
      {
        $facet: {
          products: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const products = productsAgg[0].products;
    const totalProducts = productsAgg[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalProducts / limit);

    const categoryGroups = await Product.aggregate([
      { $match: { isBlocked: false, status: "Available" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      { $match: { "category.isListed": true } },
      { $project: { _id: "$category._id", name: "$category.name", count: 1 } },
    ]);

    let cartCount = 0;
    if (userId) {
      const cart = await Cart.findOne({ userId });
      if (cart) cartCount = cart.products.length;
    }

    const priceRanges = [
      { min: 0, max: 500 },
      { min: 500, max: 1000 },
      { min: 1000, max: 2000 },
      { min: 2000, max: 5000 },
      { min: 5000, max: Infinity },
    ];

    res.render("shop", {
      products,
      totalProducts,
      totalPages,
      currentPage: page,
      categoryGroups,
      priceRanges,
      currentCategory: category || null,
      currentSort: sort,
      currentPriceRange: { min: minPrice || null, max: maxPrice || null },
      search,
      user: req.session.user || null,
      cartCount,

    });
  } catch (error) {
    console.error("Error loading shop:", error);
    res.redirect("/pageNotFound");
  }
};


const loadAboutPage = async (req, res) => {
  try {
    const user = req.session.user.id
    res.render("about", { user });
  } catch (error) {
    console.error("Error loading about page:", error);
    res.redirect("/pageNotFound");
  }
};


export {
  loadHomepage,
  pageNotFound,
  loadSignup,
  signup,
  loadVerifyOtp,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadShop,
  loadAboutPage
};
