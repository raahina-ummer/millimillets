const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController.js");
const profileController = require("../controllers/user/profileController.js");
const {userAuth,adminAuth}= require("../middleware/auth");
const productController=require("../controllers/user/productController.js");
const multer= require('multer');
const storage= require('../Helpers/multer');
const uploads= multer({storage:storage});


router.get("/pageNotFound",userController.pageNotFound);

//Signup Management
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verifyOtp",userController.verifyOtp);
router.post("/resendOtp",userController.resendOtp);
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}));
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect("/")
});

router.get("/login",userController.loadLogin);
router.post("/login",userController.login);

//homePage and Shopping page
router.get("/",userController.loadHomepage);
router.get("/logout",userController.logout);
router.get("/shop",userAuth,userController.loadShoppingPage);


//profile management
router.get("/userProfile",userAuth,profileController.loadProfile);
router.get("/editProfile",userAuth,profileController.loadEditProfile);
router.post("/editProfile",userAuth,uploads.single("profileImage"),profileController.updateProfile);
router.get("/changePassword",userAuth,profileController.loadChangePassword);
router.post("/changePassword",userAuth,profileController.updateChangePAssword);
router.post("/addPassword-google",userAuth,profileController.addPasswordForGoogle);
router.get("/changeEmail",userAuth,profileController.loadUpdateEmail);
router.get("/changeEmail",userAuth,profileController.updateEmail);
router.get("/address",userAuth,profileController.loadAddress);
router.get("/addAddress",userAuth,profileController.loadAddAddress);
router.post("/addAddress",userAuth,profileController.addAddress)

router.get("/forgotPassword",profileController.getForgotPassword);
router.post("/forgotEmailValid",profileController.forgotEmailValid);
router.get("/verifyForgotOtp",profileController.getVerifyOtp);
router.post("/verifyForgotOtp", profileController.verifyForgotOtp);

router.post("/resendOtp",profileController.resendOtp);
router.get("/resetPassword",profileController.getPostNewPassword);
router.post("/resetPassword",profileController.postNewPassword);


// //product management
router.get("/productDetails",userAuth,productController.productDetails);








module.exports = router