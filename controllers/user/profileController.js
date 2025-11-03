
const User = require("../../models/userSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const Order = require("../../models/OrderSchema.js")
const Address = require("../../models/AddressSchema")
const {sendVerificationEmail,generateOtp} = require("../../Helpers/emailandaotpservices.js")
const uploads = require("../../Helpers/multer");


const securePassword = async(password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash;
    } catch (error) {
        
    }
}



const getForgotPassword = async(req,res)=>{
    try {
        res.render("forgotpassword")
    } catch (error) {
        res.redirect ("/pageNotFound")
    }
}


const forgotEmailValid = async (req, res) => {
    console.log("forgotEmailValid invocked")
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });

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
            res.render("forgotpassword", {
                message: "User with this email does not exist"
            });
        }

    } catch (error) {
        res.redirect("/pageNotFound");
    }
};


const getVerifyOtp = (req, res) => {
  try {
    res.render("verifyotp"); // this should match your verifyotp.ejs file name
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};



const verifyForgotOtp = async (req, res) => {
  try {
    console.log("hai this verify otp forget")
    const { otp } = req.body;
    console.log("Otp of",otp);
const timeDiff = (req.session.timer - new Date())
console.log("session  "+req.session.timer);
console.log(timeDiff)
    if(timeDiff >60000){
         delete req.session.userOtp;
         delete req.session.timer
    return res.status(400).json({ success: false, message: "OTP has Expires. Please request for new one" })
    }
    if (String(req.session.userOtp) === String(otp)) {
    
      delete req.session.userOtp;

      

      await saveUserData.save();
      req.session.user = saveUserData._id;
      res.json({ success: true, redirectUrl: "/login" })
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP,Please try again" })
    }
  } catch (error) {
    console.error("Error Verifying Otp", error)
    res.status(500).json({ success: false, message: "An error Occured" })
  }
}



const resendOtp = async (req, res) => {
  console.log("Resend OTP invocked");
  try {
    console.log("email",req.session.email);
    // const { email } = req.session.userData || req.session.email;

    const email = req.session?.userData?.email || req.session?.email;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" })
    }

    const otp = generateOtp();
    console.log("Resending OTP to email:",email)
    req.session.userOtp = otp;
    req.session.timer = new Date();

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP", otp);
      res.status(200).json({ success: true, message: " Resend OTP Sucessfuly" })
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again" })
    }

  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error. Please try again" })

  }
}



const getPostNewPassword = async (req, res) => {
  try {
    // Ensure session still has email (so user came from OTP page)
    if (!req.session.email) {
      return res.redirect("/forgotPassword");
    }
    res.render("resetpassword");
  } catch (error) {
    console.error("Error loading reset password page:", error);
    res.redirect("/pageNotFound");
  }
};


const postNewPassword = async(req,res)=>{
    try {
        console.log("postNewPassword invocked")
        const {password,confirmPassword} = req.body;
        console.log(password,confirmPassword)
        const email = req.session.email;
        if(password === confirmPassword){
            const passwordHash = await securePassword(password);
            await User.updateOne(
                {email:email },
            {$set:{password:passwordHash}}
        )
        res.json({success:true ,message:"success"});
        }else{
          console.log("haia")
            res.json({success:"false", message:"Password do not match"})
        }
    } catch (error) {
      console.log(error)
        res.redirect("/pageNotFound");
    }
}

const loadProfile = async(req, res) => {
  try {
    const userId =
      req.session?.userData?._id ||
      req.session?.userData?.id ||
      req.session?.user?._id ||
      req.session?.user?.id;


    console.log("Session user data:", req.session.user);


    if(!userId){
      return res.redirect("/login");
    }

    // Fetch user data
    const userData = await User.findById(userId)
      .select('-password -confirmPassword');

    if(!userData){
      return res.redirect("/login");
    }

    //fetch addresses
    const userAddresses = await Address.findOne({ userId: userId });
    const addresses = userAddresses?.address || []; // Get the address array
    
    // Get orders
    const orders = await Order.find({ userId: userId })
      .populate('orderedProducts.product')
      .sort({ createdOn: -1 })
      .limit(10);

    // Calculate counts
    const orderCount = orders.length;
    const wishlistCount = userData.wishlist?.length || 0;
    const addressCount = addresses.length;


    console.log("Route reached - Rendering profile page");

    res.render("userprofile", {
      user: userData,
      orders: orders,
      addresses: addresses, // Pass the address array
      orderCount: orderCount,
      wishlistCount: wishlistCount,
      addressCount: addressCount,
      walletTransactions: []
    });
 
  } catch (error) {
    console.error("Profile load error:", error);
    res.redirect("/pageNotFound");
  }
}


const loadEditProfile = async(req,res)=>{
  try {
      const userId = req.session?.user?.id;

      if (!userId) return res.redirect("/login");
   
    const user = await User.findById(userId)
    res.render("editProfile",{user})
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}


const loadChangePassword = async(req,res)=>{
  try{
    console.log(req.session,"LoadChangePassword")
    const userId = req.session?.user?.id;

const user = await User.findById(userId)

if(user.password){
  res.render("changepassword",{user})
}else{
  res.render("googlechangepassword",{user})
}

  }catch(error){
     res.status(500).json({ success: false, message: "Internal Server Error. Please try again" })
  }
}

const addPasswordForGoogle = async(req,res)=>{
  try {
    console.log(req.body)
    const {password,confirmPassword}=req.body;
    const userId = req.session?.user?.id;
    if(!userId){
      return res.render("login")
    }
    if(password !== confirmPassword){
      return res.status(400).json({success:false,message:"New Password and Confirm Password doesn't match"})
    }

    const hashedPassword = await securePassword(password);

    await User.findByIdAndUpdate(userId,{$set:{password:hashedPassword}});
    return res.status(200).json({success:true,message:"Password added Succesfully"});

  } catch (error) {
     res.status(500).json({ success: false, message: "Internal Server Error. Please try again" })
  }
}

const updateProfile = async (req, res) => {
  try {
    console.log(req.body, req.file);

    const { name, dob, phone } = req.body;
    const userId = req.session?.user?.id;

    const user = await User.findById(userId);

    user.fullName = name;
    user.dateOfBirth = dob;
    if (req.file) {
      user.profileImage = `uploads/images/${req.file.filename}`;
    }
    user.phone = phone;

  console.log("BODY:", req.body);
console.log("FILE:", req.file);


    await user.save();

    return res.status(200).json({
      success: true,
      message: "Updated Successfully",
      imagePath: user.profileImage,
    });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: error.message });
  }
};


const updateChangePAssword = async(req,res)=>{
  try {
    const {currentPassword,newPassword,confirmPassword} = req.body
    if(!currentPassword||!newPassword||!confirmPassword){
      return res.status(400).json({success:false,message:"All Fields are required"})
    }

    //check if newPasword matches confirmPassword
    if(newPassword !== confirmPassword){
       return res.status(400).json({success:false,message:"New password and confirm password do not match"
  })
    }

    const user = await User.findById(req.session.user.id)

    if(!user){
      return res.status(400).redirect("login")
    }
    
    //handle passwordless user
    if(!user.password){
      if(currentPassword){
       return  res.status(400).json({success:false,message:"You are logged in with google"})
      }
    }else{
      //verify current password for users with a pssword

      if(!currentPassword){
        return res.status(400).json({success:false,message:"current Password is required"})
      }
    }

    const isMatch = await bcrypt.compare(currentPassword,user.password)
    if(!isMatch){
      return res.status(400).json({success:false,message:"current Password is incorrect"})
    }


    const hashedPassword = await securePassword(currentPassword)

    await User.findByIdAndUpdate(req.session.user.id,{$set: {password:hashedPassword}})
    
    return res. status(200).json({success:true,message:"Password Updated Successfully"})
  } catch (error) {
    console.error(error.message)
    res.redirect("/pageNotFound")
  }
}


const loadUpdateEmail = async (req, res) => {
  try {
    if (!req.session.userData.email && !req.session.userOtp)
      return res.status(400).json({ success: false, message: "Email doesn't found in session" });

    if (!req.session?.otpVerified) {
      return res.redirect("/");
    }
    req.session.otpVerified = false;
    res.render("changeemail");
  } catch (error) {
    console.log(error.message);
    res.redirect("/pageNotFound");
  }
};

const updateEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!req.session.user) {
      return res.status(400).json({ success: false, message: "Unauthorized. Please log in." });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: "Please enter a valid email" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const existEmail = await User.findOne({ email });
    if (existEmail) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user.id, 
      { $set: { email } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("Updated user:", updatedUser);

    // Optionally refresh session
    req.session.user.email = updatedUser.email;

    delete req.session.userOtp;
    delete req.session.userData;

    return res.status(200).json({ success: true, message: "Email updated successfully" });
  } catch (error) {
    console.error("Update email error:", error.message);
    return res.redirect("pageNotFound");
  }
};

const loadAddress = async(req,res)=>{
  try {

    if(!req.session.user.id){
      return res.redirect("/login")
    }
    const user = await User.findById(req.session.user.id);
    const addresses = user.addresses || [];


   res.render("address", { 
      user, 
      addresses, 
      redirectpage: req.query.page 
    });
  } catch (error) {
    console.log(error.message)
     return res.redirect("pageNotFound");
  }
}


const loadAddAddress = async (req, res) => {
  try {
    if (!req.session.user.id) {
      return res.redirect("/login");
    }

    const user = await User.findById(req.session.user.id);
    res.render("addAddress", { user ,redirectpage:req.query.page});
  } catch (error) {
    console.log(error.message);
    return res.redirect("pageNotFound");
  }
};


const addAddress = async (req, res) => {
  try {
        console.log("Add Address API hit");  // check if request reaches backend
    console.log("BODY:", req.body);         // see data received
    console.log("SESSION:", req.session.user);
    if (!req.session.user.id) {
      return res.status(400).json({ success: false, message: "Please login first" });
    }

    const redirect = req.query.page;
    const {
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      pincode,
      country,
      addressType,
      isDefault,
    } = req.body;

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !phone ||
      !address ||
      !city ||
      !state ||
      !pincode ||
      !country ||
      !addressType
    ) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const user = await User.findById(req.session.user.id);
    let addressDocs = await Address.findOne({ userId: user._id });

    // Check if phone already exists in the same user's address list
    if (addressDocs && addressDocs.addresses.some(addr => addr.phone === phone)) {
      return res.status(400).json({
        success: false,
        message: "This phone number is already associated with one of your addresses.",
      });
    }

    const newAddress = {
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      pincode,
      country,
      addressType,
      isDefault: !!isDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save address
    if (addressDocs) {
      if (isDefault) {
        addressDocs.addresses.forEach(addr => (addr.isDefault = false));
      }
      addressDocs.addresses.push(newAddress);
      await addressDocs.save();
    } else {
      addressDocs = new Address({
        userId: user._id,
        addresses: [newAddress],
      });
      await addressDocs.save();
    }

    return res.status(200).json({
      success: true,
      message: "Address added successfully",
      redirect,
    });

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



module.exports = {
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
    updateChangePAssword,
    loadUpdateEmail,
    updateEmail,
    loadAddress,
    loadAddAddress,
    addAddress,


}