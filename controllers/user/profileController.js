
const User = require("../../models/userSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");


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


module.exports = {
    getForgotPassword,
    forgotEmailValid,
    getVerifyOtp,
    verifyForgotOtp,
    resendOtp,
    getPostNewPassword,
    postNewPassword,

}