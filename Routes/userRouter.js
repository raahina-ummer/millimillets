const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController.js")
const profileController = require("../controllers/user/profileController.js")
const {userAuth,adminAuth}= require("../middleware/auth");

router.get("/pageNotFound",userController.pageNotFound)

//Signup Management
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup)
router.post("/verifyOtp",userController.verifyOtp)
router.post("/resendOtp",userController.resendOtp)
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect("/")
})

router.get("/login",userController.loadLogin)
router.post("/login",userController.login)

//homePage and Shopping page
router.get("/",userController.loadHomepage)
router.get("/logout",userController.logout)
router.get("/shop",userAuth,userController.loadShoppingPage);


//profile management
router.get("/forgotPassword",profileController.getForgotPassword);
router.post("/forgotEmailValid",profileController.forgotEmailValid)
router.get("/verifyForgotOtp",profileController.getVerifyOtp)
router.post("/verifyForgotOtp", profileController.verifyForgotOtp);

router.post("/resendOtp",profileController.resendOtp)
router.get("/resetPassword",profileController.getPostNewPassword)
router.post("/resetPassword",profileController.postNewPassword)









module.exports = router