import User from "../../models/userSchema.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import session from "express-session";
import Order from "../../models/OrderSchema.js";
import Address from "../../models/AddressSchema.js";
import { sendVerificationEmail, generateOtp } from "../../Helpers/emailandaotpservices.js";
import uploads from "../../Helpers/multer.js";

dotenv.config();

//  Secure password hash helper
const securePassword = async (password) => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    console.error("Error securing password:", error.message);
  }
};

//  Forgot Password (Render Page)
 const getForgotPassword = async (req, res) => {
  try {
    res.render("forgotpassword");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

// Forgot Password (Email Validation + OTP)
 const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email });

    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);

      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;
        res.redirect("/verifyForgotOtp");
        console.log("OTP:", otp);
      } else {
        res.json({ success: false, message: "Failed to send OTP. Please try again!" });
      }
    } else {
      res.render("forgotpassword", { message: "User with this email does not exist" });
    }
  } catch (error) {
    console.error(error.message);
    res.redirect("/pageNotFound");
  }
};

//  Verify OTP Page
 const getVerifyOtp = (req, res) => {
  try {
    res.render("verifyotp");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

// Verify OTP Submission
 const verifyForgotOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const timeDiff = req.session.timer - new Date();

    if (timeDiff > 60000) {
      delete req.session.userOtp;
      delete req.session.timer;
      return res.status(400).json({ success: false, message: "OTP expired. Request a new one." });
    }

    if (String(req.session.userOtp) === String(otp)) {
      delete req.session.userOtp;
      res.json({ success: true, redirectUrl: "/login" });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP. Try again." });
    }
  } catch (error) {
    console.error("OTP Verification Error:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

//  Resend OTP
 const resendOtp = async (req, res) => {
  try {
    const email = req.session?.userData?.email || req.session?.email;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.timer = new Date();

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      res.status(200).json({ success: true, message: "OTP resent successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP" });
    }
  } catch (error) {
    console.error("Resend OTP Error:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

//  Reset Password (Render)
 const getPostNewPassword = async (req, res) => {
  try {
    if (!req.session.email) return res.redirect("/forgotPassword");
    res.render("resetpassword");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

// Reset Password (Submit)
 const postNewPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.email;

    if (password === confirmPassword) {
      const passwordHash = await securePassword(password);
      await User.updateOne({ email }, { $set: { password: passwordHash } });
      res.json({ success: true, message: "Password updated successfully" });
    } else {
      res.json({ success: false, message: "Passwords do not match" });
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//  Load User Profile
 const loadProfile = async (req, res) => {
  try {
    const userId =
      req.session?.userData?._id ||
      req.session?.userData?.id ||
      req.session?.user?._id ||
      req.session?.user?.id;

    if (!userId) return res.redirect("/login");

    const userData = await User.findById(userId).select("-password -confirmPassword");
    if (!userData) return res.redirect("/login");

    const userAddresses = await Address.findOne({ userId });
    const addresses = userAddresses?.address || [];
    const orders = await Order.find({ userId })
      .populate("orderedProducts.product")
      .sort({ createdOn: -1 })
      .limit(10);

    res.render("userprofile", {
      user: userData,
      orders,
      addresses,
      orderCount: orders.length,
      wishlistCount: userData.wishlist?.length || 0,
      addressCount: addresses.length,
      walletTransactions: [],
    });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//  Load Edit Profile
 const loadEditProfile = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId);
    res.render("editProfile", { user });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//  Load Change Password
const loadChangePassword = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const user = await User.findById(userId);
    if (user.password) {
      res.render("changepassword", { user });
    } else {
      res.render("googlechangepassword", { user });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Add Password for Google User
 const addPasswordForGoogle = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const userId = req.session?.user?.id;
    if (!userId) return res.render("login");

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords don't match" });
    }

    const hashedPassword = await securePassword(password);
    await User.findByIdAndUpdate(userId, { $set: { password: hashedPassword } });
    res.status(200).json({ success: true, message: "Password added successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

//  Update Profile
 const updateProfile = async (req, res) => {
  try {
    const { name, dob, phone } = req.body;
    const userId = req.session?.user?.id;
    const user = await User.findById(userId);

    user.fullName = name;
    user.dateOfBirth = dob;
    user.phone = phone;

    if (req.file) {
      user.profileImage = `uploads/images/${req.file.filename}`;
    }

    await user.save();
    res.status(200).json({ success: true, message: "Updated Successfully", imagePath: user.profileImage });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

//  Change Password (Existing Users)
const updateChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(400).json({ success: false, message: "All fields are required" });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ success: false, message: "Passwords do not match" });

    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(400).redirect("login");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Current password is incorrect" });

    const hashedPassword = await securePassword(newPassword);
    await User.findByIdAndUpdate(req.session.user.id, { $set: { password: hashedPassword } });

    res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//  Load Update Email
const loadUpdateEmail = async (req, res) => {
  try {
    if (!req.session?.userData?.email && !req.session?.userOtp)
      return res.status(400).json({ success: false, message: "Email not found in session" });

    if (!req.session?.otpVerified) return res.redirect("/");

    res.render("changeemail", { email: req.session.userData.email });
    req.session.otpVerified = false;
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//  Update Email
const updateEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!req.session.user.id) {
      return res.status(400).json({ success: false, message: "Unauthorized. Please log in." });
    }

    if (!email) return res.status(400).json({ success: false, message: "Please enter a valid email" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ success: false, message: "Invalid email format" });

    const existEmail = await User.findOne({ email });
    if (existEmail)
      return res.status(400).json({ success: false, message: "Email already exists" });

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user.id,
      { $set: { email } },
      { new: true }
    );

    req.session.user.email = updatedUser.email;
    delete req.session.userOtp;
    delete req.session.userData;

    res.status(200).json({ success: true, message: "Email updated successfully" });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//  Load Address Page
 const loadAddress = async (req, res) => {
  try {
    if (!req.session.user.id) return res.redirect("/login");
    const user = await User.findById(req.session.user.id);
    const addresses = user.addresses || [];
    res.render("address", { user, addresses, redirectpage: req.query.page });
  } catch (error) {
    res.redirect("pageNotFound");
  }
};

//  Load Add Address Page
 const loadAddAddress = async (req, res) => {
  try {
    if (!req.session.user.id) return res.redirect("/login");
    const user = await User.findById(req.session.user.id);
    res.render("addAddress", { user, redirectpage: req.query.page });
  } catch (error) {
    res.redirect("pageNotFound");
  }
};

//  Add Address (Submit)
 const addAddress = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Please login first." });

    const {
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      pinCode,
      country,
      addressType,
      isDefault,
    } = req.body;

    if (!firstName || !lastName || !phone || !address || !state || !pinCode || !country || !addressType)
      return res.status(400).json({ success: false, message: "All fields are required." });

    let userAddress = await Address.findOne({ userId });
    const newAddress = {
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      pinCode,
      country,
      addressType,
      isDefault: !!isDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (userAddress) {
      if (isDefault) userAddress.addresses.forEach((addr) => (addr.isDefault = false));
      userAddress.addresses.push(newAddress);
      await userAddress.save();
    } else {
      userAddress = new Address({ userId, addresses: [newAddress] });
      await userAddress.save();
    }

    res.status(200).json({ success: true, message: "Address added successfully!", redirect: "/userProfile" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
};




export  {
    getForgotPassword,
    forgotEmailValid,
    getVerifyOtp,
    verifyForgotOtp,
    resendOtp,
    getPostNewPassword,
    postNewPassword,
    loadProfile,
    loadEditProfile,
    loadChangePassword,
    addPasswordForGoogle,
    updateProfile,
    updateChangePassword,
    loadUpdateEmail,
    updateEmail,
    loadAddress,
    loadAddAddress,
    addAddress,

}