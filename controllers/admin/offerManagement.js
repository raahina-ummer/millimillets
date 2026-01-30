


import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
 import * as offerService from "../../Services/offerService.js"
import { calculateBestOffer,getCategoriesWithOffers,getProductsWithOffers } from "../../Services/offerService.js";
import * as referalService from "../../Services/refferralService.js"





export const loadOffer = async (req, res) => {
  try {
    const categories = await getCategoriesWithOffers();
    const products = await getProductsWithOffers();

    res.render("offer", {
      currentRoute: "offer",
      title: "Offers Management - MILLIMILLET",
      categories: categories || [],
      products: products || [],
    });
  } catch (error) {
    console.error("Error loading offer page:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

export const getProductOffers = async (req, res) => {
  try {
    const products = await offerService.getProductsWithOffers();
    res.render("productOffer", { products, currentRoute: "offer" });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const getSingleProductOffer = async (req, res) => {
  try {
    const offer = await offerService.getSingleProductOffer(
      req.params.productId,
    );
    res.status(Status.OK).json({ success: true, offer });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const addProductOffer = async (req, res) => {
  try {
    await offerService.addProductOffer(req.body.productId, req.body);
    res.status(Status.OK).json({ message: "Product offer added successfully" });
  } catch (error) {
    res.status(Status.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProductOffer = async (req, res) => {
  try {
    const product = await offerService.updateProductOffer(
      req.body.productId,
      req.body,
    );
    res
      .status(Status.OK)
      .json({ message: "Product offer updated successfully", product });
  } catch (error) {
    res.status(Status.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

export const toggleProductOffer = async (req, res) => {
  try {
    await offerService.toggleProductOfferStatus(
      req.body.productId,
      req.body.offerActive,
    );
    res.status(Status.OK).json({
      success: true,
      message: `Product offer ${req.body.offerActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const removeProductOffer = async (req, res) => {
  try {
    await offerService.removeProductOffer(req.body.productId);
    console.log("hair hello from delete");
    res
      .status(Status.OK)
      .json({ message: "Product offer removed successfully" });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const getCategoryOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const categories = await offerService.getCategoriesWithOffers();
    const paginatedCategories = categories.slice(skip, skip + limit)
    const totalCategories = categories.length;

    // Calculate stats
    const now = new Date();
    const totalOffers = categories.length;
    const activeOffers = categories.filter(
      (cat) => cat.categoryOffer.offerActive,
    ).length;
    const inactiveOffers = categories.filter(
      (cat) => !cat.categoryOffer.offerActive,
    ).length;
    const expiredOffers = categories.filter((cat) => {
      const endDate = new Date(cat.categoryOffer.offerEndDate);
      return endDate < now;
    }).length;

    res.render("admin/categoryOffer", {
      categories: paginatedCategories,
      currentRoute: "offer",
      currentPage: page,
      totalPages: Math.ceil(totalCategories / limit),
      totalCategories,
      totalOffers,
      activeOffers,
      inactiveOffers,
      expiredOffers,
    });
  } catch (error) {
    console.error("Error fetching category offers:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const getSingleCategoryOffer = async (req, res) => {
  try {
    const offer = await offerService.getSingleCategoryOffer(
      req.params.categoryId,
    );
    res.status(Status.OK).json({ success: true, offer });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const addCategoryOffer = async (req, res) => {
  try {
    await offerService.addCategoryOffer(req.body.categoryId, req.body);
    res
      .status(Status.OK)
      .json({ message: "Category offer added successfully" });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const updateCategoryOffer = async (req, res) => {
  try {
    console.log("Update category offer Invocked");
    const categoryId = req.params.categoryId;

    const category = await offerService.updateCategoryOffer(
      categoryId,
      req.body,
    );
    res
      .status(Status.OK)
      .json({
        success: true,
        message: "Category offer updated successfully",
        category,
      });
  } catch (error) {
    console.log("updateCategoryOffer", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const toggleCategoryOffer = async (req, res) => {
  try {
    const { categoryId, offerActive } = req.body;

    if (!categoryId) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Category ID is required",
      });
    }

    await offerService.toggleCategoryOfferStatus(categoryId, offerActive);

    res.status(Status.OK).json({
      success: true,
      message: `Category offer ${
        offerActive ? "activated" : "deactivated"
      } successfully`,
    });
  } catch (error) {
    console.error("Category toggle error:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

export const removeCategoryOffer = async (req, res) => {
  try {
    await offerService.removeCategoryOffer(req.body.categoryId);
    res
      .status(Status.OK)
      .json({ message: "Category offer removed successfully" });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};


// OFFER CALCULATION CONTROLLERS
export const calculateProductOffer = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    const category = await Category.findById(product.category);

    const bestOffer = offerService.calculateBestOffer(product, category);
    const pricing = offerService.calculateFinalPrice(
      product.price,
      product,
      category,
    );

    res.status(Status.OK).json({
      success: true,
      bestOffer,
      pricing,
    });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const getApplicableOffers = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    const category = await Category.findById(product.category);

    const offers = offerService.getAllApplicableOffers(product, category);

    res.status(Status.OK).json({
      success: true,
      offers,
    });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};
