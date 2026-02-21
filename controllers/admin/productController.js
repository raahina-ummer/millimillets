import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import mongoose from "mongoose";
import { MongoExpiredSessionError } from "mongodb";
import { adminAuth } from "../../middleware/auth.js";
import logger from "../../utils/logger.js";
import { calculateFinalPriceForVariant } from "../../utils/offerCalculator.js";



const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const productData = await Product.find({
      productName: { $regex: new RegExp(search, "i") },
    })
      .populate("category")
      .sort({ createdAt: -1 });

    const productList = [];
    let tP=0;

   
    productData.forEach((product) => {

      product.variant.forEach((variant) => {

        const priceCalc = calculateFinalPriceForVariant(
          variant,
          product,
          product.category
        );

        const basePrice =
          variant.salePrice || variant.price || variant.regularPrice;

        const hasOffer =
          priceCalc.appliedOffer.discountPercentage > 0;

          
         const finalPrice = hasOffer ? priceCalc.finalPrice : basePrice;

          if(variant.stock === 0){
            tP += finalPrice
          }
          console.log(tP,"PricesofZeroStock");

        productList.push({
          _id: product._id,
          productName: product.productName,
          description: product.description,
          category: product.category,
          gst: product.gst,
          productImage: product.productImage,

          status: product.status || "Available",
          isBlocked: product.isBlocked || false,
          isListed: !product.isBlocked,

          variant: [variant],

          basePrice,
          hasOffer,
          activeOffer: hasOffer ? priceCalc.appliedOffer : null,
          finalPrice,
          strikePrice: hasOffer ? basePrice : null


        

        });


      }); 

    }); 

    


    const totalCount = productList.length;
    const totalPages = Math.ceil(totalCount / limit);

    const startIndex = (page - 1) * limit;
    const paginatedProducts =
      productList.slice(startIndex, startIndex + limit);

    const category = await Category.find({ isListed: true });




    res.render("product", {
      title: "Products",
      currentRoute: "products",
      data: paginatedProducts,
      currentPage: page,
      totalProducts: totalCount,
      totalPages,
      cat: category,
      search,
      adminProfile: "",
    });

  } catch (error) {
    console.log(error);
    res.render("500");
  }
};


const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("add-product", { cat: category,currentRoute: "products", });
  } catch (error) {
    console.log("Error: " + error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};


const addProducts = async (req, res) => {
  try {
    console.log("Add Product invoked");

    const { productName, description, category, gst, variants } = req.body;
    const images = req.files;

   
    if (!productName || !description || !category || !gst) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.PRODUCT.MISSING_REQUIRED_FIELDS,
      });
    }

    if (parseFloat(gst) < 0 || parseFloat(gst) > 100) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.PRODUCT.INVALID_GST,
      });
    }

    const categoryDoc = await Category.findOne({ name: category });
    if (!categoryDoc) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.PRODUCT.INVALID_CATEGORY,
      });
    }

    
    const existingProduct = await Product.findOne({
      productName: productName.trim(),
    });

    if (existingProduct) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.PRODUCT.ALREADY_EXISTS,
      });
    }

   
    if (!images || images.length < 3) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.PRODUCT.IMAGE_REQUIRED,
      });
    }

    if (images.length > 4) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.PRODUCT.IMAGE_MAX_LIMIT,
      });
    }

    const validImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const imageFilenames = [];

    for (let file of images) {
      if (!validImageTypes.includes(file.mimetype)) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: message.PRODUCT.IMAGE_TYPE_INVALID,
        });
      }
      imageFilenames.push(file.filename);
    }

    
    let parsedVariants = variants;

    if (variants && !Array.isArray(variants)) {
      parsedVariants = Object.values(variants);
    }

    if (!parsedVariants || parsedVariants.length === 0) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.PRODUCT.VARIANT_REQUIRED,
      });
    }

    const variantData = [];

    for (let i = 0; i < parsedVariants.length; i++) {
      const v = parsedVariants[i];

      if (!v.weight || parseFloat(v.weight) <= 0) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: `Variant ${i + 1}: Invalid weight`,
        });
      }

      if (!v.regularPrice || parseFloat(v.regularPrice) <= 0) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: `Variant ${i + 1}: Invalid regular price`,
        });
      }

      if (v.salePrice && parseFloat(v.salePrice) > parseFloat(v.regularPrice)) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: `Variant ${i + 1}: Sale price cannot exceed regular price`,
        });
      }

      if (v.stock === undefined || parseInt(v.stock) < 0) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: `Variant ${i + 1}: Invalid stock`,
        });
      }

      variantData.push({
        unitType: `${v.weight} ${v.unit || "grm"}`,
        stock: parseInt(v.stock),
        regularPrice: parseFloat(v.regularPrice),
        salePrice: v.salePrice
          ? parseFloat(v.salePrice)
          : parseFloat(v.regularPrice),
      });
    }

    const newProduct = new Product({
      productName: productName.trim(),
      description: description.trim(),
      category: categoryDoc._id,
      gst: parseFloat(gst),
      productImage: imageFilenames,
      variant: variantData,
      status: "Available",
    });

    await newProduct.save();

    return res.status(Status.OK).json({
      success: true,
      message: message.PRODUCT.CREATED_SUCCESS,
    });

  } catch (error) {
    console.error("Add product error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};




const blockProduct = async (req, res) => {
  try {
    const id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const unblockProduct = async (req, res) => {
  try {
    const id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
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
      currentRoute: "products",
    });
  } catch (error) {
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const { productName, description, category, gst, variants } = req.body;
    const images = req.files;

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Product not found");
    }

    
    const variantsArray = [];

    if (!variants || Object.keys(variants).length === 0) {
      throw new Error("At least one variant is required");
    }

    for (let key in variants) {
      const v = variants[key];

      if (
        v.weight === undefined ||
        v.unit === undefined ||
        v.regularPrice === undefined ||
        v.stock === undefined
      ) {
        throw new Error("Invalid variant data");
      }

      variantsArray.push({
        _id: v._id || new mongoose.Types.ObjectId(),
        unitType: `${v.weight} ${v.unit}`,
        regularPrice: Number(v.regularPrice),
        salePrice: v.salePrice ? Number(v.salePrice) : 0,
        stock: Number(v.stock),
      });
    }

    if (!productName || !description || !category || !gst) {
      throw new Error("Missing required fields");
    }

    if (variantsArray.length === 0) {
      throw new Error("At least one variant is required");
    }

    
    for (let i = 0; i < variantsArray.length; i++) {
      const v = variantsArray[i];
      const weight = parseFloat(v.unitType.split(" ")[0]);

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
        throw new Error(
          `Variant ${i + 1}: Sale price must be less than regular price`,
        );
      }
    }

    const gstValue = Number(gst);
    if (isNaN(gstValue) || gstValue < 0 || gstValue > 100) {
      throw new Error("GST must be between 0 and 100");
    }

    const categoryDoc = await Category.findOne({ name: category });
    if (!categoryDoc) {
      throw new Error("Invalid category");
    }

    const duplicate = await Product.findOne({ productName, _id: { $ne: id } });
    if (duplicate) {
      throw new Error("Product name already exists");
    }

    const hasExistingImages =
      product.productImage && product.productImage.length > 0;
    const hasNewImages = images && images.length > 0;

    if (!hasExistingImages && !hasNewImages) {
      throw new Error("At least one product image is required");
    }

    if ((product.productImage?.length || 0) + (images?.length || 0) > 4) {
      throw new Error("Maximum 4 images allowed");
    }

    
    const updateData = {
      productName,
      description,
      category: categoryDoc._id,
      gst: gstValue,
      variant: variantsArray,
    };

    
    if (images && images.length > 0) {
      const newImages = images.map((f) => f.filename);
      updateData.productImage = [...(product.productImage || []), ...newImages];
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(Status.OK).json({
      success: true,
      message: message.PRODUCT.UPDATED_SUCCESS,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Edit product error:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;

   
    if (!productIdToServer || !productIdToServer.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: "Invalid product ID",
      });
    }

    if (
      !imageNameToServer ||
      imageNameToServer.includes("/") ||
      imageNameToServer.includes("..")
    ) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: "Invalid image name",
      });
    }

    
    const product = await Product.findById(productIdToServer);
    if (!product) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: message.PRODUCT.NOT_FOUND,
      });
    }

    // Check if image exists in product's image
    if (!product.productImage.includes(imageNameToServer)) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: message.PRODUCT.IMAGE_NOT_FOUND,
      });
    }

    if (product.productImage.length === 1) {
      return res.status(Status.BAD_REQUEST).json({
        status: false,
        error: message.PRODUCT.IMAGE_DELETE_LAST_NOT_ALLOWED,
      });
    }

    // Remove from database
    await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer },
    });

    // Delete file from filesystem
    const imagePath = path.join(
      "public",
      "upload",
      "product-images",
      imageNameToServer,
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
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Delete image error:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export const getProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.PRODUCT_NOT_FOUND });
    }

    res.status(Status.OK).json({
      success: true,
      offer: product.productOffer || {},
    });
  } catch (error) {
    console.error("Error fetching offer:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};


const updateProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const {
      discountPercentage,
      maxDiscountAmount,
      offerDescription,
      offerActive,
      offerStartDate,
      offerEndDate,
    } = req.body;

    const discount = Number(discountPercentage);

if (isNaN(discount) || discount < 0 || discount > 100) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Discount must be between 0 and 100",
      });
    }

    if (
      offerStartDate &&
      offerEndDate &&
      new Date(offerStartDate) > new Date(offerEndDate)
    ) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Start date cannot be after end date",
      });
    }

    let product = await Product.findByIdAndUpdate(
      productId,
      {
        productOffer: {
          discountPercentage: parseInt(discountPercentage) || 0,
          maxDiscountAmount: maxDiscountAmount
            ? parseInt(maxDiscountAmount)
            : null,
          offerDescription,
          offerActive: offerActive === true || offerActive === "true",
          offerStartDate: offerStartDate ? new Date(offerStartDate) : null,
          offerEndDate: offerEndDate ? new Date(offerEndDate) : null,
        },
      },
      { new: true },
    );

   if (!product) {
  return res.status(Status.BAD_REQUEST).json({
    success: false,
    message: "Product not found",
  });
}


    

    res.status(Status.OK).json({
      success: true,
      message:message.PRODUCT.OFFER_UPDATED_SUCCESS,
      product,
    });
  } catch (error) {
    console.error("Error updating offer:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const loadProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.PRODUCT.NOT_FOUND });
    }

    res.status(Status.OK).json({
      success: true,
      offer: product.productOffer || {},
    });
  } catch (error) {
    console.error("Error fetching offer:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
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
