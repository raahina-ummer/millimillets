// userRouter.js  (ESM version)

import express from "express";
import passport from "../config/passport.js";
import * as userController from "../controllers/user/userController.js";
import * as profileController from "../controllers/user/profileController.js";
import * as productController from "../controllers/user/productController.js";
import * as cartController from "../controllers/user/cartController.js";
import { userAuth, adminAuth } from "../middleware/auth.js";

import multer from "multer";
import storage from "../Helpers/multer.js";


const router = express.Router();
const uploads = multer({ storage });


// Page not found
router.get("/pageNotFound", userController.pageNotFound);

// Signup Management
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verifyOtp", userController.verifyOtp);
router.post("/resendOtp", userController.resendOtp);

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    res.redirect("/");
  }
);

// Login management
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);

// HomePage and Shopping page
router.get("/", userController.loadHomepage);
router.get("/logout", userController.logout);
router.get("/shop", userAuth, userController.loadShoppingPage);

// Profile management
router.get("/userProfile", userAuth, profileController.loadProfile);
router.get("/editProfile", userAuth, profileController.loadEditProfile);
router.post("/editProfile", userAuth, uploads.single("profileImage"), profileController.updateProfile);

router.get("/changePassword", userAuth, profileController.loadChangePassword);
router.post("/changePassword", userAuth, profileController.updateChangePassword);
router.post("/addPassword-google", userAuth, profileController.addPasswordForGoogle);

router.get("/changeEmail", userAuth, profileController.loadUpdateEmail);
router.get("/changeEmail", userAuth, profileController.updateEmail);

router.get("/address", userAuth, profileController.loadAddress);
router.get("/addAddress", userAuth, profileController.loadAddAddress);
router.post("/addAddress", userAuth, profileController.addAddress);

// Forgot Password
router.get("/forgotPassword", profileController.getForgotPassword);
router.post("/forgotEmailValid", profileController.forgotEmailValid);
router.get("/verifyForgotOtp", profileController.getVerifyOtp);
router.post("/verifyForgotOtp", profileController.verifyForgotOtp);
router.post("/resendOtp", profileController.resendOtp);
router.get("/resetPassword", profileController.getPostNewPassword);
router.post("/resetPassword", profileController.postNewPassword);

// Product management
router.get("/productDetails", userAuth, productController.productDetails);

// Cart management
router.get("/cart", userAuth, cartController.loadCart);
router.post("/cart/:productId",userAuth,cartController.addToCart)
router.put("/upateCart",userAuth,cartController.updateCartQuantity);
router.delete("/removeCart",userAuth,cartController.deleteCartItem) //remove specific product
router.delete("/clearCart",userAuth,cartController.clearCart); //remove entire product and clear cart




export { router};
