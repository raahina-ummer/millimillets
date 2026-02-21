export const applyDiscount = (price, discountPercentage, maxDiscountAmount) => {
  let discount = (price * discountPercentage) / 100;

  if (maxDiscountAmount && discount > maxDiscountAmount) {
    discount = maxDiscountAmount;
  }

  // Final safety: price must never go below 0
  return Math.max(price - discount, 0);
};
