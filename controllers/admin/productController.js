import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import User from "../../models/userSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import mongoose from "mongoose";
import { MongoExpiredSessionError } from "mongodb";
import { adminAuth } from "../../middleware/auth.js";

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("add-product", { cat: category });
  } catch (error) {
    console.log("Error: " + error);
    res.redirect("/pageerror");
  }
};

const addProducts = async (req, res) => {
  try {
    console.log("Add Product invoked");
    const products = req.body;
    console.log(products);
    const images = [];

    if (req.files && req.files.length > 0) {
      const validImageTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
      ];

      for (let file of req.files) {
        if (!validImageTypes.includes(file.mimetype)) {
          return res
            .status(400)
            .json("Only image files (PNG, JPEG, JPG, WEBP) are allowed.");
        }
        images.push(file.filename);
      }
    }

    // Category validation
    const categoryData = await Category.findOne({ name: products.category });
    if (!categoryData) {
      return res.status(Status.BAD_REQUEST).json({sucess:false,message:"Invalid Category Name"});
    }

    // Check for duplicate product
    const existingProduct = await Product.findOne({
      productName: products.productName,
    });

    if (existingProduct) {
      return res.status(Status.BAD_REQUEST).json({sucess:false,message:"Product already Exists"});
    }

    // Create variant array
    const variantData = [
      {
        unitType: `${products.weight || "500"} ${products.unit || "grm"}`,
        stock:
          parseInt(products.stock) ||
          parseInt(products.quantity) ||
          0,
        regularPrice: parseFloat(products.regularPrice) || 0,
        salePrice:
          parseFloat(products.salePrice) ||
          parseFloat(products.regularPrice) ||
          0,
      },
    ];

    const newProduct = new Product({
      productName: products.productName.trim(),
      description: products.description.trim(),
      category: categoryData._id,
      date: products.date ? new Date(products.date) : new Date(),
      gst: products.gst || "18%",
      productImage: images,
      variant: variantData,
      status: "Available",
    });

    await newProduct.save();
    return res.redirect("/admin/products");
  } catch (error) {
    console.log("Error", error);
    res.redirect("/admin/pageerror");
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .sort({ createdAt: -1 });

    const count = await Product.countDocuments({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    });

    const category = await Category.find({ isListed: true });

    if (category) {
      res.render("product", {
        data: productData,
        currentPage: page,
        totalCategories: count,
        totalPages: Math.ceil(count / limit),
        cat: category,
        search,
        adminProfile: "",
      });
    } else {
      res.render("pageerror");
    }
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageerror");
  }
};

const blockProduct = async (req, res) => {
  try {
    const id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/pageError");
  }
};

const unblockProduct = async (req, res) => {
  try {
    const id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/pageError");
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findById(id);
    const category = await Category.find();
    res.render("edit-product", {
      product,
      cat: category,
    });
  } catch (error) {
    res.redirect("/pageError");
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res.status(Status.BAD_REQUEST).json({ success:false,error: "Entered same Name. Please try another name." });
    }

    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        images.push(req.files[i].filename);
      }
    }

    const category = await Category.findOne({ name: data.category });

    const updateFields = {
      productName: data.productName,
      description: data.description,
      category: category._id,
      regularPrice: data.regularPrice,
      salePrice: data.salePrice,
      quantity: data.quantity,
    };

    const updateQuery =
      images.length > 0
        ? { ...updateFields, $push: { productImage: { $each: images } } }
        : updateFields;

    await Product.findByIdAndUpdate(id, updateQuery, { new: true });

    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/pageError");
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer },
    });
    const imagePath = path.join(
      "public",
      "upload",
      "product-images",
      imageNameToServer
    );
    if (fs.existsSync(imagePath)) {
      await fs.unlinkSync(imagePath);
    }
    res.send({ status: true });
  } catch (error) {
    res.redirect("/pageError");
  }
};

// Get product offer
export const getProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res.json({ success: false, message: 'Product not found' });
    }

    res.json({ 
      success: true, 
      offer: product.productOffer || {} 
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.json({ success: false, message: error.message });
  }
};

// Update/Create product offer
 const updateProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      discountPercentage,
      maxDiscountAmount,
      offerDescription,
      offerActive,
      offerStartDate,
      offerEndDate
    } = req.body;

    // Validation
    if (discountPercentage < 0 || discountPercentage > 100) {
      return res.json({
        success: false,
        message: 'Discount must be between 0 and 100'
      });
    }

    if (offerStartDate && offerEndDate && new Date(offerStartDate) > new Date(offerEndDate)) {
      return res.json({
        success: false,
        message: 'Start date cannot be after end date'
      });
    }

    let product = await Product.findByIdAndUpdate(
      productId,
      {
        productOffer: {
          discountPercentage: parseInt(discountPercentage) || 0,
          maxDiscountAmount: maxDiscountAmount ? parseInt(maxDiscountAmount) : null,
          offerDescription,
          offerActive: offerActive === true || offerActive === 'true',
          offerStartDate: offerStartDate ? new Date(offerStartDate) : null,
          offerEndDate: offerEndDate ? new Date(offerEndDate) : null
        }
      },
      { new: true }
    );

    
      if (!product) throw new Error("Product not found");

        if (!product) throw new Error("Product not found");
  product.salePrice = product.regularPrice - (( product.regularPrice * offerData.discountPercentage) /100);

  await product.save();


    res.json({
      success: true,
      message: 'Offer updated successfully',
      product
    });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.json({ success: false, message: error.message });
  }
};


 const loadProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res.json({ success: false, message: 'Product not found' });
    }

    res.json({ 
      success: true, 
      offer: product.productOffer || {} 
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.json({ success: false, message: error.message });
  }
};


export {
  getProductAddPage,
  addProducts,
  getAllProducts,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
  loadProductOffer,
  updateProductOffer,
};
