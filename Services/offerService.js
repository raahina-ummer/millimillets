import Category from "../models/CategorySchema.js";
import Product from "../models/ProductSchema.js";
import { applyDiscount } from "../Helpers/discountApply.js";

/* ===========================
   PRODUCT OFFER SERVICES
=========================== */

export const getProductsWithOffers = async () => {
  const now = new Date();
  const products = await Product.find().lean();

  return products.map((product) => {
    const offer = product.productOffer;

    const isValid =
      offer &&
      offer.offerActive &&
      (!offer.offerStartDate || new Date(offer.offerStartDate) <= now) &&
      (!offer.offerEndDate || new Date(offer.offerEndDate) >= now);

    return {
      ...product,
      hasOffer: !!isValid,
      activeOffer: isValid ? offer : null,
    };
  });
};

export const getSingleProductOffer = async (productId) => {
  const product = await Product.findById(productId).select(
    "productName productOffer",
  );

  if (!product) throw new Error("Product not found");
  return product.productOffer || null;
};

export const addProductOffer = async (productId, offerData) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  const variant = product.variant?.[0];
  if (!variant) throw new Error("Product variant missing");

  const basePrice =
    variant.salePrice && variant.salePrice < variant.regularPrice
      ? variant.salePrice
      : variant.regularPrice;

  const discountPercentage = Number(offerData.discountPercentage);
  const maxDiscountAmount = offerData.maxDiscountAmount
    ? Number(offerData.maxDiscountAmount)
    : null;

  if (discountPercentage <= 0 || discountPercentage > 90) {
    throw new Error("Discount percentage must be between 1 and 90");
  }

  if (maxDiscountAmount && maxDiscountAmount > basePrice) {
    throw new Error(
      `Max discount amount cannot exceed product price (₹${basePrice})`,
    );
  }

  if (
    offerData.offerStartDate &&
    offerData.offerEndDate &&
    new Date(offerData.offerStartDate) > new Date(offerData.offerEndDate)
  ) {
    throw new Error("Offer start date cannot be after end date");
  }

  product.productOffer = {
    discountPercentage,
    maxDiscountAmount,
    offerDescription: offerData.offerDescription,
    offerActive: true,
    offerStartDate: new Date(offerData.offerStartDate),
    offerEndDate: new Date(offerData.offerEndDate),
  };

  await product.save();
  return product;
};

export const updateProductOffer = async (productId, offerData) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  const variant = product.variant?.[0];
  if (!variant) throw new Error("Product variant missing");

  const basePrice =
    variant.salePrice && variant.salePrice < variant.regularPrice
      ? variant.salePrice
      : variant.regularPrice;

  const discountPercentage = Number(offerData.discountPercentage);
  const maxDiscountAmount = offerData.maxDiscountAmount
    ? Number(offerData.maxDiscountAmount)
    : null;

  if (discountPercentage <= 0 || discountPercentage > 90) {
    throw new Error("Discount percentage must be between 1 and 90");
  }

  if (maxDiscountAmount && maxDiscountAmount > basePrice) {
    throw new Error(
      `Max discount amount cannot exceed product price (₹${basePrice})`,
    );
  }

  if (
    offerData.offerStartDate &&
    offerData.offerEndDate &&
    new Date(offerData.offerStartDate) > new Date(offerData.offerEndDate)
  ) {
    throw new Error("Offer start date cannot be after end date");
  }

  product.productOffer = {
    ...product.productOffer,
    discountPercentage,
    maxDiscountAmount,
    offerDescription: offerData.offerDescription,
    offerActive: offerData.offerActive,
    offerStartDate: new Date(offerData.offerStartDate),
    offerEndDate: new Date(offerData.offerEndDate),
  };

  await product.save();
  return product;
};

export const toggleProductOfferStatus = async (productId, offerActive) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: { "productOffer.offerActive": offerActive } },
    { new: true },
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
        "productOffer.maxDiscountAmount": null,
      },
    },
    { new: true },
  );

  if (!product) throw new Error("Product not found");
  return product;
};

/* ===========================
   CATEGORY OFFER SERVICES
=========================== */

export const getCategoriesWithOffers = async () => {
  return await Category.find({
    "categoryOffer.offerActive": true,
  }).select("name image categoryOffer");
};

export const getSingleCategoryOffer = async (categoryId) => {
  const category = await Category.findById(categoryId).select(
    "name categoryOffer",
  );
  if (!category) throw new Error("Category not found");
  return category.categoryOffer || null;
};

export const addCategoryOffer = async (categoryId, offerData) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new Error("Category not found");

  category.categoryOffer = {
    discountPercentage: Number(offerData.discountPercentage),
    maxDiscountAmount: offerData.maxDiscountAmount
      ? Number(offerData.maxDiscountAmount)
      : null,
    offerDescription: offerData.offerDescription,
    offerActive: true,
    offerStartDate: new Date(offerData.offerStartDate),
    offerEndDate: new Date(offerData.offerEndDate),
  };

  await category.save();
  return category;
};

export const updateCategoryOffer = async (categoryId, offerData) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new Error("Category not found");

  category.categoryOffer = {
    ...category.categoryOffer,
    discountPercentage: Number(offerData.discountPercentage),
    maxDiscountAmount: offerData.maxDiscountAmount
      ? Number(offerData.maxDiscountAmount)
      : null,
    offerDescription: offerData.offerDescription,
    offerActive: offerData.offerActive,
    offerStartDate: new Date(offerData.offerStartDate),
    offerEndDate: new Date(offerData.offerEndDate),
  };

  await category.save();
  return category;
};

export const toggleCategoryOfferStatus = async (categoryId, offerActive) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new Error("Category not found");

  if (!category.categoryOffer) category.categoryOffer = {};
  category.categoryOffer.offerActive = offerActive;

  await category.save();
  return category;
};

export const removeCategoryOffer = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new Error("Category not found");

  if (!category.categoryOffer) category.categoryOffer = {};

  category.categoryOffer.offerActive = false;
  category.categoryOffer.discountPercentage = 0;
  category.categoryOffer.maxDiscountAmount = null;

  await category.save();
  return category;
};

/* ===========================
   OFFER CALCULATION LOGIC
=========================== */

export const calculateBestOffer = (product, category) => {
  const now = new Date();

  const isValid = (offer) =>
    offer &&
    offer.offerActive &&
    (!offer.offerStartDate || new Date(offer.offerStartDate) <= now) &&
    (!offer.offerEndDate || new Date(offer.offerEndDate) >= now);

  const productOfferValid = isValid(product?.productOffer);
  const categoryOfferValid = isValid(category?.categoryOffer);

  if (
    productOfferValid &&
    (!categoryOfferValid ||
      product.productOffer.discountPercentage >=
        category.categoryOffer.discountPercentage)
  ) {
    return { ...product.productOffer, offerType: "product" };
  }

  if (categoryOfferValid) {
    return { ...category.categoryOffer, offerType: "category" };
  }

  return null;
};

export const calculateFinalPrice = (product, category) => {
  const variant = product.variant?.[0];
  if (!variant) return 0;

  const basePrice =
    variant.salePrice && variant.salePrice < variant.regularPrice
      ? variant.salePrice
      : variant.regularPrice;

  const bestOffer = calculateBestOffer(product, category);

  if (!bestOffer) return basePrice;

  return Math.round(
    applyDiscount(
      basePrice,
      bestOffer.discountPercentage,
      bestOffer.maxDiscountAmount,
    ),
  );
};
