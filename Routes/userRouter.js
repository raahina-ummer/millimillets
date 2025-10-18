const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController.js")



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










module.exports = router