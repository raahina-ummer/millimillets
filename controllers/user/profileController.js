
const User = require("../../models/userSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");


function generateOtp(){
    const digits = "1234567890";
    let otp ="";
    for(let i =0;i<4;i++){
        otp+=digits[Math.floor(Math.random()*10)]
    }
    return otp;
}

const sendVerificationEmail = async(email,otp)=>{
    try {
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        })

        //when user recive mail, how it should be
        const mailOptions ={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for password reset",
            text: `"Your OTP is ${otp}"`,
            html:`<b><h4>Your OTP is : ${otp}</h4></b>`,

        }

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:",info.messageId)
        return true;
        
    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}


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
                console.log("✅ Before redirecting to /verifyOtp");
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

    const { otp } = req.body;
    console.log(otp);
const timeDiff = (req.session.timer - new Date())
    if(timeDiff >60000){
         delete req.session.userOtp;
         delete req.session.timer
    return res.status(400).json({ success: false, message: "OTP has Expires. Please request for new one" })
    }
    if (String(req.session.userOtp) === String(otp)) {
      const user = req.session.userData
      const passwordHash = await securePassword(user.password);
      delete req.session.userOtp;

      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash
      })

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
  try {
    const { email } = req.session.userData;
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
        const email = req.session.email;
        if(password === confirmPassword){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                {email:email },
            {$set:{password:passwordHash}}
        )
        res.redirect("/login")
        }else{
            res.render("resetpassword",{message:"Password do not match"})
        }
    } catch (error) {
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