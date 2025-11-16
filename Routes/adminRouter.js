// adminRouter.js  (ESM version)

import express from "express";
import * as adminController from "../controllers/admin/adminController.js";
import { userAuth, adminAuth } from "../middleware/auth.js";
import * as customerController from "../controllers/admin/customerController.js";
import * as categoryController from "../controllers/admin/categoryController.js";
import * as productController from "../controllers/admin/productController.js";
import * as orderController from "../controllers/admin/orderController.js";
import * as stockController from "../controllers/admin/stockController.js";
import multer from "multer";
import storage from "../Helpers/multer.js";
import passport from "../config/passport.js";



const router = express.Router();

const uploads = multer({ storage });

// Error management
router.get("/pageerror", adminController.pageerror);

// Admin management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/dashboard", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);

// Customer management
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);

// Category management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.get("/addCategory", adminAuth, categoryController.loadAddCategory);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);

// Product management
router.get("/addProduct", adminAuth, productController.getProductAddPage);
router.post("/addProduct", uploads.array("images", 4), productController.addProducts);
router.get("/products",adminAuth, productController.getAllProducts);
router.get("/blockProduct", adminAuth, productController.blockProduct);
router.get("/unblockProduct", adminAuth, productController.unblockProduct);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploads.array("images", 4), productController.editProduct);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);


//order management
router.get("/adminorder", adminAuth, orderController.loadOrders);
router.get("/adminorder/:orderId", adminAuth, orderController.loadOrderDetails);
router.patch("/adminorder/:orderId/status", adminAuth, orderController.updateOrderStatus);
router.patch("/adminorder/:orderId/return", adminAuth, orderController.approveOrRejectReturnRequest);

//stock management
router.get("/stock",adminAuth,stockController.getStockManagement);


export { router};
