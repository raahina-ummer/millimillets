const User = require("../../models/userSchema.js");
const env = require("dotenv").config();

const bcrypt = require('bcrypt');
const Product = require("../../models/ProductSchema.js");
const Category = require("../../models/CategorySchema");
const {sendVerificationEmail,generateOtp} = require("../../Helpers/emailandaotpservices.js")



const pageNotFound = async (req, res) => {
  try {
    return res.render("p-404");
  } catch (error) {
    console.log("Homepge Not Found");
    res.redirect("/pageNotFound");
    res.status(500).send("Server Error");
  }
};


const loadHomepage = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.length > 0 ? categories.map(cat => cat._id) : [];
    const productData = await Product.find({
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    }).sort({ createdAt: -1 }).limit(4);

    if (userId) {
      const userData = await User.findById(userId);
      return res.render("home", { user: userData, products: productData, categories });
    } else {
      return res.render("home", { user:null,products: productData, categories });
    }
  } catch (error) {
    console.log("Home Page not Found", error);
    res.status(500).send("Server error");
  }
};





const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Something went wrong while signup!", error);
    res.status(500).send("Server Error");
  }
};

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cPassword } = req.body;
    console.log(req.body)

    if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }

    const existUser = await User.findOne({ email });
    if (existUser) {
      return res.render("signup", {
        message: "User with this email already exists",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json("email-error");
    }
    req.session.userOtp = otp;
    console.log("otp is:", req.session.userOtp);
    const passwordHash = await securePassword(password)
    req.session.userData = { name, phone, email, passwordHash};
    req.session.email = email;
    req.session.timer = new Date ()
    res.render("verifyOtp");
    console.log("OTP sent", otp);
  } catch (error) {
    console.error("signup error", error);
    res.redirect("/pageNotFound");
  }
};


const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    return passwordHash;

  } catch (error) {

  }
}
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Entered OTP:", otp);
    console.log("Session OTP:", req.session.userOtp);
    let redirectUrl ="";
    if(req.session.userData)
    {
      redirectUrl = "/"
    }

    
    const timeDiff = (req.session.timer - new Date());
    if (timeDiff > 60000) {
      return res.status(400).json({ success: false, message: "OTP timer expired" });
    }

    if (String(otp) === String(req.session.userOtp)) {
      const email = req.session.email;

      if (!email) {
        return res.status(400).json({ success: false, message: "Session expired. Please try again." });
      }

      console.log(req.session.userData);

      if(req.session.userData){
        
        const saveUserData = new User({
        name: req.session.userData.name,
        email: req.session.userData.email,
        phone: req.session.userData.phone,
        password: req.session.userData.passwordHash
      });

      req.session.user = {
        id:saveUserData._id,
        name:req.session.userData.name,
        email:req.session.userData.email
      }

      await saveUserData.save();

      }

      // OTP verified successfully
      delete req.session.userOtp;
      console.log("hai hello")

      // redirect to reset password page
      return res.status(200).json({
        success: true,
        redirectUrl 
      });

    } else {
      return res.status(400).json({ success: false, message: "Invalid OTP, please try again backend" });
    }

  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({ success: false, message: "An error occurred while verifying OTP" });
  }
};



const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData || req.session.email;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" })
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.timer = new Date();

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP", otp);
      res.status(200).json({ success: true, message: "OTP Resend Sucessfuly" })
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again" })
    }

  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error. Please try again" })

  }
}


const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login")
    } else {
      res.redirect("/")
    }


  } catch (error) {

    res.redirect("/pageNotFound")

  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const findUser = await User.findOne({ isAdmin: 0, email: email })
    if (!findUser) {
      return res.render("login", { message: "User not found" })
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by Admin" })
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect Password" })
    }

    req.session.user = {
      id: findUser._id
    }
    res.redirect("/")

  } catch (error) {
    console.error("Login error", error)
    res.render("login", { message: "login failed. Please try again later" })

  }
}


const logout = async (req,res)=>{
  try {
    req.session.destroy((error)=>{
      if(error){
        console.log("Session destruction error",error.message);
        return res.redirect("/pageNotFound")
      }
      return res.redirect("/login")
    })
    
  } catch (error) {
    console.log("Logout error",error);
    res.redirect("/pageNotFound")
  }
}

const loadShoppingPage = async (req, res) => {
    try {
        const search = req.query.search || '';
        const currentCategory = req.query.category || null;
        const currentSort = req.query.sort || 'newest';
        const currentPage = parseInt(req.query.page) || 1;
        
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : undefined;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined;
        
        const currentPriceRange = {
            min: minPrice,
            max: maxPrice
        };
        
        // Define price ranges
        const priceRanges = [
            { min: 0, max: 500 },
            { min: 500, max: 1000 },
            { min: 1000, max: 2000 },
            { min: 2000, max: 5000 },
            { min: 5000, max: Infinity }
        ];
        
        // Get categories with counts
        const categoryGroups = await Category.aggregate([
            { $match: { isListed: true } },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: 'category',
                    as: 'products'
                }
            },
            {
                $project: {
                    name: 1,
                    count: { $size: '$products' }
                }
            }
        ]);
        
        // Build product query
        let productQuery = { isBlocked: false };
        
        if (search) {
            productQuery.productName = { $regex: search, $options: 'i' };
        }
        
        if (currentCategory) {
            productQuery.category = currentCategory;
        }

        const userData = await User.findById(req.session.user.id);
        
        if (minPrice !== undefined) {
            productQuery['variant.salePrice'] = { 
                $gte: minPrice,
                ...(maxPrice !== Infinity ? { $lte: maxPrice } : {})
            };
        }
        
        // Get products
        let products = await Product.find(productQuery)
            .populate('category')
            .lean();
        
        // Apply sorting
        if (currentSort === 'price-asc') {
            products.sort((a, b) => (a.variant[0]?.salePrice || 0) - (b.variant[0]?.salePrice || 0));
        } else if (currentSort === 'price-desc') {
            products.sort((a, b) => (b.variant[0]?.salePrice || 0) - (a.variant[0]?.salePrice || 0));
        } else if (currentSort === 'name-asc') {
            products.sort((a, b) => a.productName.localeCompare(b.productName));
        } else if (currentSort === 'name-desc') {
            products.sort((a, b) => b.productName.localeCompare(a.productName));
        } else if (currentSort === 'popularity') {
            // Add your popularity logic here
            products.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        } else {
            // Default: newest first
            products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        
         return res.render('shop', {
            products,
            categoryGroups,
            priceRanges,
            currentCategory,
            currentSort,
            currentPriceRange,
            search,
            currentPage,
            user:userData
        });
        
    } catch (error) {
        console.error('Shop page error:', error);
         return res.redirect('/pageError');
    }
};




const sample = async(req,res)=>{
  try {
    console.log("Hello Sample")
  } catch (error) {
    console.log(error)
  }
}



module.exports = {
  loadHomepage,
  pageNotFound,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadShoppingPage,
  sample,
};
