// utils/offerCalculator.js

import { applyDiscount } from "../Helpers/discountApply.js";

export const getBestOfferForProduct = (product, category) => {
  const now = new Date();

  let bestOffer = {
    type: "none",
    discountPercentage: 0,
    maxDiscountAmount: null,
    offerDescription: "",
  };

  //  Product Offer
  const productOffer = product?.productOffer;

  if (
    productOffer &&
    productOffer.offerActive &&
    (!productOffer.offerStartDate || new Date(productOffer.offerStartDate) <= now) &&
    (!productOffer.offerEndDate || new Date(productOffer.offerEndDate) >= now)
  ) {
    bestOffer = {
      type: "product",
      discountPercentage: productOffer.discountPercentage || 0,
      maxDiscountAmount: productOffer.maxDiscountAmount ?? null,
      offerDescription: productOffer.offerDescription || "",
    };
  }

  //  Category Offer
  const categoryOffer = category?.categoryOffer;

  if (
    categoryOffer &&
    categoryOffer.offerActive &&
    (!categoryOffer.offerStartDate || new Date(categoryOffer.offerStartDate) <= now) &&
    (!categoryOffer.offerEndDate || new Date(categoryOffer.offerEndDate) >= now)
  ) {
    if (
      (categoryOffer.discountPercentage || 0) >
      (bestOffer.discountPercentage || 0)
    ) {
      bestOffer = {
        type: "category",
        discountPercentage: categoryOffer.discountPercentage || 0,
        maxDiscountAmount: categoryOffer.maxDiscountAmount ?? null,
        offerDescription: categoryOffer.offerDescription || "",
      };
    }
  }

  return bestOffer;
};


export const calculateFinalPriceForVariant = (variant, product, category) => {
  const regularPrice = Number(variant.regularPrice) || 0;
  const salePrice = Number(variant.salePrice) || 0;

 
  const priceBeforeOffer =
    salePrice > 0 && salePrice < regularPrice
      ? salePrice
      : regularPrice;

  const bestOffer = getBestOfferForProduct(product, category);

  const finalPrice =
    bestOffer.discountPercentage > 0
      ? applyDiscount(
          priceBeforeOffer,
          bestOffer.discountPercentage,
          bestOffer.maxDiscountAmount
        )
      : priceBeforeOffer;

  return {
    regularPrice,
    salePrice,
    priceBeforeOffer,     
    finalPrice: Math.round(finalPrice),
    appliedOffer: bestOffer,
  };
};



//Calculate discounted price

export const calculateDiscountedPrice = (price, discountPercentage, maxDiscount = null) => {
  const discountAmount = (price * discountPercentage) / 100;
  const finalDiscount = maxDiscount ? Math.min(discountAmount, maxDiscount) : discountAmount;
  return {
    originalPrice: price,
    discountPercentage,
    discountAmount: finalDiscount,
    finalPrice: Math.round(price - finalDiscount),
  };
};

/**
 * Check if an offer is currently active
 */
export const isOfferActive = (offer) => {
  if (!offer || !offer.offerActive) return false;

  const now = new Date();
  const startDate = new Date(offer.offerStartDate);
  const endDate = new Date(offer.offerEndDate);

  return now >= startDate && now <= endDate;
};

/**
 * Generate unique referral code
 */
export const generateReferralCode = (userId) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF${code}${Date.now().toString(36).toUpperCase()}`;
};

/**
 * Generate unique referral token URL
 */
export const generateReferralToken = () => {
  return require("crypto").randomBytes(32).toString("hex");
};

/**
 * Generate unique coupon code for referral reward
 */
export const generateCouponCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "COUPON";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};