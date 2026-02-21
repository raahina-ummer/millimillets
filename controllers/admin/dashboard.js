import Order from "../../models/OrderSchema.js";
import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import User from "../../models/userSchema.js";
import logger from "../../utils/logger.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";

const loadDashboard = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }

  try {
    const { fromDate, toDate } = req.query;

    let dateFilter = {};

    if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

const totalOrders = await Order.countDocuments({
  status: { $nin: ["Cancelled", "Returned"] },
  ...dateFilter,
});


    const totalRevenueAgg = await Order.aggregate([
      {$match: {
  status: "Delivered",
  ...(dateFilter.createdAt && { createdAt: dateFilter.createdAt }),
}

      },
      {
        $group: {
          _id: null,
          total: { $sum: "$finalAmount" },
        },
      },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    const totalUsers = await User.countDocuments({ isAdmin: false });
    const totalProducts = await Product.countDocuments();

    // status metrics
    const liveOrders = await Order.countDocuments({
  status: { $in: ["Pending", "Processing"] },
  ...dateFilter

    });

    const pendingOrders = await Order.countDocuments({
      status: "Pending",
      ...dateFilter,
    });
    const deliveredOrders = await Order.countDocuments({
      status: "Delivered",
      ...dateFilter,
    });

    // best selling products
    const bestProducts = await Order.aggregate([
      {
        $match: {
          status: "Delivered",
          ...dateFilter,
        },
      },
      { $unwind: "$orderedProducts" },
      {
        $group: {
          _id: "$orderedProducts.product",
          totalSold: { $sum: "$orderedProducts.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: [
                "$orderedProducts.quantity",
                { $ifNull: ["$orderedProducts.price", 0] },
              ],
            },
          },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
    ]);

    // best selling categories
    const bestCategories = await Order.aggregate([
      { $match: { status: "Delivered", ...dateFilter } },
      { $unwind: "$orderedProducts" },
      {
        $lookup: {
          from: "products",
          localField: "orderedProducts.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          totalSold: { $sum: "$orderedProducts.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
    ]);

    // customer insight(circle)
    const totalCustomers = totalUsers;

    const customerStats = await Order.aggregate([
      { $match: { status: "Delivered", ...dateFilter } },
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
          lastOrderDate: { $max: "$createdAt" },
        },
      },
    ]);

    const newCustomers = customerStats.filter((c) => c.orderCount === 1).length;
    const returningCustomers = customerStats.filter(
      (c) => c.orderCount > 1,
    ).length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const currentCustomers = customerStats.filter(
      (c) => c.lastOrderDate >= thirtyDaysAgo,
    ).length;

    const currentCustomerPercent = totalCustomers
      ? Math.round((currentCustomers / totalCustomers) * 100)
      : 0;

    const newCustomerPercent = totalCustomers
      ? Math.round((newCustomers / totalCustomers) * 100)
      : 0;

    const returningCustomerPercent = totalCustomers
      ? Math.round((returningCustomers / totalCustomers) * 100)
      : 0;

    // Business target
    const targetCustomerPercent = 90;

    console.log("BEST PRODUCTS ", bestProducts);

    res.render("dashboard", {
      title: "Admin Dashboard",
      currentRoute: "dashboard",
      totalOrders,
      totalRevenue,
      totalUsers,
      totalProducts,
      liveOrders,
      pendingOrders,
      deliveredOrders,
      bestProducts,
      bestCategories,
      currentCustomerPercent,
      newCustomerPercent,
      returningCustomerPercent,
      targetCustomerPercent,
      fromDate,
      toDate,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const bestSellingProducts = async (req, res) => {
  try {
    const bestProducts = await Order.aggregate([
      { $unwind: "$orderedProducts" },

      {
        $group: {
          _id: "$orderedProducts.product",
          totalSold: { $sum: "$orderedProducts.quantity" },
        },
      },

      { $sort: { totalSold: -1 } },
      { $limit: 10 },

      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },

      { $unwind: "$product" },

      {
        $project: {
          _id: 0,
          productName: "$product.productName",
          totalSold: 1,
        },
      },
    ]);

    res.render("admin/bestProducts", { bestProducts });
  } catch (error) {
    console.error("Best Selling Products Error:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const bestSellingCategories = async (req, res) => {
  try {
    const categories = await Order.aggregate([
      { $unwind: "$orderedProducts" },

      {
        $lookup: {
          from: "products",
          localField: "orderedProducts.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },

      {
        $group: {
          _id: "$product.category",
          totalSold: { $sum: "$orderedProducts.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: [
                "$orderedProducts.quantity",
                "$orderedProducts.price",
              ],
            },
          },
        },
      },

      { $sort: { totalSold: -1 } },
      { $limit: 10 },

      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
    ]);

    res.render("admin/bestCategories", { categories });
  } catch (error) {
    console.error("Best Selling Categories Error:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};
const getSalesChartData = async (req, res) => {
  try {
    const { filter = "monthly", fromDate, toDate } = req.query;

    let groupId = {};
    let sortStage = {};

    let matchStage = { status: "Delivered" };

    if (fromDate && toDate) {
      matchStage.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    if (filter === "daily") {
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
      sortStage = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };
    }

    if (filter === "weekly") {
      groupId = {
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" },
      };
      sortStage = { "_id.year": 1, "_id.week": 1 };
    }

    if (filter === "monthly") {
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
      sortStage = { "_id.year": 1, "_id.month": 1 };
    }

    if (filter === "yearly") {
      groupId = {
        year: { $year: "$createdAt" },
      };
      sortStage = { "_id.year": 1 };
    }

    const sales = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupId,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$finalAmount" },
        },
      },
      { $sort: sortStage },
    ]);

    res.json({ success: true, data: sales });
  } catch (error) {
    console.error("Chart API Error:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const searchDashboard = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.json({ success: true, results: [] });
    }

    const results = await Order.find({
      $or: [{ orderId: { $regex: q, $options: "i" } }],
    })
      .limit(10)
      .select("orderId status finalAmount createdAt")
      .lean();

    res.json({ success: true, results });
  } catch (error) {
    console.error("Dashboard search error:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export {
  loadDashboard,
  bestSellingCategories,
  bestSellingProducts,
  getSalesChartData,
  searchDashboard,
};
