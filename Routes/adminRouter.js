const express = require("express");
const router= express.Router();
const adminController = require("../controllers/admin/adminController.js");
const {userAuth,adminAuth}= require("../middleware/auth");
const customerController = require("../controllers/admin/customerController.js");
const categoryController= require("../controllers/admin/categoryController.js")
const productController= require("../controllers/admin/productController.js")
const multer= require('multer');
const storage= require('../helpers/multer');
const uploads= multer({storage:storage});
const passport = require("passport");



//error management
router.get("/pageerror",adminController.pageerror);

//admin management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/dashboard",adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);



//customer management
router.get("/users",adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);


// //category management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.get("/addCategory",adminAuth,categoryController.loadAddCategory);
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory)
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);


//Product Management
router.get("/addProduct",adminAuth,productController.getProductAddPage);
router.post("/addProduct",uploads.array("images",4),productController.addProducts);
router.get("/products",productController.getAllProducts);
router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);



module.exports = router;