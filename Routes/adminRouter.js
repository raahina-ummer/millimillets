

import express from "express";
import * as adminController from "../controllers/admin/adminController.js";
import { userAuth, adminAuth } from "../middleware/auth.js";
import * as customerController from "../controllers/admin/customerController.js";
import * as categoryController from "../controllers/admin/categoryController.js";
import * as productController from "../controllers/admin/productController.js";
import * as orderController from "../controllers/admin/orderController.js";
import * as stockController from "../controllers/admin/stockController.js";
import * as offerManagement from "../controllers/admin/offerManagement.js";
import * as couponController from  "../controllers/admin/couponController.js";
import * as salesreport from "../controllers/admin/salesreport.js";
import * as dashboard from  "../controllers/admin/dashboard.js"
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
router.get("/logout", adminController.logout);

// Customer management
router.get("/users", adminAuth, customerController.customerInfo);
router.patch("/blockCustomer", adminAuth, customerController.customerBlocked);
router.patch("/unblockCustomer", adminAuth, customerController.customerunBlocked);

// Category management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.get("/addCategory", adminAuth, categoryController.loadAddCategory);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.get("/editCategory/:id", adminAuth, categoryController.getEditCategory);
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
router.patch("/adminorderStatus/:orderId", adminAuth, orderController.updateOrderStatus);
router.patch("/adminorder/:orderId/return/:productId/:variantId", adminAuth, orderController.approveOrRejectReturnRequest);
router.patch("/adminorderdetails/update-item-status", adminAuth,orderController.updateSingleItemStatus);


//stock management
router.get("/stock",adminAuth,stockController.getStockManagement);
router.post("/update-stock",adminAuth,stockController.updateVariantStock);



//coupon management
router.get("/coupon", adminAuth, couponController.loadCoupon);
router.post("/addCoupon", adminAuth, couponController.createCoupon);
router.get("/editCoupon", adminAuth, couponController.loadEditCoupon);
router.patch("/editCoupon/:id", adminAuth, couponController.editCoupon);
router.delete("/deleteCoupon", adminAuth, couponController.deleteCoupon);
router.post("/activateCoupon", adminAuth, couponController.activateCoupon);
router.post("/deactivateCoupon", adminAuth, couponController.deactivateCoupon);

router.get("/offer",adminAuth,offerManagement.loadOffer)

router.get("/offer/calculate/:productId", adminAuth, offerManagement.calculateProductOffer);
router.get("/offer/applicable/:productId", adminAuth, offerManagement.getApplicableOffers);

// Product Offer Routes
router.get("/product-offers", adminAuth,offerManagement. getProductOffers);
router.get("/product-offer/:productId", adminAuth, offerManagement.getSingleProductOffer);
router.post("/product-offer/add", adminAuth, offerManagement.addProductOffer);
router.put("/product-offer/update", adminAuth, offerManagement.updateProductOffer);
router.put("/product-offer/toggle", adminAuth, offerManagement.toggleProductOffer);
router.delete("/product-offer/remove", adminAuth,  offerManagement.removeProductOffer);


// Category Offer Routes
router.get("/category-offers", adminAuth, offerManagement.getCategoryOffers);
router.get("/category-offer/:categoryId", adminAuth, offerManagement.getSingleCategoryOffer);
router.post("/category-offer/add", adminAuth, offerManagement.addCategoryOffer);

router.put("/category-offer/toggle", adminAuth, offerManagement.toggleCategoryOffer);
router.delete("/category-offer/remove", adminAuth, offerManagement.removeCategoryOffer);
router.put("/category-offer/:categoryId", adminAuth, offerManagement.updateCategoryOffer);

//sales report
router.get('/sales-report',adminAuth,salesreport.loadSalesReport);
router.get('/sales-report/download',adminAuth,salesreport.downloadSalesReport);

router.get("/dashboard", adminAuth, dashboard.loadDashboard);
router.get("/best-products",adminAuth,dashboard.bestSellingProducts);
router.get("/best-categories", adminAuth,dashboard.bestSellingCategories);
router.get("/dashboard/sales-chart", adminAuth,dashboard.getSalesChartData);
router.get("/dashboard/search", adminAuth,dashboard.searchDashboard);










export { router};
