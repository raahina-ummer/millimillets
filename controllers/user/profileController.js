import User from "../../models/userSchema.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import session from "express-session";
import Order from "../../models/OrderSchema.js";
import Address from "../../models/AddressSchema.js";
import { sendVerificationEmail, generateOtp } from "../../Helpers/emailandaotpservices.js";
import uploads from "../../Helpers/multer.js";
import { debugPort } from "process";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from '../../utils/logger.js';


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
    console.log("hai hel")
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
    console.log("hello from fromget email")

    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);

      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;
         console.log("OTP:", otp);
       return res.redirect("/verifyForgotOtp");
       
      } else {
      return res.render("forgotpassword", { 
        message: "User with this email does not exist",
        messageType: "error"
      });
      }
    } else {
  return res.render("forgotpassword", { 
    message: "User with this email does not exist",
    messageType: "error"
  });
}
    
  } catch (error) {
    console.error(error.message);
    res.Status(Status.INTERNAL_SERVER_ERROR).json({sucess:false,message:message.SERVER_ERROR})
  }
};

//  Verify OTP Page
 const getVerifyOtp = (req, res) => {
  try {
   return  res.render("verifyotp",{
    otpType: "FORGET_PASSWORD"
   });
  } catch (error) {
    res.Status(Status.INTERNAL_SERVER_ERROR).json({sucess:false,message:message.SERVER_ERROR})
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
      return res.status(Status.BAD_REQUEST).json({ success: false, message: message.OTP_EXPIRED });
    }

    if (String(req.session.userOtp) === String(otp)) {
      delete req.session.userOtp;
      res.json({ success: true, redirectUrl: "/resetPassword" });
    } else {
     return res.status(Status.BAD_REQUEST).json({ success: false, message: "Invalid OTP. Try again." });
    }
  } catch (error) {
    console.error("OTP Verification Error:", error.message);
   return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message:message.SERVER_ERROR});
  }
};


//  Resend OTP
const resendOtp = async (req, res) => {
  try {
    console.log("resendOtop invocked");
  const email = 
  req.session?.pendingEmail ||          
  req.session?.userData?.email ||      
  req.session?.email ||                
  req.session?.newEmail;               



    // Check if email exists
    if (!email || email === undefined || email === null) {
      console.log("No email found in session");
      console.log("Session data:", JSON.stringify(req.session, null, 2));
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Session expired. Please start the process again."});
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("Invalid email format:", email);
      return res.status(Status.BAD_REQUEST).json({success: false, message: "Invalid email format in session" });
    }

    // Generate new OTP
    const otp = generateOtp();
    console.log("Generated OTP:", otp);

    // Store OTP in session
    req.session.userOtp = otp;
    req.session.timer = new Date();

    console.log("About to send email to:", email);
    console.log("Email type:", typeof email);
    console.log("Email trimmed:", email.trim());

    // Send verification email - use trimmed email
    const emailSent = await sendVerificationEmail(email.trim(), otp);
    
    console.log("Email sent result:", emailSent);
    
    if (emailSent) {
      console.log(" OTP email sent successfully");
      return res.status(Status.Ok).json({ success: true, message: "OTP resent successfully" });
    } else {
      console.log("Failed to send OTP email");
      return res.status(Status.INTERNAL_SERVER_ERROR).json({success: false, message: "Failed to resend OTP. Please try again." });
    }
  } catch (error) {
    console.error(" Resend OTP Error:", error);
    console.error("Error stack:", error.stack);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error: " + error.message  });
  }
};
//  Reset Password (Render)
 const getPostNewPassword = async (req, res) => {
  try {
    if (!req.session.email) return res.redirect("/forgotPassword");
    return res.render("resetpassword");
  } catch (error) {
    res.Status(Status.INTERNAL_SERVER_ERROR).json({sucess:false,message:message.SERVER_ERROR})
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
      return res.json({ success: true, message: "Password updated successfully" });
    } else {
      return res.json({ success: false, message: "Passwords do not match" });
    }
  } catch (error) {
   res.Status(Status.INTERNAL_SERVER_ERROR).json({sucess:false,message:message.SERVER_ERROR})
  }
};

//  Load User Profile
 const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user.id
    
    if (!userId)
       return res.redirect("/login");

    const userData = await User.findById(userId).select("-password -confirmPassword");
    if (!userData)
       return res.redirect("/login");

    console.log(userData)

    const userAddresses = await Address.findOne({ userId });
    const addresses = userAddresses?.address || [];
    const orders = await Order.find({ userId })
      .populate("orderedProducts.product")
      .sort({ createdOn: -1 })
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
    res.Status(Status.INTERNAL_SERVER_ERROR).json({sucess:false,message:message.SERVER_ERROR})
  }
};

//  Load Edit Profile
 const loadEditProfile = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) 
      return res.redirect("/login");

    const user = await User.findById(userId);
    return res.render("editProfile", { user });
  } catch (error) {
    res.Status(Status.INTERNAL_SERVER_ERROR).json({sucess:false,message:message.SERVER_ERROR})
  }
};

//  Load Change Password
const loadChangePassword = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const user = await User.findById(userId);
    if (user.password) {
      return res.render("changepassword", { user });
    } else {
      return res.render("googlechangepassword", { user });
    }
  } catch (error) {
    res.Status(Status.INTERNAL_SERVER_ERROR).json({sucess:false,message:message.SERVER_ERROR})
  }
};

// Add Password for Google User
 const addPasswordForGoogle = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const userId = req.session?.user?.id;
    if (!userId) 
      return res.render("login");

    if (password !== confirmPassword) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Passwords don't match" });
    }

    const hashedPassword = await securePassword(password);
    await User.findByIdAndUpdate(userId, { $set: { password: hashedPassword } });
    return res.redirect("/userProfile");
  } catch (error) {
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
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
    console.log(user,userId,user.dateOfBirth,dob)
    return res.redirect("/userProfile")
  } catch (error) {
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};

//  Change Password (Existing Users)
const updateChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "All fields are required" });

    if (newPassword !== confirmPassword)
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Passwords do not match" });

    const user = await User.findById(req.session.user.id);
    if (!user)
       return res.status(Status.BAD_REQUEST).redirect("login");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
       return res.status(Status.BAD_REQUEST).json({ success: false, message: "Current password is incorrect" });

    const hashedPassword = await securePassword(newPassword);
    await User.findByIdAndUpdate(req.session.user.id, { $set: { password: hashedPassword } });

    return res.status(Status.OK).json({ success: true, message: "Password updated successfully" });
  } catch (error) {
   return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};

// Load Update Email Page
const loadUpdateEmail = async (req, res) => {
  try {
    console.log("loadUpdateEmail invoked", req.session);
    const email = req.session.user.email;
   return  res.render("changeemail", { user: req.session.user });
  } catch (error) {
    console.log(error);
   return  res.redirect("/pageNotFound");
  }
};

// Send OTP to new email
const updateEmail = async (req, res) => {
  try {
    console.log("Update Email invocked")
    const { email } = req.body;

    if (!email)
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Please enter a valid email" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Invalid email format" });

    const existEmail = await User.findOne({ email });
    if (existEmail)
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Email already exists" });

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
    return res.status(Status.OK).json({sucess:true,message: "OTP send Sucessfully!!"})
  } catch (error) {
    console.log(error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};


// Load Verify OTP Page (after sending OTP)
const loadChangeEmail = async (req, res) => {
  console.log("AAAAAAA")
  try {
    // Check if OTP and email are present in session
    if (!req.session.userOtp || !req.session.pendingEmail) {
      return res.redirect("/changeEmail");
    }

    // Render OTP page
   return res.render("verifyotp", {
      email: req.session.pendingEmail,
      otpType: "CHANGE_EMAIL"
    });
  } catch (error) {
    console.error("Error loading verify OTP page:", error);
   return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};




// Verify OTP and update email
const changeEmailVerifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Session OTP:", req.session.userOtp, "User entered:", otp);
  


    if (!otp)
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Please enter the OTP" });


    if (String(otp) !== String(req.session.userOtp))
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Invalid OTP" });

    const now = new Date();
    const diff = (now - new Date(req.session.timer)) / 1000 / 60;
    if (diff > 5)
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "OTP expired" });

    //  Update email in DB
    const updatedUser = await User.findByIdAndUpdate(
      req.session.user.id,
      { $set: { email: req.session.pendingEmail } },
      { new: true }

    );

    // Update session
    req.session.user.email = updatedUser.email;

    // Clear temporary data
    delete req.session.userOtp;
    delete req.session.pendingEmail;
    delete req.session.timer;

    return res.status(Status.OK).json({message: 'otp verified successfully',success: true});
  } catch (error) {
    console.log("Error verifying OTP:", error);
   return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
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
   return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};


//  Load Add Address Page
 const loadAddAddress = async (req, res) => {
  try {
    if (!req.session.user.id) return res.redirect("/login");
    const user = await User.findById(req.session.user.id);
    return res.render("addAddress", { user, redirectPage: req.query.page });
  } catch (error) {
    return res.redirect("pageNotFound");
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId)
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Please login first." });

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

    if (!firstName || !lastName || !phone || !address || !state || !pinCode || !country || !addressType)
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "All fields are required." });

    let userAddress = await Address.findOne({ userId });

    // Fix old addresses missing city
    if (userAddress && userAddress.addresses) {
      userAddress.addresses.forEach(addr => {
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
        userAddress.addresses.forEach(addr => (addr.isDefault = false));
      }
      userAddress.addresses.push(newAddress);
      await userAddress.save();
    } else {
      userAddress = new Address({
        userId,
        addresses: [newAddress],
      });

      console.log("New Address:", newAddress);
console.log("All addresses before save:", userAddress.addresses);
      await userAddress.save();
    }

    const redirectUrl = redirect === "checkout" ? "/checkout" : "/userProfile";
    return res.status(Status.OK).json({ success: true, message: "Address added successfully!", redirect: redirectUrl });

  } catch (error) {
    console.log("Error message:", error.message);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });

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
      { addresses: { $elemMatch: { _id: addressId } } }
    );

    if (!userAddress || !userAddress.addresses?.length) {
      console.log(" Address not found");
      return res.redirect("/address"); 
    }

    const user = await User.findById(userId);
    const address = userAddress.addresses[0];
    
     const redirectPage = req.query.redirect || "/address";
    return res.render("editAddress", { user, address,redirectPage });

  } catch (error) {
    console.error("Error loading edit address:", error.message);
    return res.redirect("/address");
  }
};



const editAddress = async (req, res) => {
  try {
    console.log("editAddress Invoked")
    console.log(req.body,"RequestBody")
    if (!req.session.user.id) {
     return  res.status(Status.BAD_REQUEST).send("Please login First");
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
    ) { return res.status(Status.BAD_REQUEST).json({success: false, message: "All fields are required" });
    }

    const user = await User.findById(req.session.user.id);

    const userId = req.session.user.id;
    const addressId = req.params.id;

    if (isDefault) {
      await Address.updateOne(
        { userId },
        { $set: { "addresses.$[].isDefault": false } }
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
      }
    );

    return res.status(Status.Ok).json({ success: true, message: "Address Updated successfully" });
  } catch (error) {
    console.log(error.message);
   return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const addressId = req.params.id;

    if (!userId) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Please login first." });
    }

    const userAddress = await Address.findOne({ userId });

    if (!userAddress || !userAddress.addresses || userAddress.addresses.length === 0) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "No addresses found." });
    }

    // Mark only the selected one as default
    userAddress.addresses.forEach((addr) => {
      addr.isDefault = addr._id.toString() === addressId;
    });

    await userAddress.save();

    return res.status(Status.OK).json({success: true, message: "Default address updated successfully." });

  } catch (error) {
    console.error("Error setting default address:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};



const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) {
     return  res.status(Status.BAD_REQUEST).send("Please login to delete an address");
    }

    const addressId = req.params.id;
    if (!addressId) {
      return res.status(Status.BAD_REQUEST).send("Invalid address ID");
    }

    // Find the address to check if it exists and is default
    const addressDoc = await Address.findOne(
      { userId, "addresses._id": addressId },
      { addresses: { $elemMatch: { _id: addressId } } }
    );

    if (!addressDoc || !addressDoc.addresses || addressDoc.addresses.length === 0) {
      res.status(Status.BAD_REQUEST).send("Address not found");
    }

    const isDefault = addressDoc.addresses[0].isDefault;

    // Delete the address
    const deleteResult = await Address.updateOne(
      { userId },
      { $pull: { addresses: { _id: addressId } } }
    );

    if (deleteResult.modifiedCount === 0) {
     return  res.status(Status.BAD_REQUEST).send("Failed to delete address");
    }

    // If it was default, set the first remaining address as default
    if (isDefault) {
      const updatedDoc = await Address.findOne({ userId });
      if (updatedDoc && updatedDoc.addresses && updatedDoc.addresses.length > 0) {
        await Address.updateOne(
          { userId, "addresses._id": updatedDoc.addresses[0]._id },
          { $set: { "addresses.$.isDefault": true } }
        );
      }
    }

    return res.status(Status.OK).json({ success: true, message: "Deleted Successfully" });

  } catch (error) {
    console.error("Error deleting address:", error.message);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
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
    changeEmailVerifyOtp,
    loadChangeEmail,
    loadEditAddress,
    editAddress,
    setDefaultAddress,
    deleteAddress,
    
    
}