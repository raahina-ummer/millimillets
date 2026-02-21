

export function buildInvoiceSnapshot(order) {

  let items = [];
  let subtotal = 0;
  let couponTotal = 0;
  let cancelledTotal = 0;
  let returnedTotal = 0;

  order.orderedProducts.forEach(item => {

    const base = item.price * item.quantity;
    const coupon = item.couponShare || 0;

    // ✅ keep field name = total (UI safe)
    const total = base - coupon;

    let payable = total;

    if (item.status === "Cancelled") {
      payable = 0;
      cancelledTotal += total;
    }

    if (item.status === "Returned") {
      payable = 0;
      returnedTotal += total;
    }

    items.push({
      name: item.productNameSnapshot,
      quantity: item.quantity,
      price: item.price,
      couponShare: coupon,

      total,                 // ✅ KEEP — UI SAFE
      payableAmount: payable, // ✅ NEW — optional extra

      status: item.status,    // ✅ NEW — for invoice display
      cancelledAt: item.cancelledAt || null,
      returnedAt: item.returnedAt || null
    });

    subtotal += base;
    couponTotal += coupon;
  });

  return {
    items,
    subtotal,
    couponDiscount: couponTotal,
    cancelledAmount: cancelledTotal,
    returnedAmount: returnedTotal,
    shipping: order.shippingCost,

    finalAmount:
      subtotal -
      couponTotal -
      cancelledTotal -
      returnedTotal +
      order.shippingCost
  };
}
