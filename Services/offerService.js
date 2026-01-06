import Category from "../models/CategorySchema.js";
import Product from "../models/ProductSchema.js";

// Product Offer Services
export const getProductsWithOffers = async () => {
  return await Product.find({
    "productOffer.offerActive": true
  }).select("productName productImage productOffer");
};

export const getSingleProductOffer = async (productId) => {
  const product = await Product.findById(productId)
    .select("productName productOffer");

  if (!product) throw new Error("Product not found");
  return product.productOffer || null;
};

export const addProductOffer = async (productId, offerData) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  product.productOffer = {
    discountPercentage: parseFloat(offerData.discountPercentage),
    maxDiscountAmount: offerData.maxDiscountAmount ? parseFloat(offerData.maxDiscountAmount) : null,
    offerDescription: offerData.offerDescription,
    offerActive: true,
    offerStartDate: new Date(offerData.offerStartDate),
    offerEndDate: new Date(offerData.offerEndDate),
  };

  product.salePrice = product.regularPrice - ((product.regularPrice * offerData.discountPercentage) / 100);

  await product.save();
  return product;
};

export const updateProductOffer = async (productId, offerData) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        "productOffer.discountPercentage": parseFloat(offerData.discountPercentage),
        "productOffer.maxDiscountAmount": offerData.maxDiscountAmount ? parseFloat(offerData.maxDiscountAmount) : null,
        "productOffer.offerDescription": offerData.offerDescription,
        "productOffer.offerActive": offerData.offerActive,
        "productOffer.offerStartDate": new Date(offerData.offerStartDate),
        "productOffer.offerEndDate": new Date(offerData.offerEndDate)
      },
    },
    { new: true }
  );

  console.log("is this is working")

  if (!product) throw new Error("Product not found");
  product.variant[0].salePrice = product.variant[0].regularPrice - ((product.variant[0].regularPrice * offerData.discountPercentage) / 100);

  await product.save();

  return product;
};

export const toggleProductOfferStatus = async (productId, offerActive) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        "productOffer.offerActive": offerActive
      }
    },
    { new: true }
  );

  if (!product) throw new Error("Product not found");
  return product;
};

export const removeProductOffer = async (productId) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        "productOffer.offerActive": false,
        "productOffer.discountPercentage": 0,
      },
    },
    { new: true }
  );

  if (!product) throw new Error("Product not found");
  return product;
};

// Category Offer Services
export const getCategoriesWithOffers = async () => {
  return await Category.find({
    "categoryOffer.offerActive": true
  }).select("name image categoryOffer");
};

export const getSingleCategoryOffer = async (categoryId) => {
  const category = await Category.findById(categoryId)
    .select("name categoryOffer");

  if (!category) throw new Error("Category not found");
  return category.categoryOffer || null;
};

export const addCategoryOffer = async (categoryId, offerData) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new Error("Category not found");

  category.categoryOffer = {
    discountPercentage: parseFloat(offerData.discountPercentage),
    maxDiscountAmount: offerData.maxDiscountAmount ? parseFloat(offerData.maxDiscountAmount) : null,
    offerDescription: offerData.offerDescription,
    offerActive: true,
    offerStartDate: new Date(offerData.offerStartDate),
    offerEndDate: new Date(offerData.offerEndDate),
  };

  await category.save();
  return category;
};

export const updateCategoryOffer = async (categoryId, offerData) => {
  const category = await Category.findByIdAndUpdate(
    categoryId,
    {
      $set: {
        "categoryOffer.discountPercentage": parseFloat(offerData.discountPercentage),
        "categoryOffer.maxDiscountAmount": offerData.maxDiscountAmount ? parseFloat(offerData.maxDiscountAmount) : null,
        "categoryOffer.offerDescription": offerData.offerDescription,
        "categoryOffer.offerActive": offerData.offerActive,
        "categoryOffer.offerStartDate": new Date(offerData.offerStartDate),
        "categoryOffer.offerEndDate": new Date(offerData.offerEndDate),
      },
    },
    { new: true }
  );

  if (!category) throw new Error("Category not found");

  const products = await Product.find({ category: categoryId });

  for (const product of products) {
    if (!Array.isArray(product.variant)) continue;

    product.variant = product.variant.map((v) => {
      
      let basePrice = v.regularPrice;
      let finalPrice = basePrice;

      if (offerData.offerActive && offerData.discountPercentage > 0) {
        finalPrice =
          basePrice -
          (basePrice * offerData.discountPercentage) / 100;
      }

      return {
        ...v,
        salePrice: Math.round(finalPrice),
      };
    });

    await product.save();
  }

  return category;
};

export const toggleCategoryOfferStatus = async (categoryId, offerActive) => {
  const category = await Category.findByIdAndUpdate(
    categoryId,
    {
      $set: {
        "categoryOffer.offerActive": offerActive
      }
    },
    { new: true }
  );

  if (!category) throw new Error("Category not found");
  return category;
};

export const removeCategoryOffer = async (categoryId) => {
  const category = await Category.findByIdAndUpdate(
    categoryId,
    {
      $set: {
        "categoryOffer.offerActive": false,
        "categoryOffer.discountPercentage": 0,
      },
    },
    { new: true }
  );

  if (!category) throw new Error("Category not found");
  return category;
};

// Offer Calculation Logic
export const calculateBestOffer = (product, category) => {
  const productDiscount = product?.productOffer?.offerActive ?
    product.productOffer.discountPercentage : 0;

  const categoryDiscount = category?.categoryOffer?.offerActive ?
    category.categoryOffer.discountPercentage : 0;

  const bestDiscount = Math.max(productDiscount, categoryDiscount);
  const offerType = bestDiscount === productDiscount ? 'product' : 'category';

  return {
    discountPercentage: bestDiscount,
    offerType,
    productOffer: product?.productOffer,
    categoryOffer: category?.categoryOffer
  };
};