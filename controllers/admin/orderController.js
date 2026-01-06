import Order from "../../models/OrderSchema.js"
import User from "../../models/userSchema.js";
import Product from "../../models/ProductSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from '../../utils/logger.js';


// Order Status Constants
const OrderStatus = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
  RETURN_REQUEST: "Return Request",
  RETURNED: "Returned",
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
        sortQuery = { createdOn: 1 };
        break;
      case "date_desc":
        sortQuery = { createdOn: -1 };
        break;
      case "amount_asc":
        sortQuery = { finalAmount: 1 };
        break;
      case "amount_desc":
        sortQuery = { finalAmount: -1 };
        break;
      default:
        sortQuery = { createdOn: -1 };
    }

    // Fetch orders with populated data
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

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

     return res.render("adminorder", {
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
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};

//  Update Order Status 
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, userId } = req.body;

    console.log("Updating order status:", { orderId, status, userId });

    // Validate status
    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Canceled",
      "Return Request",
      "Returned",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(Status.BAD_REQUEST).json({success: false, message: "Invalid status value"});
    }

    // Find order and populate products
    const order = await Order.findOne({ orderId }).populate("orderedProducts.product");

    if (!order) {
      return res.status(Status.BAD_REQUEST).json({success: false,message: "Order not found"});
    }

    // Validate status transitions
    const validTransitions = {
      Pending: ["Processing", "Canceled"],
      Processing: ["Shipped", "Canceled"],
      Shipped: ["Delivered"],
      "Return Request": ["Returned"],
    };

    if (
      !validTransitions[order.status] ||
      !validTransitions[order.status].includes(status)
    ) {
      return res.status(Status.BAD_GATEWAY).json({success: false,message: `Invalid status transition from ${order.status} to ${status}`});
    }

    const now = new Date();

    // Handle different status changes
    if (status === "Delivered") {
      order.status = "Delivered";
      order.deliveredAt = now;
      
      // Set invoice date
      if (!order.InvoiceDate) {
        order.InvoiceDate = now;
      }
    } 
    else if (status === "Canceled") {
      order.status = "Canceled";
      order.cancelledAt = now;
      order.cancellationReason = "Cancelled by admin";

      //  RESTORE STOCK FOR ALL PRODUCTS
      for (let item of order.orderedProducts) {
        if (item.product) {
          const product = await Product.findById(item.product._id);
          if (product) {
            // Check if product has variant array
            if (product.variant && product.variant.length > 0) {
              product.variant[0].stock = parseInt(product.variant[0].stock) + parseInt(item.quantity);
              await product.save();
              console.log(` Restored stock for ${product.productName}: +${item.quantity}`);
            }
            // Check if product has direct stock field
            else if (product.stock !== undefined) {
              product.stock = parseInt(product.stock) + parseInt(item.quantity);
              await product.save();
              console.log(` Restored stock for ${product.productName}: +${item.quantity}`);
            }
          }
        }
      }

      console.log(" Order cancelled and stock restored successfully");
    }
    else if (status === "Returned") {
      // Calculate refund amount
      let refundAmount = order.finalAmount;

      // Find user and update wallet
      const user = await User.findById(order.userId);
      if (!user) {
        return res.status(Status.BAD_REQUEST).json({success: false,message: "User not found"});
      }

    
      await user.save();

      order.status = "Returned";
      order.returnedAt = now;
      order.refundAmount = refundAmount;
      order.refundMethod = "wallet";

      //  RESTORE STOCK FOR ALL PRODUCTS
      for (let item of order.orderedProducts) {
        if (item.product) {
          const product = await Product.findById(item.product._id);
          if (product) {
            if (product.variant && product.variant.length > 0) {
              product.variant[0].stock = parseInt(product.variant[0].stock) + parseInt(item.quantity);
              await product.save();
              console.log(`Restored stock for ${product.productName}: +${item.quantity}`);
            } else if (product.stock !== undefined) {
              product.stock = parseInt(product.stock) + parseInt(item.quantity);
              await product.save();
              console.log(` Restored stock for ${product.productName}: +${item.quantity}`);
            }
          }
        }
      }

      console.log(`Return approved. ₹${refundAmount} refunded to wallet. Stock restored.`);
    }
    else {
      order.status = status;
      
      if (status === "Shipped") {
        order.shippedAt = now;
      }
    }
    order.orderedProducts.forEach(item => {
  if (item.status !== 'Cancelled' && 
      item.status !== 'Returned' && 
      item.status !== 'Return Request') {
    item.status = status;
  }
});

    await order.save({ validateModifiedOnly: true });

   return res.status(Status.OK).json({success: true,message: `Order status updated to ${status}`,order,});
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({success: false,message: message.SERVER_ERROR,});
  }
};

const loadOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate("userId", "name fullName email phone")
      .populate({
        path: "orderedProducts.product",
        select: "productName productImage salePrice regularPrice description category variant stock",
      })
      .lean();

    if (!order) {
      return res.status(Status.NOT_FOUND).json({success:false, message: "Order not found" });
    }

    // if request is from admin or user
    const isAdmin = req.originalUrl.includes("/adminorder");

    return res.render(isAdmin ? "adminorderdetails" : "orderdetails", {
      order,
    });

  } catch (error) {
    console.error("Error loading order details:", error);
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};


// Approve or Reject Return Request
const approveOrRejectReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action } = req.body;

    if (!orderId?.trim()) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Order ID is required"
      });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Invalid action. Use 'approve' or 'reject'"
      });
    }

    const order = await Order.findOne({ orderId }).populate("orderedProducts.product");

    if (!order) {
      return res.status(Status.NOT_FOUND).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.status !== "Return Request") {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "This order does not have a return request"
      });
    }

    const userId = order.userId;

    if (action === "approve") {
      const refundAmount = order.finalAmount;

      // Wallet update
      let wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: refundAmount,
          transactions: [
            {
              type: "credit",
              amount: refundAmount,
              reason: "Order Refund",
              orderId: order.orderId
            }
          ]
        });
      } else {
        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: "credit",
          amount: refundAmount,
          reason: "Order Refund",
          orderId: order.orderId
        });
      }

      await wallet.save();

      // Restore product stock
      for (let item of order.orderedProducts) {
        const product = await Product.findById(item.product._id);
        if (!product) continue;

        if (product.variant?.length > 0) {
          product.variant[0].stock += item.quantity;
        } else {
          product.stock += item.quantity;
        }

        await product.save();
      }

      order.status = "Returned";
      order.returnedAt = new Date();
      order.refundAmount = refundAmount;
      order.refundMethod = "wallet";
      await order.save();

      return res.status(Status.OK).json({
        success: true,
        message: `Return approved. ₹${refundAmount.toFixed(2)} added to wallet.`
      });
    }

    // Reject return
    order.status = "Delivered";
    order.returnRejectedAt = new Date();
    await order.save();

    return res.status(Status.OK).json({
      success: true,
      message: "Return request rejected."
    });

  } catch (error) {
    console.error("Error processing return request:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.SERVER_ERROR
    });
  }
};

export {
  loadOrders,
  loadOrderDetails,
  updateOrderStatus,
  approveOrRejectReturnRequest,
};