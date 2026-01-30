import mongoose from "mongoose";
import Category from "../../models/CategorySchema.js";
import Product from "../../models/ProductSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from "../../utils/logger.js";

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    // Build search query
    const searchQuery = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const categoryData = await Category.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const now = new Date();

    categoryData.forEach((category) => {
      const offer = category.categoryOffer;

      category.hasOffer =
        offer &&
        offer.offerActive === true &&
        offer.discountPercentage > 0 &&
        (!offer.offerStartDate || offer.offerStartDate <= now) &&
        (!offer.offerEndDate || offer.offerEndDate >= now);

      category.activeOffer = category.hasOffer ? offer : null;
    });

    const totalCategories = await Category.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      title: "Category Management",
  currentRoute: "category",
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
      search: search,
    });
  } catch (error) {
    logger.error("Category info error", error);
    res.status(Status.INTERNAL_SERVER_ERROR).send(message.GENERAL.SERVER_ERROR);
  }
};

const loadAddCategory = (req, res) => {
  try {
    return res.render("addcategory");
  } catch (error) {
    res.status(Status.INTERNAL_SERVER_ERROR).send(message.GENERAL.SERVER_ERROR);
  }
};

const addCategory = async (req, res) => {
  logger.info("Add category invoked");
  logger.debug("Add category request body", req.body);
  let { name, description } = req.body;

  try {
    // Convert name to lowercase for comparison
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingCategory) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.CATEGORY.ALREADY_EXISTS });
    }

    const newCategory = new Category({
      name,
      description,
    });

    await newCategory.save();
    return res.status(Status.CREATED).json({
      success: true,
      message: message.CATEGORY.CREATED_SUCCESS,
    });
  } catch (error) {
    logger.error("Add category error", error);
    if (error.code === 11000) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Category name already exists",
      });
    }

    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

const getListCategory = async (req, res) => {
  try {
    const id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const getUnlistCategory = async (req, res) => {
  try {
    const id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");
  } catch (error) {
    res.status(Status.INTERNAL_SERVER_ERROR).send(message.GENERAL.SERVER_ERROR);
  }
};

const getEditCategory = async (req, res) => {
  try {
    const id = req.params.id;

    const category = await Category.findOne({ _id: id });
    res.render("edit-category", { category });
  } catch (error) {
    res.status(Status.INTERNAL_SERVER_ERROR).send(message.GENERAL.SERVER_ERROR);
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Name and description are required",
      });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      _id: { $ne: id },
    });

    if (existingCategory) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.CATEGORY.ALREADY_EXISTS,
      });
    }

    const updated = await Category.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        description: description.trim(),
      },
      { new: true },
    );

    if (!updated) {
      return res.status(Status.NOT_FOUND).json({
        success: false,
        message: message.CATEGORY_NOT_FOUND,
      });
    }

    return res.status(Status.OK).json({
      success: true,
      message: message.CATEGORY.UPDATED_SUCCESS,
    });
  } catch (error) {
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

const loadCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res
        .status(Status.NOT_FOUND)
        .json({ success: false, message: message.CATEGORY_NOT_FOUND });
    }

    res
      .status(Status.OK)
      .json({ success: true, offer: category.categoryOffer || {} });
  } catch (error) {
    logger.error("Error fetching category offer", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

// Create/Update category offer
const updateCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      discountPercentage,
      maxDiscountAmount,
      offerDescription,
      offerActive,
      offerStartDate,
      offerEndDate,
    } = req.body;

    // Validation
    if (
      isNaN(discountPercentage) ||
      discountPercentage < 0 ||
      discountPercentage > 100
    ) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.DISCOUNT_PERCENTAGE_INVALID,
      });
    }

    if (maxDiscountAmount && maxDiscountAmount < 0) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.MAX_DISCOUNT_NEGATIVE,
      });
    }

    if (offerStartDate && offerEndDate) {
      const startDate = new Date(offerStartDate);
      const endDate = new Date(offerEndDate);

      if (startDate > endDate) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: message.OFFER_DATE_INVALID,
        });
      }
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      {
        categoryOffer: {
          discountPercentage: Number(discountPercentage) || 0,
          maxDiscountAmount: maxDiscountAmount
            ? Number(maxDiscountAmount)
            : null,
          offerDescription: offerDescription || null,
          offerActive: offerActive === true || offerActive === "true",
          offerStartDate: offerStartDate ? new Date(offerStartDate) : null,
          offerEndDate: offerEndDate ? new Date(offerEndDate) : null,
        },
      },
      { new: true, runValidators: true },
    );

    if (!category) {
      return res.status(Status.NOT_FOUND).json({
        success: false,
        message: message.CATEGORY_NOT_FOUND,
      });
    }
    return res.status(Status.OK).json({
      success: true,
      message: message.CATEGORY_OFFER_UPDATED_SUCCESS,
      category,
    });
  } catch (error) {
    logger.error("Error updating category offer", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

// Delete category offer
const deleteCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findByIdAndUpdate(
      categoryId,
      {
        categoryOffer: {
          discountPercentage: 0,
          maxDiscountAmount: null,
          offerDescription: null,
          offerActive: false,
          offerStartDate: null,
          offerEndDate: null,
        },
      },
      { new: true },
    );

    if (!category) {
      return res.status(Status.NOT_FOUND).json({
        success: false,
        message: message.CATEGORY_NOT_FOUND,
      });
    }

    return res.status(Status.OK).json({
      success: true,
      message: message.CATEGORY_OFFER_DELETED_SUCCESS,
      category,
    });
  } catch (error) {
    logger.error("Error deleting category offer", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export {
  categoryInfo,
  addCategory,
  loadAddCategory,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
  loadCategoryOffer,
  updateCategoryOffer,
  deleteCategoryOffer,
};
