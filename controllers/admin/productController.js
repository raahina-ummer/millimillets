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
import logger from '../../utils/logger.js';

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("add-product", { cat: category });
  } catch (error) {
    console.log("Error: " + error);
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};

// 

const addProducts = async (req, res) => {
  try {
    console.log("Add Product invoked");
    const {
      productName,
      description,
      category,
      weight,
      gst,
      stock,
      regularPrice,
      salePrice,
      unit,
      date
    } = req.body;
    const images = req.files;

    // Validation - Required fields
    if (!productName || !description || !category || !weight || !gst || !stock || !regularPrice) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    // Validation - Numeric values
    if (parseFloat(weight) <= 0) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "Weight must be positive" 
      });
    }
    if (parseFloat(regularPrice) <= 0) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "Regular price must be positive" 
      });
    }
    if (parseInt(stock) < 0) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "Stock must be non-negative" 
      });
    }
    if (parseFloat(gst) < 0 || parseFloat(gst) > 100) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "GST must be between 0 and 100" 
      });
    }

    // Validation - Sale price
    if (salePrice && parseFloat(salePrice) > parseFloat(regularPrice)) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "Sale price cannot be greater than regular price" 
      });
    }

    // Category validation
    const categoryDoc = await Category.findOne({ name: category });
    if (!categoryDoc) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "Invalid category name" 
      });
    }

    // Check for duplicate product
    const existingProduct = await Product.findOne({
      productName: productName.trim()
    });
    if (existingProduct) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "Product already exists" 
      });
    }

    // Image validation
    if (!images || images.length === 0) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "At least one product image is required" 
      });
    }

    if (images.length > 4) {
      return res.status(Status.BAD_REQUEST).json({ 
        success: false, 
        message: "Maximum 4 images allowed" 
      });
    }

    // Validate image types
    const validImageTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];

    const imageFilenames = [];
    for (let file of images) {
      if (!validImageTypes.includes(file.mimetype)) {
        return res.status(Status.BAD_REQUEST).json({ 
          success: false, 
          message: "Only image files (PNG, JPEG, JPG, WEBP) are allowed" 
        });
      }
      imageFilenames.push(file.filename);
    }

    // Create variant array
    const variantData = [
      {
        unitType: `${weight} ${unit || "grm"}`,
        stock: parseInt(stock),
        regularPrice: parseFloat(regularPrice),
        salePrice: salePrice ? parseFloat(salePrice) : parseFloat(regularPrice)
      }
    ];

    // Create new product
    const newProduct = new Product({
      productName: productName.trim(),
      description: description.trim(),
      category: categoryDoc._id,
      date: date ? new Date(date) : new Date(),
      gst: parseFloat(gst),
      productImage: imageFilenames,
      variant: variantData,
      status: "Available"
    });

    await newProduct.save();

  return res.redirect("/admin/products");

  } catch (error) {
    console.error("Add product error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, 
      message: message.SERVER_ERROR,
  });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

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
   res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};

const unblockProduct = async (req, res) => {
  try {
    const id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
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
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};




const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      productName,
      description,
      category,
      gst,
      variants // This will be an object like: { '0': {weight, unit, regularPrice, salePrice, stock}, '1': {...} }
    } = req.body;
    const images = req.files;

    const product = await Product.findById(id);
    
    // Parse variants from request body
    const variantsArray = [];
    if (variants) {
      for (let key in variants) {
        const v = variants[key];
        if (v.weight && v.unit && v.regularPrice && v.stock) {
          variantsArray.push({
            unitType: `${v.weight} ${v.unit}`,
            regularPrice: parseFloat(v.regularPrice),
            salePrice: v.salePrice ? parseFloat(v.salePrice) : 0,
            stock: parseInt(v.stock)
          });
        }
      }
    }

    // Validation
    if (!productName || !description || !category || !gst) {
      throw new Error("Missing required fields");
    }

    if (variantsArray.length === 0) {
      throw new Error("At least one variant is required");
    }

    // Validate each variant
    for (let i = 0; i < variantsArray.length; i++) {
      const v = variantsArray[i];
      const weight = parseFloat(v.unitType.split(' ')[0]);
      
      if (weight <= 0) {
        throw new Error(`Variant ${i + 1}: Weight must be positive`);
      }
      if (v.regularPrice <= 0) {
        throw new Error(`Variant ${i + 1}: Regular price must be positive`);
      }
      if (v.stock < 0) {
        throw new Error(`Variant ${i + 1}: Stock must be non-negative`);
      }
      if (v.salePrice && v.salePrice >= v.regularPrice) {
        throw new Error(`Variant ${i + 1}: Sale price must be less than regular price`);
      }
    }

    const gstValue = parseFloat(gst.toString().replace('%', ''));
    if (gstValue < 0 || gstValue > 100) {
      throw new Error("GST must be between 0% and 100%");
    }

    if (!product) {
      throw new Error("Product not found");
    }

    const categoryDoc = await Category.findOne({ name: category });
    if (!categoryDoc) {
      throw new Error("Invalid category");
    }

    const duplicate = await Product.findOne({ productName, _id: { $ne: id } });
    if (duplicate) {
      throw new Error("Product name already exists");
    }

    const hasExistingImages = product.productImage && product.productImage.length > 0;
    const hasNewImages = images && images.length > 0;
    
    if (!hasExistingImages && !hasNewImages) {
      throw new Error("At least one product image is required");
    }

    if ((product.productImage?.length || 0) + (images?.length || 0) > 4) {
      throw new Error("Maximum 4 images allowed");
    }

    // Update product fields
    const updateData = {
      productName,
      description,
      category: categoryDoc._id,
      gst: gstValue.toString() + '%',
      variant: variantsArray // Replace entire variant array
    };

    // Add new images if any
    if (images && images.length > 0) {
      const newImages = images.map(f => f.filename);
      updateData.productImage = [...(product.productImage || []), ...newImages];
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );

    res.status(Status.OK).json({ 
      success: true, 
      message: "Product updated successfully", 
      product: updatedProduct 
    });

  } catch (error) {
    console.error("Edit product error:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;

    // validation
    if (!productIdToServer || !productIdToServer.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: "Invalid product ID"
      });
    }

   
    if (!imageNameToServer || imageNameToServer.includes('/') || imageNameToServer.includes('..')) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: "Invalid image name"
      });
    }

    // check product exists
    const product = await Product.findById(productIdToServer);
    if (!product) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: "Product not found"
      });
    }

    // Check if image exists in product's image 
    if (!product.productImage.includes(imageNameToServer)) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: "Image not found in product"
      });
    }

    
    if (product.productImage.length === 1) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: "Cannot delete the last image. A product must have at least one image."
      });
    }

   

    // Remove from database
    await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer }
    });

    // Delete file from filesystem
    const imagePath = path.join(
      "public",
      "upload",
      "product-images",
      imageNameToServer
    );

    //  fs.promises for proper async handling
    try {
      if (fs.existsSync(imagePath)) {
        await fs.promises.unlink(imagePath);
      }
    } catch (fileError) {
      console.error("File deletion error:", fileError);
      
    }

    return res.status(Status.OK).json({
      status: true,
      message: "Image deleted successfully"
    });

  } catch (error) {
    console.error("Delete image error:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};


// Get product offer
export const getProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res.Status(Status.BAD_REQUEST).json({ success: false, message:message.PRODUCT_NOT_FOUND  });
    }

    res.Status(Status.OK).json({
      success: true,
      offer: product.productOffer || {}
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
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
      return res.Status(Status.BAD_REQUEST).json({
        success: false,
        message: 'Discount must be between 0 and 100'
      });
    }

    if (offerStartDate && offerEndDate && new Date(offerStartDate) > new Date(offerEndDate)) {
      return res.Status(Status.BAD_REQUEST).json({
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
    product.salePrice = product.regularPrice - ((product.regularPrice * offerData.discountPercentage) / 100);

    await product.save();


    res.Status(Status.OK).json({
      success: true,
      message: 'Offer updated successfully',
      product
    });
  } catch (error) {
    console.error('Error updating offer:', error);
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};


const loadProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res.Status(Status.BAD_REQUEST).json({ success: false, message: 'Product not found' });
    }

    res.Status(Status.OK).json({
      success: true,
      offer: product.productOffer || {}
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
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
