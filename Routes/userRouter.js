// userRouter.js  (ESM version)

import express from "express";
import passport from "../config/passport.js";
import * as userController from "../controllers/user/userController.js";
import * as profileController from "../controllers/user/profileController.js";
import * as productController from "../controllers/user/productController.js";
import * as orderController from "../controllers/user/orderController.js";
import * as cartController from "../controllers/user/cartController.js";
import * as checkoutController from "../controllers/user/checkoutController.js";
import * as wishlistController from "../controllers/user/wishlistController.js";
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
router.get("/auth/google/callback",passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    console.log(req.user)
    req.session.user = { id: req.user._id };
    res.redirect("/");
  }
);

// Login management
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);

// HomePage and Shopping page
router.get("/", userController.loadHomepage);
router.get("/logout", userController.logout);
router.get("/shop", userAuth, userController.loadShop);

// Profile management
router.get("/userProfile", userAuth, profileController.loadProfile);
router.get("/editProfile", userAuth, profileController.loadEditProfile);
router.post("/editProfile", userAuth, uploads.single("profileImage"), profileController.updateProfile);

router.get("/changePassword", userAuth, profileController.loadChangePassword);
router.post("/changePassword", userAuth, profileController.updateChangePassword);
router.get("/changeEmail", userAuth, profileController.loadUpdateEmail);
router.post("/changeEmail", userAuth, profileController.updateEmail);
router.get("/verifyEmailOtp",userAuth,profileController.loadChangeEmail);
router.post("/verifyEmailOtp",userAuth,profileController.changeEmailVerifyOtp);


router.get("/resendOtpEmail",userAuth,profileController.resendOtp);
router.post("/addPassword-google", userAuth, profileController.addPasswordForGoogle);
router.get("/address", userAuth, profileController.loadAddress);
router.get("/addAddress", userAuth, profileController.loadAddAddress);
router.post("/addAddress", userAuth, profileController.addAddress);
router.get("/editAddress/:id",userAuth,profileController.loadEditAddress);
router.patch("/editAddress/:id",userAuth,profileController.editAddress);
router.patch("/address/default/:id", userAuth, profileController.setDefaultAddress);
router.delete("/deleteAddress/:id",userAuth,profileController.deleteAddress);

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
router.put("/updateCart",userAuth,cartController.updateCartQuantity);
router.delete("/removeCart",userAuth,cartController.removeCartItem) //remove specific product
router.delete("/clearCart",userAuth,cartController.clearCart); //remove entire product and clear cart

//checkout
router.get("/checkOut",userAuth,checkoutController.loadCheckOut);
router.post("/placeOrder",userAuth,checkoutController.placeOrder);
router.get("/orderSuccess",userAuth,checkoutController.loadOrderSuccess);
router.get("/orderFailure",userAuth,checkoutController.loadOrderFaliure);


//Order management
router.get("/orders", userAuth, orderController.loadOrder);
router.get("/orders/:orderId", userAuth, orderController.loadOrderDetails);
router.patch("/orders/:orderId/cancel", userAuth, orderController.cancelEntireOrder);
router.post("/orders/:orderId/items/:productId/cancel", userAuth, orderController.cancelOrderItem);
router.post("/orders/:orderId/return", userAuth, orderController.returnOrderItem);
router.get("/orders/:orderId/invoice", userAuth, orderController.downloadInvoice);

//wishlist
router.get("/wishlist",userAuth,wishlistController.loadWishlist)
router.post("/addWishlist/:id",userAuth,wishlistController.addToWishList)
router.delete("/clearWishlist",userAuth,wishlistController.deleteWishlist);//entire wishlist
router.delete("/removeWishlist/:productId",userAuth,wishlistController.removeFromWishlist);//specific item


export { router};
