const User = require("../../models/userSchema.js");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt')

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
    const user = req.session.user
    if(user){
      const userData = await User.findOne({_d:user.id});
        res.render("home",{user:userData});
    }else{
    return res.render("home"); //rendering homepage
    }
  } catch (error) {
    console.log("Home Page not Found");
    res.status(500).send("Server error");
  }
};



const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Something went wrong!", error);
    res.status(500).send("Server Error");
  }
};

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP :${otp}</b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.log("Error sending email", error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cPassword } = req.body;

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
    req.session.userData = { name, phone, email, password };
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
    console.log(otp);
    if (otp === req.session.userOtp) {
      const user = req.session.userData
      const passwordHash = await securePassword(user.password);
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
    req.session.userOtp = otp;

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

    req.session.user = findUser._id;
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

module.exports = {
  loadHomepage,
  pageNotFound,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout
};
