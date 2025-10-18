const express = require("express");
const router= express.Router();
const adminController = require("../controllers/admin/adminController.js");
const {userAuth,adminAuth}= require("../middleware/auth");
const customerController = require("../controllers/admin/customerController.js");
const categoryController= require("../controllers/admin/categoryController.js")


//error management
router.get("/pageerror",adminController.pageerror);

//admin management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/dashboard",adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);



//customer management
router.get("/users",adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("unblockCustomer",adminAuth,customerController.customerunBlocked);


// //category management
// router.get("/category",adminAuth,categoryController.categoryInfo);

module.exports = router;