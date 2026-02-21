export const getDateRange = (period, startDate, endDate) => {
  const now = new Date();
  let start, end;

  switch (period) {
    case "daily": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    }

    case "weekly": {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
      break;
    }

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
    createdAt: {
      $gte: start,
      $lt: end,
    },
  };
};

//Calculate sales statistics from orders
export const calculateStatistics = (orders = []) => {

  const stats = {
    totalOrders: orders.length,

    totalOrderAmount: 0,
    totalItemDiscount: 0,
    totalCouponDiscount: 0,
    totalDiscount: 0,

    totalShipping: 0,
    totalTax: 0,

    totalRevenue: 0,
    averageOrderValue: 0,

    deliveredOrders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,

    cancelledAmount: 0,
    returnedAmount: 0,
    refundedAmount: 0,
  };

  const REVENUE_STATUSES = [
    "Delivered",
    "Shipped",
    "Processing"
  ];

  let revenueOrderCount = 0;

  orders.forEach(order => {

    const itemDiscount = order.itemDiscount || 0;
    const couponDiscount = order.couponDiscount || 0;
    const totalDiscount = itemDiscount + couponDiscount;

    const orderAmount = order.totalPrice || 0;
    const finalAmount = order.finalAmount || 0;
    const refund = order.refundAmount || 0;

    // ---- counts ----
    if (order.status === "Delivered") stats.deliveredOrders++;

    if (order.status === "Cancelled") {
      stats.cancelledOrders++;
      stats.cancelledAmount += finalAmount;
    }

    if (order.status === "Returned") {
      stats.returnedOrders++;
      stats.returnedAmount += finalAmount;
    }

    // ---- totals (all orders — for reporting only) ----
    stats.totalOrderAmount += orderAmount;
    stats.totalItemDiscount += itemDiscount;
    stats.totalCouponDiscount += couponDiscount;
    stats.totalShipping += order.shippingCost || 0;
    stats.totalTax += order.tax || 0;
    stats.refundedAmount += refund;

    // ---- REAL REVENUE ----
    if (REVENUE_STATUSES.includes(order.status)) {
      stats.totalRevenue += (finalAmount - refund);
      revenueOrderCount++;
    }

  });

  stats.totalDiscount =
    stats.totalItemDiscount + stats.totalCouponDiscount;

  stats.averageOrderValue =
    revenueOrderCount > 0
      ? stats.totalRevenue / revenueOrderCount
      : 0;

  return stats;
};
