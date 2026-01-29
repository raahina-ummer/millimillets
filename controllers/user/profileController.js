import User from "../../models/userSchema.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import session from "express-session";
import Order from "../../models/OrderSchema.js";
import Address from "../../models/AddressSchema.js";
import {
  sendVerificationEmail,
  generateOtp,
} from "../../Helpers/emailandaotpservices.js";
import uploads from "../../Helpers/multer.js";
import { debugPort } from "process";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from "../../utils/logger.js";

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
    console.log("hai hel");
    return res.render("forgotpassword");
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
};

// Forgot Password (Email Validation + OTP)
const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email });

    if (!findUser) {
      return res.render("forgotpassword", {
        message: message.AUTH.USER_NOT_FOUND,
        messageType: "error",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    console.log(otp,'otp')

    if (!emailSent) {
      return res.render("forgotpassword", {
        message: message.GENERAL.SERVER_ERROR,
        messageType: "error",
      });
    }

    req.session.userOtp = otp;
    req.session.email = email;
    req.session.timer = new Date();
    console.log("OTP:", otp);
    return res.redirect("/verifyForgotOtp");
  } catch (error) {
    console.error(error.message);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ sucess: false, message: message.GENERAL.SERVER_ERROR });
  }
};

//  Verify OTP Page
const getVerifyOtp = (req, res) => {
  try {
    return res.render("verifyotp", {
      otpType: "FORGET_PASSWORD",
    });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ sucess: false, message: message.GENERAL.SERVER_ERROR });
  }
};

// Verify OTP Submission
const verifyForgotOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.userOtp || !req.session.timer) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.OTP.EXPIRED,
      });
    }
    const now = new Date();
    const diff = now - new Date(req.session.timer);

    if (diff > 1 * 60 * 1000) {
      delete req.session.userOtp;
      delete req.session.timer;

      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.OTP.EXPIRED,
      });
    }

    if (String(req.session.userOtp) === String(otp)) {
      delete req.session.userOtp;
      res.json({ success: true, redirectUrl: "/resetPassword" });
    } else {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.OTP.INVALID });
    }
  } catch (error) {
    console.error("OTP Verification Error:", error.message);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

//  Resend OTP
const resendOtp = async (req, res) => {
  try {
    const email =
      req.session?.pendingEmail ||
      req.session?.userData?.email ||
      req.session?.email ||
      req.session?.newEmail;

    if (!email || email === undefined || email === null) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.AUTH.SESSION_EXPIRED });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.AUTH.EMAIL_INVALID });
    }

    const otp = generateOtp();
    console.log("Generated OTP:", otp);

    req.session.userOtp = otp;
    req.session.timer = new Date(); 
    

    const emailSent = await sendVerificationEmail(email.trim(), otp);

    if (!emailSent) {
      return res.status(Status.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: message.GENERAL.SERVER_ERROR,
      });
    }

     req.session.save(() => {
      return res.status(Status.OK).json({
        success: true,
        message: message.OTP.SENT,
      });
    });
  } catch (error) {
    console.error(" Resend OTP Error:", error);
    console.error("Error stack:", error.stack);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const getPostNewPassword = async (req, res) => {
  try {
    if (!req.session.email) {
      return res.redirect("/forgotPassword");
    }
    return res.render("resetpassword");
  } catch (error) {
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

// Reset Password
const postNewPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.email;

    if (!email) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.AUTH.SESSION_EXPIRED,
      });
    }
    if (!password || !confirmPassword) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.AUTH.PASSWORD_REQUIRED,
      });
    }

    if (password !== confirmPassword) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.OTP.PASSWORD_MISMATCH,
      });
    }

    const passwordHash = await securePassword(password);
    await User.updateOne({ email }, { $set: { password: passwordHash } });

    delete req.session.email;

    return res.status(Status.OK).json({
      success: true,
      message: message.OTP.PASSWORD_RESET_SUCCESS,
    });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ sucess: false, message: message.GENERAL.SERVER_ERROR });
  }
};

//  Load User Profile
const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;

    if (!userId) return res.redirect("/login");

    const userData = await User.findById(userId).select(
      "-password -confirmPassword",
    );
    if (!userData) return res.redirect("/login");

    console.log(userData);

    const userAddresses = await Address.findOne({ userId });
    const addresses = userAddresses?.addresses || [];

    const orders = await Order.find({ userId })
      .populate("orderedProducts.product")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.render("userprofile", {
      user: userData,
      orders,
      addresses,
      orderCount: orders.length,
      wishlistCount: userData.wishlist?.length || 0,
      addressCount: addresses.length,
      walletTransactions: [],
    });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ sucess: false, message: message.GENERAL.SERVER_ERROR });
  }
};

//  Load Edit Profile
const loadEditProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId);
    return res.render("editProfile", { user });
  } catch (error) {
    res
      .Status(Status.INTERNAL_SERVER_ERROR)
      .json({ sucess: false, message: message.GENERAL.SERVER_ERROR });
  }
};

//  Load Change Password
const loadChangePassword = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findById(userId);
    if (user.password && user.password.length > 0) {
      return res.render("changepassword", { user });
    } else {
      return res.render("googlechangepassword", { user });
    }
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ sucess: false, message: message.GENERAL.SERVER_ERROR });
  }
};

// Add Password for Google User
const addPasswordForGoogle = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const userId = req.session.user.id;
    if (!userId) return res.render("login");

    if (password !== confirmPassword) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.OTP.PASSWORD_MISMATCH });
    }

    const hashedPassword = await securePassword(password);
    await User.findByIdAndUpdate(userId, {
      $set: { password: hashedPassword },
    });
    return res.redirect("/userProfile");
  } catch (error) {
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal Server Error" });
  }
};

//  Update Profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.session.user.id;

    if (!userId) {
      return res.status(Status.UNAUTHORIZED).json({
        success: false,
        message: message.AUTH.USER_NOT_LOGGED_IN,
      });
    }

    if (!name || !name.trim()) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.NAME_REQUIRED,
      });
    }

    const nameRegex = /^(?=.*[a-zA-Z])[a-zA-Z\s\-'.]+$/;

    if (!nameRegex.test(name.trim())) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.NAME_INVALID,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(Status.NOT_FOUND).json({
        success: false,
        message: message.AUTH.USER_NOT_LOGGED_IN,
      });
    }

    user.name = name.trim();
    user.phone = phone;

    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;

      if (!phoneRegex.test(phone)) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: message.PHONE_INVALID,
        });
      }

      if (/^(\d)\1{9}$/.test(phone)) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: message.PHONE_ALL_SAME,
        });
      }
    }

    // Image handling
    if (req.file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];

      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: message.IMAGE_TYPE_INVALID,
        });
      }

      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: message.IMAGE_SIZE_EXCEEDED,
        });
      }

      user.profileImage = `uploads/images/${req.file.filename}`;
    }

    await user.save();

    return res
      .status(Status.OK)
      .json({ success: true, message: message.PROFILE_UPDATED_SUCCESS });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

//  Change Password (Existing Users)
const updateChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.GENERAL.INVALID_INPUT });

    if (newPassword !== confirmPassword)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.OTP.PASSWORD_MISMATCH });

    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(Status.BAD_REQUEST).redirect("login");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: "Current password is incorrect" });

    if (newPassword.length < 8) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.AUTH.PASSWORD_MIN_LENGTH,
      });
    }
    if (newPassword.length < 8) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.AUTH.PASSWORD_MIN_LENGTH,
      });
    }

    const hashedPassword = await securePassword(newPassword);
    await User.findByIdAndUpdate(req.session.user.id, {
      $set: { password: hashedPassword },
    });

    return res
      .status(Status.OK)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

// Load Update Email Page
const loadUpdateEmail = async (req, res) => {
  try {
    console.log("loadUpdateEmail invoked", req.session);
    const email = req.session.user.email;
    return res.render("changeemail", { user: req.session.user });
  } catch (error) {
    console.log(error);
    return res.redirect("/pageNotFound");
  }
};

// Send OTP to new email
const updateEmail = async (req, res) => {
  try {
    console.log("Update Email invocked");
    const { email } = req.body;

    if (!email)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: "Please enter a valid email" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: "Invalid email format" });

    const existEmail = await User.findOne({ email });
    if (existEmail)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: "Email already exists" });

    // Generate and send OTP
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json({ success: false, message: "Failed to send OTP" });
    }

    // Save OTP and new email in session
    req.session.userOtp = otp;
    req.session.pendingEmail = email;
    req.session.timer = new Date();

    console.log("OTP sent:", otp);
    return res
      .status(Status.OK)
      .json({ sucess: true, message: "OTP send Sucessfully!!" });
  } catch (error) {
    console.log(error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

// Load Verify OTP Page (after sending OTP)
const loadChangeEmail = async (req, res) => {
  console.log("AAAAAAA");
  try {
    // Check if OTP and email are present in session
    if (!req.session.userOtp || !req.session.pendingEmail) {
      return res.redirect("/changeEmail");
    }

    // Render OTP page
    return res.render("verifyotp", {
      email: req.session.pendingEmail,
      otpType: "CHANGE_EMAIL",
    });
  } catch (error) {
    console.error("Error loading verify OTP page:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

// Verify OTP and update email
const changeEmailVerifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.OTP.INVALID });

    if (String(otp) !== String(req.session.userOtp))
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.OTP.INVALID });

    const now = new Date();
    const diff = (now - new Date(req.session.timer)) / 1000 / 60;
    if (diff > 5)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.OTP.EXPIRED });

    //  Update email in DB
    const updatedUser = await User.findByIdAndUpdate(
      req.session.user.id,
      { $set: { email: req.session.pendingEmail } },
      { new: true },
    );

    // Update session
    req.session.user.email = updatedUser.email;

    // Clear temporary data
    delete req.session.userOtp;
    delete req.session.pendingEmail;
    delete req.session.timer;

    return res
      .status(Status.OK)
      .json({ success: true, message: message.OTP.SENT });
  } catch (error) {
    console.log("Error verifying OTP:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

//  Load Address Page
const loadAddress = async (req, res) => {
  try {
    if (!req.session.user.id) return res.redirect("/login");

    const userId = req.session.user.id;

    const user = await User.findById(userId);
    const userAddress = await Address.findOne({ userId });

    const addresses = userAddress?.addresses || [];

    // Pagination setup
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginatedAddresses = addresses.slice(startIndex, endIndex);

    const totalPages = Math.ceil(addresses.length / limit);

    return res.render("address", {
      user,
      addresses: paginatedAddresses,
      currentPage: page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const loadAddAddress = async (req, res) => {
  try {
    if (!req.session.user?.id) return res.redirect("/login");

    const user = await User.findById(req.session.user.id);

    return res.render("addAddress", {
      user,
      redirect: req.query.redirect || "profile",
    });
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.AUTH.USER_NOT_LOGGED_IN });

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
      redirect,
    } = req.body;

    const isDefaultFlag = req.body.isDefault === "on";

    if (
      !firstName ||
      !lastName ||
      !phone ||
      !address ||
      !state ||
      !pinCode ||
      !country ||
      !addressType
    )
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.GENERAL.INVALID_INPUT });

    let userAddress = await Address.findOne({ userId });

    // Fix old addresses missing city
    if (userAddress && userAddress.addresses) {
      userAddress.addresses.forEach((addr) => {
        if (!addr.city) addr.city = "Unknown";
      });
    }

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
      isDefault: isDefaultFlag,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (userAddress) {
      if (isDefaultFlag) {
        userAddress.addresses.forEach((addr) => (addr.isDefault = false));
      }
      userAddress.addresses.push(newAddress);
      await userAddress.save();
    } else {
      userAddress = new Address({
        userId,
        addresses: [newAddress],
      });

      await userAddress.save();
    }

    const redirectUrl = redirect === "checkout" ? "/checkout" : "/userProfile";

    return res.redirect(redirectUrl);
  } catch (error) {
    console.log("Error message:", error.message);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const loadEditAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) return res.redirect("/login");

    const addressId = req.params.id;
    if (!addressId) return res.redirect("/address");

    const userAddress = await Address.findOne(
      { userId, "addresses._id": addressId },
      { addresses: { $elemMatch: { _id: addressId } } },
    );

    if (!userAddress || !userAddress.addresses?.length) {
      console.log(" Address not found");
      return res.redirect("/address");
    }

    const user = await User.findById(userId);
    const address = userAddress.addresses[0];

    const redirectPage = req.query.redirect || "/address";
    return res.render("editAddress", { user, address, redirectPage });
  } catch (error) {
    console.error("Error loading edit address:", error.message);
    return res.redirect("/address");
  }
};

const editAddress = async (req, res) => {
  try {
    if (!req.session.user.id) {
      return res.status(Status.BAD_REQUEST).send("Please login First");
    }

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

    if (
      !firstName ||
      !lastName ||
      !phone ||
      !address ||
      !city ||
      !state ||
      !pinCode ||
      !country ||
      !addressType
    ) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.GENERAL.INVALID_INPUT });
    }

    const user = await User.findById(req.session.user.id);

    const userId = req.session.user.id;
    const addressId = req.params.id;

    if (isDefault) {
      await Address.updateOne(
        { userId },
        { $set: { "addresses.$[].isDefault": false } },
      );
    }

    const updatedAddress = await Address.updateOne(
      { userId, "addresses._id": addressId },
      {
        $set: {
          "addresses.$.firstName": firstName,
          "addresses.$.lastName": lastName,
          "addresses.$.phone": phone,
          "addresses.$.address": address,
          "addresses.$.state": state,
          "addresses.$.pinCode": pinCode,
          "addresses.$.city": city,
          "addresses.$.country": country,
          "addresses.$.addressType": addressType,
          "addresses.$.isDefault": !!isDefault,
          "addresses.$.updatedAt": new Date(),
        },
      },
    );

    return res
      .status(Status.OK)
      .json({ success: true, message: message.ADDRESS.UPDATED });
  } catch (error) {
    console.log(error.message);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const addressId = req.params.id;

    if (!userId) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.AUTH.USER_NOT_LOGGED_IN });
    }

    const userAddress = await Address.findOne({ userId });

    if (
      !userAddress ||
      !userAddress.addresses ||
      userAddress.addresses.length === 0
    ) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.ADDRESS.NOT_FOUND });
    }

    // Mark only the selected one as default
    userAddress.addresses.forEach((addr) => {
      addr.isDefault = addr._id.toString() === addressId;
    });

    await userAddress.save();

    return res.status(Status.OK).json({
      success: true,
      message: message.ADDRESS.UPDATED,
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.AUTH.USER_NOT_LOGGED_IN });
    }

    const addressId = req.params.id;
    if (!addressId) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.GENERAL.INVALID_INPUT });
    }

    // Find the address to check if it exists and is default
    const addressDoc = await Address.findOne(
      { userId, "addresses._id": addressId },
      { addresses: { $elemMatch: { _id: addressId } } },
    );

    if (
      !addressDoc ||
      !addressDoc.addresses ||
      addressDoc.addresses.length === 0
    ) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.ADDRESS.NOT_FOUND });
    }

    const isDefault = addressDoc.addresses[0].isDefault;

    // Delete the address
    const deleteResult = await Address.updateOne(
      { userId },
      { $pull: { addresses: { _id: addressId } } },
    );

    if (deleteResult.modifiedCount === 0) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.ADDRESS.DELETE_FAILED });
    }

    // If it was default, set the first remaining address as default
    if (isDefault) {
      const updatedDoc = await Address.findOne({ userId });
      if (
        updatedDoc &&
        updatedDoc.addresses &&
        updatedDoc.addresses.length > 0
      ) {
        await Address.updateOne(
          { userId, "addresses._id": updatedDoc.addresses[0]._id },
          { $set: { "addresses.$.isDefault": true } },
        );
      }
    }

    return res
      .status(Status.OK)
      .json({ success: true, message: message.ADDRESS.DELETED_SUCCESS });
  } catch (error) {
    console.error("Error deleting address:", error.message);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export {
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
  changeEmailVerifyOtp,
  loadChangeEmail,
  loadEditAddress,
  editAddress,
  setDefaultAddress,
  deleteAddress,
};
