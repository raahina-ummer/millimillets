
import express from "express";
import passport from "../config/passport.js";
import * as userController from "../controllers/user/userController.js";
import * as profileController from "../controllers/user/profileController.js";
import * as productController from "../controllers/user/productController.js";
import * as orderController from "../controllers/user/orderController.js";
import * as cartController from "../controllers/user/cartController.js";
import * as checkoutController from "../controllers/user/checkoutController.js";
import * as wishlistController from "../controllers/user/wishlistController.js";
import * as walletController from "../controllers/user/walletController.js";
import * as couponController from "../controllers/user/couponController.js";
import { userAuth, adminAuth } from "../middleware/auth.js";
import { otpLimiter } from "../controllers/user/userController.js";


import multer from "multer";
import storage from "../Helpers/multer.js";


const router = express.Router();
const uploads = multer({ storage });


// Page not found
router.get("/pageNotFound", userController.pageNotFound);

// Signup Management
router.get("/signup", userController.loadSignup);
router.post("/signup", otpLimiter, userController.signup);
router.get("/verifyOtp", otpLimiter, userController.loadVerifyOtp);
router.post("/verifyOtp", otpLimiter, userController.verifyOtp);
router.post("/resendSignupOtp", otpLimiter, userController.resendOtp);

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/signup" }),
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
router.get("/shop", userController.loadShop);

// Profile management
router.get("/userProfile", userAuth, profileController.loadProfile);
router.get("/editProfile", userAuth, profileController.loadEditProfile);
router.post("/editProfile", userAuth, uploads.single("profileImage"), profileController.updateProfile);

router.get("/changePassword", userAuth, profileController.loadChangePassword);
router.post("/changePassword", userAuth, profileController.updateChangePassword);
router.get("/changeEmail", userAuth, profileController.loadUpdateEmail);
router.post("/changeEmail", userAuth, profileController.updateEmail);
router.get("/verifyEmailOtp", userAuth, profileController.loadChangeEmail);
router.post("/verifyEmailOtp", userAuth, profileController.changeEmailVerifyOtp);


router.get("/resendOtpEmail", userAuth, profileController.resendOtp);
router.post("/addPassword-google", userAuth, profileController.addPasswordForGoogle);
router.get("/address", userAuth, profileController.loadAddress);
router.get("/addAddress", userAuth, profileController.loadAddAddress);
router.post("/addAddress", userAuth, profileController.addAddress);
router.get("/editAddress/:id", userAuth, profileController.loadEditAddress);
router.patch("/editAddress/:id", userAuth, profileController.editAddress);
router.patch("/address/default/:id", userAuth, profileController.setDefaultAddress);
router.delete("/deleteAddress/:id", userAuth, profileController.deleteAddress);

// Forgot Password
router.get("/forgotPassword", profileController.getForgotPassword);
router.post("/forgotEmailValid", otpLimiter, profileController.forgotEmailValid);
router.get("/verifyForgotOtp", otpLimiter, profileController.getVerifyOtp);
router.post("/verifyForgotOtp", profileController.verifyForgotOtp);
router.post("/resendForgotOtp", otpLimiter, profileController.resendOtp);
router.get("/resetPassword", profileController.getPostNewPassword);
router.post("/resetPassword", profileController.postNewPassword);

// Product management
router.get("/product/details/:id", userAuth, productController.productDetails);
router.get("/product/variant-price/:productId/:variantId", userAuth, productController.getVariantPrice);

// Cart management
router.get("/cart", userAuth, cartController.loadCart);
router.post("/cart/:productId", userAuth, cartController.addToCart)
router.put("/updateCart", userAuth, cartController.updateCartQuantity);
router.delete("/removeCart", userAuth, cartController.removeCartItem) //remove specific product
router.delete("/clearCart", userAuth, cartController.clearCart); //remove entire product and clear cart
router.get("/cartCount", userAuth, cartController.getCartCount)

//checkout
router.get("/checkOut", userAuth, checkoutController.loadCheckOut);
router.get("/orderSuccess", userAuth, checkoutController.loadOrderSuccess);
router.get("/orderFailure", userAuth, checkoutController.loadOrderFailure);


//Order management
router.get("/orders", userAuth, orderController.loadOrder);
router.get("/orders/:orderId", userAuth, orderController.loadOrderDetails);
router.patch("/orders/:orderId/cancel", userAuth, orderController.cancelEntireOrder);
router.post("/orders/:orderId/items/:productId/:variantId/cancel", userAuth, orderController.cancelOrderItem);
router.post("/orders/:orderId/return/:productId/:variantId", userAuth, orderController.returnOrderItem);
router.post("/orders/:orderId/return-all", userAuth, orderController.returnEntireOrder);

router.get("/orders/:orderId/invoice", userAuth, orderController.downloadInvoice);
router.post("/placeOrder", userAuth, orderController.placeCodOrder);
router.post('/create-retry-order', userAuth, orderController.createRetryOrder);

//wishlist
router.get("/wishlist", userAuth, wishlistController.loadWishlist)
router.post("/addWishlist/:id", userAuth, wishlistController.addToWishList)
router.delete("/clearWishlist", userAuth, wishlistController.deleteWishlist);//entire wishlist
router.delete("/removeWishlist/:productId", userAuth, wishlistController.removeFromWishlist);//specific item

//coupon
// Coupon management
router.get("/listcoupon", userAuth, couponController.loadCoupon);
router.post("/applyCoupon", userAuth, couponController.applyCoupon);
router.post("/removeCoupon", userAuth, couponController.removeCoupon);

//razorpay/payNow
router.post("/create-order", userAuth, orderController.createRazorpayOrder);
router.post("/verify-payment", userAuth, orderController.verifyPayment);

//wallet
router.get("/wallet", userAuth, walletController.loadWallet);
router.post("/walletPayment", userAuth, walletController.walletPayment);

//aboutPage
router.get("/about", userAuth, userController.loadAboutPage)


export { router };
