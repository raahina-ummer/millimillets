// utils/offerCalculator.js

/**
 * Calculate the best applicable offer for a product
 * Returns the maximum discount between product offer and category offer
 */
export const getBestOfferForProduct = (product, category) => {
  const now = new Date();
  let bestOffer = {
    type: "none",
    discountPercentage: 0,
    maxDiscountAmount: null,
    offerDescription: "",
  };

  // Check Product Offer
  if (product.productOffer && product.productOffer.offerActive) {
    const productOfferStart = new Date(product.productOffer.offerStartDate);
    const productOfferEnd = new Date(product.productOffer.offerEndDate);

    if (now >= productOfferStart && now <= productOfferEnd) {
      if (product.productOffer.discountPercentage > bestOffer.discountPercentage) {
        bestOffer = {
          type: "product",
          discountPercentage: product.productOffer.discountPercentage,
          maxDiscountAmount: product.productOffer.maxDiscountAmount,
          offerDescription: product.productOffer.offerDescription,
        };
      }
    }
  }

  // Check Category Offer
  if (category && category.categoryOffer && category.categoryOffer.offerActive) {
    const categoryOfferStart = new Date(category.categoryOffer.offerStartDate);
    const categoryOfferEnd = new Date(category.categoryOffer.offerEndDate);

    if (now >= categoryOfferStart && now <= categoryOfferEnd) {
      if (category.categoryOffer.discountPercentage > bestOffer.discountPercentage) {
        bestOffer = {
          type: "category",
          discountPercentage: category.categoryOffer.discountPercentage,
          maxDiscountAmount: category.categoryOffer.maxDiscountAmount,
          offerDescription: category.categoryOffer.offerDescription,
        };
      }
    }
  }

  return bestOffer;
};

/**
 * Calculate discounted price
 */
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