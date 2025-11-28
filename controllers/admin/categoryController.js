import mongoose from "mongoose";
import Category from "../../models/CategorySchema.js";
import Product from "../../models/ProductSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";


const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    // Build search query
    const searchQuery = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const categoryData = await Category.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
      search: search,
    });
  } catch (error) {
    console.error(error);
     res.status(Status.INTERNAL_SERVER_ERROR).send(message.SERVER_ERROR);
  }
};

const loadAddCategory = (req, res) => {
  try {
    return res.render("addcategory");
  } catch (error) {
   res.status(Status.INTERNAL_SERVER_ERROR).send(message.SERVER_ERROR);
  }
};

const addCategory = async (req, res) => {
  console.log("Add Category Invoked");
  console.log("REQ BODY:", req.body);
  let { name, description } = req.body;

  try {
    // Convert name to lowercase for comparison
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } // case-insensitive
    });

    if (existingCategory) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "The category already exists" });

    }

    const newCategory = new Category({
      name,
      description,
    });

    await newCategory.save();
    return res.json({ message: "Category added Successfully" });
  } catch (error) {
    console.log("Error:", error);
    return res.status(Status.CREATED).json({ error: "Internal Server Error" });
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
    res.status(Status.INTERNAL_SERVER_ERROR).send(message.SERVER_ERROR);
  }
};

const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findOne({ _id: id });
    res.render("edit-category", { category });
  } catch (error) {
    res.status(Status.INTERNAL_SERVER_ERROR).send(message.SERVER_ERROR);
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

    const existingCategory = await Category.findOne({ name: categoryName });
    if (existingCategory) {
       return res.status(Status.BAD_REQUEST).json({ success: false, message: "The category already exists" });
    }

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: categoryName,
        description,
      },
      { new: true }
    );

    if (updateCategory) {
        res.status(Status.CREATED).json({ message: "Successfully added" });
    } else {
       res.status(Status.NOT_FOUND).json({ message: "Category not found" });
    }
  } catch (error) {
     res.status(Status.INTERNAL_SERVER_ERROR).send(message.SERVER_ERROR);
  }
};
 const loadCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Category not found" });
    }

    res.status(Status.OK).json({  success: true, offer: category.categoryOffer || {}  });
  } catch (error) {
    console.error("Error fetching category offer:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
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
      offerEndDate
    } = req.body;

    // Validation
    if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
      return res.json({
        success: false,
        message: "Discount must be between 0 and 100"
      });
    }

    if (maxDiscountAmount && maxDiscountAmount < 0) {
      return res.json({
        success: false,
        message: "Max discount amount cannot be negative"
      });
    }

    if (offerStartDate && offerEndDate) {
      const startDate = new Date(offerStartDate);
      const endDate = new Date(offerEndDate);
      
      if (startDate > endDate) {
        return res.json({
          success: false,
          message: "Start date cannot be after end date"
        });
      }
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      {
        categoryOffer: {
          discountPercentage: parseInt(discountPercentage) || 0,
          maxDiscountAmount: maxDiscountAmount ? parseInt(maxDiscountAmount) : null,
          offerDescription: offerDescription || null,
          offerActive: offerActive === true || offerActive === "true",
          offerStartDate: offerStartDate ? new Date(offerStartDate) : null,
          offerEndDate: offerEndDate ? new Date(offerEndDate) : null
        }
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Category offer updated successfully",
      category
    });
  } catch (error) {
    console.error("Error updating category offer:", error);
    res.json({ success: false, message: error.message });
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
          offerEndDate: null
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Category offer deleted successfully",
      category
    });
  } catch (error) {
    console.error("Error deleting category offer:", error);
    res.json({ success: false, message: error.message });
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
