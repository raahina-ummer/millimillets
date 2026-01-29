
export const calculateOrderTotals = (
  items,
  couponDiscount = 0
) => {
  let saleTotal = 0;

  for (const item of items) {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;

    saleTotal += price * quantity;
  }

  // Coupon safety
  couponDiscount = Math.min(couponDiscount, saleTotal);

  const shipping =
    saleTotal === 0
      ? 0
      : saleTotal >= 1000
      ? 0
      : 50;

  const tax = 0;

  const finalAmount = Math.max(
    saleTotal - couponDiscount + shipping + tax,
    0
  );

  return {
    saleTotal,
    couponDiscount,
    shipping,
    tax,
    finalAmount,
  };
};