import Order from "../../models/OrderSchema.js";
import User from "../../models/userSchema.js";
import Wallet from "../../models/WalletSchema.js";
import Product from "../../models/ProductSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from "../../utils/logger.js";

// Order Status Constants
const OrderStatus = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUEST: "Return Requested",
  RETURNED: "Returned",
  PARTIALLY_RETURNED : "Partially Returned",
};

const loadOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Filter parameters
    const status = req.query.status || "";
    const sort = req.query.sort || "date_desc";
    const search = req.query.search || "";

    // Build filter query
    let filter = {};

    if (status) {
      filter.status = status;
    }

    // Search filter
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const userIds = users.map((user) => user._id);

      filter.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { userId: { $in: userIds } },
      ];
    }

    // Build sort query
    let sortQuery = {};
    switch (sort) {
      case "date_asc":
        sortQuery = { createdAt: 1 };
        break;
      case "date_desc":
        sortQuery = { createdAt: -1 };
        break;
      case "amount_asc":
        sortQuery = { finalAmount: 1 };
        break;
      case "amount_desc":
        sortQuery = { finalAmount: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }

    const orders = await Order.find(filter)
      .populate("userId", "name fullName email phone")
      .populate({
        path: "orderedProducts.product",
        select: "productName productImage salePrice regularPrice",
      })
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean();

      orders.forEach(order => {
  const originalSubtotal = order.orderedProducts.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const activeItemsTotal = order.orderedProducts
    .filter(item => !['Cancelled', 'Returned'].includes(item.status))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const activeCouponUsed =
    order.couponApplied && originalSubtotal > 0
      ? (activeItemsTotal / originalSubtotal) * order.couponDiscount
      : 0;

  order.currentAmount = Math.max(
    activeItemsTotal - activeCouponUsed + (order.shippingCost || 0),
    0
  );
});


    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    return res.render("adminorder", {
      title: "Orders",
currentRoute: "orders",
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      limit,
      status,
      sort,
      search,
    });
  } catch (error) {
    console.error("Error loading orders:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Requested",
      "Returned",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.ORDER.STATUS_INVALID,
      });
    }

    const order = await Order.findOne({ orderId }).populate(
      "orderedProducts.product",
    );

    if (!order) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.ORDER.NOT_FOUND,
      });
    }

    const validTransitions = {
      Pending: ["Processing", "Cancelled"],
      Processing: ["Shipped", "Cancelled"],
      Shipped: ["Delivered"],
      "Return Requested": ["Returned"],
    };

    if (
      !validTransitions[order.status] ||
      !validTransitions[order.status].includes(status)
    ) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.ORDER.STATUS_TRANSITION_INVALID,
      });
    }

    const now = new Date();

    if (status === "Delivered") {
      order.status = "Delivered";
      order.deliveredAt = now;
      order.InvoiceDate ??= now;

      if (!order.invoiceSnapshot) {
  let items = [];
  let subtotal = 0;
  let couponTotal = 0;

  order.orderedProducts.forEach(item => {
    if (item.status !== "Cancelled") {
      const base = item.price * item.quantity;
      const coupon = item.couponShare || 0;
      const total = base - coupon;

      items.push({
        name: item.productNameSnapshot,
        quantity: item.quantity,
        price: item.price,
        couponShare: coupon,
        total
      });

      subtotal += base;
      couponTotal += coupon;

      // Sync item status
      if (item.status !== "Returned") {
        item.status = "Delivered";
      }
    }
  });

  order.invoiceSnapshot = {
    items,
    subtotal,
    discount: order.discount,
    couponDiscount: couponTotal,
    shipping: order.shippingCost,
    finalAmount: subtotal - couponTotal + order.shippingCost
  };
}
      order.orderedProducts.forEach((item) => {
    if (
      item.status !== "Cancelled" &&
      item.status !== "Returned" &&
      item.status !== "Return Requested"
    ) {
      item.status = "Delivered";
    }
  });
    }

    
    else if (status === "Cancelled") {
      order.status = "Cancelled";
      order.cancelledAt = now;
      order.cancellationReason = "Cancelled by admin";

      for (const item of order.orderedProducts) {
        if (!item.product) continue;

      await Product.updateOne(
  { _id: item.product._id, "variant._id": item.variantId },
  { $inc: { "variant.$.stock": item.quantity } }
);

item.status = "Cancelled";

      }
            if (["Razorpay", "Wallet", "Card", "UPI"].includes(order.paymentMethod)) {
        let wallet = await Wallet.findOne({ userId: order.userId });

        if (!wallet) {
          wallet = await Wallet.create({
            userId: order.userId,
            balance: 0,
            transactions: [],
          });
        }

        const refundAmount = order.finalAmount;

        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: "credit",
          amount: refundAmount,
          reason: `Admin cancelled order ${order.orderId}`,
          orderId: order.orderId,
          date: new Date(),
        });

        await wallet.save();

        order.refundAmount = refundAmount;
        order.refundMethod = "wallet";
        order.refundStatus = "Completed";
      }

    } else{
      order.status = status;

      if (status === "Shipped") {
        order.shippedAt = now;
      }
    
    

   order.orderedProducts.forEach((item) => {
        if (
          item.status !== "Cancelled" &&
          item.status !== "Returned" &&
          item.status !== "Return Requested"
        ) {
          item.status = status;
        }
      });
    }
    await order.save({ validateModifiedOnly: true });

    return res.status(Status.OK).json({
      success: true,
      message: message.ORDER.STATUS_UPDATED,
      order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

const loadOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate("userId", "name fullName email phone")
      .populate({
        path: "orderedProducts.product",
        select:
          "productName productImage salePrice regularPrice description category variant stock",
      })
      .lean();

    if (!order) {
      return res
        .status(Status.NOT_FOUND)
        .json({ success: false, message: message.ORDER.NOT_FOUND });
    }

    // if request is from admin or user
    const isAdmin = req.originalUrl.includes("/adminorder");

    const originalSubtotal = order.orderedProducts.reduce(
  (sum, item) => sum + item.price * item.quantity,
  0
);

const activeSubtotal = order.orderedProducts
  .filter(item => !['Cancelled', 'Returned'].includes(item.status))
  .reduce((sum, item) => sum + item.price * item.quantity, 0);

const activeCouponUsed =
  order.couponApplied && originalSubtotal > 0
    ? Math.round((activeSubtotal / originalSubtotal) * order.couponDiscount)
    : 0;

order.adminSummary = {
  subtotal: activeSubtotal,
  couponDiscount: activeCouponUsed,
  shipping: order.shippingCost || 0,
  finalAmount: Math.max(
    activeSubtotal - activeCouponUsed + (order.shippingCost || 0),
    0
  )
};


    return res.render(isAdmin ? "adminorderdetails" : "orderdetails", {
      order,
       currentRoute: isAdmin ? "orders" : null
    });
  } catch (error) {
    console.error("Error loading order details:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const approveOrRejectReturnRequest = async (req, res) => {
  try {
    const { orderId, productId, variantId } = req.params;
    const { action, notes } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.ORDER.RETURN_ACTION_INVALID,
      });
    }

    const order = await Order.findOne({ orderId }).populate(
      "orderedProducts.product",
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: message.ORDER.NOT_FOUND,
      });
    }

    const itemIndex = order.orderedProducts.findIndex(
      (item) =>
        item.product._id.toString() === productId &&
        item.variantId.toString() === variantId &&
        item.status === "Return Requested",
    );

    if (itemIndex === -1) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.ORDER.RETURN_REQUEST_NOT_FOUND,
      });
    }

    const item = order.orderedProducts[itemIndex];

    //  REJECT RETURN
    if (action === "reject") {
      item.status = "Delivered";
      order.returnStatus = "Rejected";
      order.status = "Return Requested"; 
      order.returnRejectedReason = notes || "Return rejected by admin";
      order.returnRejectedAt = new Date();

      await order.save({ validateModifiedOnly: true });

      return res.json({
        success: true,
        message: message.ORDER.RETURN_REJECTED,
      });
    }
    if (item.status !== "Return Requested") {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.ORDER.RETURN_ALREADY_PROCESSED,
      });
    }

    //  APPROVE RETURN
    const itemSaleValue = item.price * item.quantity;
    const orderSaleTotal = order.totalPrice - order.discount;

    let couponShare = 0;
    if (order.couponDiscount && orderSaleTotal > 0) {
      couponShare = (itemSaleValue / orderSaleTotal) * order.couponDiscount;
    }

    const refundAmount = Math.max(itemSaleValue - couponShare, 0);

    // Wallet
    let wallet = await Wallet.findOne({ userId: order.userId });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: order.userId,
        balance: 0,
        transactions: [],
      });
    }

    wallet.balance += refundAmount;
    wallet.transactions.push({
      type: "credit",
      amount: refundAmount,
      reason: `Refund for returned item (${item.productNameSnapshot})`,
      orderId,
      date: new Date(),
    });

    await wallet.save();

    // Restore correct variant stock
    await Product.updateOne(
      { _id: item.product._id, "variant._id": item.variantId },
      { $inc: { "variant.$.stock": item.quantity } },
    );

    // Update item
    item.status = "Returned";
    item.returnedAt = new Date();

    // Update order
    order.refundAmount += refundAmount;
    order.refundMethod = "wallet";
    order.refundStatus = "Completed";
    order.returnStatus = "Approved";
    order.returnApprovedDate = new Date();

    order.totalPrice = Math.max(order.totalPrice - itemSaleValue, 0);
    order.finalAmount = Math.max(
      order.totalPrice -
        order.discount -
        order.couponDiscount +
        order.shippingCost,
      0,
    );

    // If ALL items are returned or cancelled → mark order returned
    const allDone = order.orderedProducts.every((p) =>
      ["Returned", "Cancelled"].includes(p.status),
    );

    if (allDone) {
      order.status = "Returned";
      order.finalAmount = 0;
    }

    await order.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: message.ORDER.RETURN_APPROVED,
    });
  } catch (error) {
    console.error("Return approval error:", error);
    return res.status(500).json({
      success: false,
      message: message.ORDER.RETURN_PROCESS_FAILED,
    });
  }
};

export {
  loadOrders,
  loadOrderDetails,
  updateOrderStatus,
  approveOrRejectReturnRequest,
};
