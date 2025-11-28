export const getDateRange = (period, startDate, endDate) => {
  const now = new Date();
  let start, end;

  switch (period) {
    case "daily":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;

    case "weekly":
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
      break;

    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;

    case "yearly":
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;

    case "custom":
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      break;

    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  return {
    createdOn: {           // ← FIXED: createdAt → createdOn
      $gte: start,
      $lt: end,
    },
  };
};

/**
 * Calculate sales statistics from orders
 */
export const calculateStatistics = (orders) => {
  if (!orders || orders.length === 0) {
    return {
      totalOrders: 0,
      totalOrderAmount: 0,
      totalItemDiscount: 0,
      totalCouponDiscount: 0,
      totalDiscount: 0,
      totalTax: 0,
      totalShipping: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      returnedOrders: 0,
    };
  }

  const stats = {
    totalOrders: orders.length,
    totalOrderAmount: 0,
    totalItemDiscount: 0,
    totalCouponDiscount: 0,
    totalDiscount: 0,
    totalTax: 0,
    totalShipping: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
  };

  orders.forEach((order) => {
    // Sum amounts
    stats.totalOrderAmount += order.totalPrice || 0;      // ← FIXED: totalAmount → totalPrice
    stats.totalItemDiscount += order.itemDiscount || 0;   // ✅ Correct (field exists in schema)
    stats.totalCouponDiscount += order.discount || 0;     // ← FIXED: couponDiscount → discount
    stats.totalTax += order.tax || 0;                     // ✅ Correct (field exists in schema)
    stats.totalShipping += 0;                             // ← shippingCost not in schema, so 0

    // Count by status
    if (order.status === "Delivered") stats.deliveredOrders += 1;
    if (order.status === "Cancelled" || order.status === "Canceled") stats.cancelledOrders += 1;  // Handle both spellings
    if (order.status === "Returned") stats.returnedOrders += 1;
  });

  // Calculate derived values
  stats.totalDiscount = stats.totalItemDiscount + stats.totalCouponDiscount;
  stats.totalRevenue = stats.totalOrderAmount - stats.totalDiscount;
  stats.averageOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;

  return stats;
};