export const calculateTotals = (items, couponDiscount = 0) => {
  let subtotal = 0;
  let productDiscount = 0;

  for (const item of items) {
    const variant = item.productId?.variant?.[0];
    if (!variant) continue;

    subtotal += variant.regularPrice * item.quantity;
    productDiscount +=
      (variant.regularPrice - variant.salePrice) * item.quantity;
  }

  // Actual amount user is paying for products
  const saleTotal = subtotal - productDiscount;

  // Shipping based on sale price
  const shipping = saleTotal >= 1000 ? 0 : 50;

  // Final payable amount
  const finalAmount = Math.max(
    saleTotal - couponDiscount + shipping,
    0
  );

  return {
    subtotal,            
    productDiscount,     
    saleTotal,           
    shipping,
    finalAmount
  };
};
