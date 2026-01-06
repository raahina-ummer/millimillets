import Cart from "../../models/CartSchema.js";
import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import User from "../../models/userSchema.js";
import OrderHistory from "../../models/OrderHistorySchema.js";
import Order from "../../models/OrderSchema.js";
import Wallet from "../../models/WalletSchema.js"; 
import PDFDocument from "pdfkit";
import fs from "fs";
import dotenv from "dotenv";
import crypto from "crypto"; 
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import { razorpay } from "../../utils/razorpay.js";
import Address from "../../models/AddressSchema.js";
import { placeCodOrderService } from "../../Services/orderService.js";
import { createRazorpayOrderService } from "../../Services/orderService.js";
import { retryRazorpayOrderService } from "../../Services/orderService.js";
import { verifyRazorpayPaymentService } from "../../Services/orderService.js";
import logger from '../../utils/logger.js';

dotenv.config();


const loadOrderDetails = async (req, res) => {
  try {

    if (!req.session.user || !req.session.user.id) {
      return res.redirect("/login");
    }

    const { orderId } = req.params;
    const userId = req.session.user.id;

    // Fetch user
    const user = await User.findById(userId);
    if (!user) {
      req.session.destroy();
      return res.redirect("/login");
    }

    // Fetch order with populated fields
    const order = await Order.findOne({ userId, orderId })
      .populate("userId", "name email phone")
      .populate({
        path: "orderedProducts.product",
        select: "productName productImage salePrice regularPrice description category variant stock",
      })
      .lean();

    // Check if order exists
    if (!order) {
      return res.redirect("/p-404");
    }
    order.itemDiscount = order.itemDiscount || 0;
    order.shippingCost = order.shippingCost || 0;
    order.walletUsed = order.walletUsed || 0;
    order.paymentStatus = order.paymentStatus || 'Pending';


   // ADDRESS NORMALIZATION
if (order.address) {
  order.address = {
    addressType: order.address.addressType || "home",
    name: order.address.name || "Recipient",
    mobile: order.address.mobile || "N/A",
    addressLine1: order.address.addressLine1 || "",
    addressLine2: order.address.addressLine2 || "",
    city: order.address.city || "",
    state: order.address.state || "",
    country: order.address.country || "",
    pincode: order.address.pincode || ""
  };
}


    // Handle deleted products
    if (order.orderedProducts && order.orderedProducts.length > 0) {
      order.orderedProducts = order.orderedProducts.map(item => {
        if (!item.product) {
          return {
            ...item,
            product: {
              productName: item.productNameSnapshot || 'Product Unavailable',
              productImage: item.productImageSnapshot || ['/default-product.jpg'],
              salePrice: item.price,
            }
          };
        }
        return item;
      });
    }

    // Format dates for display
    const formatDate = (date) => {
      return date ? new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A';
    };

    order.formattedDates = {
      created: formatDate(order.createdOn),
      processed: formatDate(order.processedAt),
      shipped: formatDate(order.shippedAt),
      delivered: formatDate(order.deliveredAt),
      cancelled: formatDate(order.cancelledAt),
      returned: formatDate(order.returnedAt),
    };

    // Render the page
    res.render("orderdetails", {
      order,
      user,
      title: `Order Details - ${order.orderId}`
    });

  } catch (error) {
    console.error("Error loading order details:", error);

    // Check if headers already sent
    if (res.headersSent) {
      return;
    }

    return res.status(Status.INTERNAL_SERVER_ERROR).render("error", {
      message: "Error loading order details",
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};



const loadOrder = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findById(userId);
    let search = req.query.search || "";
    const limit = 4;
    let page = parseInt(req.query.page) || 1;
    let skip = (page - 1) * limit;

    const status = req.query.status || "";
    const sort = req.query.sort || "date_desc";

    // Build search query
    let searchQuery = { userId: userId };

    // Add status filter
    if (status) {
      searchQuery.status = status;
    }

    // Add search filter
    if (search) {
      searchQuery.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    let sortQuery = {};
    switch (sort) {
      case "date_desc":
        sortQuery = { createdOn: -1 };
        break;
      case "date_asc":
        sortQuery = { createdOn: 1 };
        break;
      case "amount_desc":
        sortQuery = { finalAmount: -1 };
        break;
      case "amount_asc":
        sortQuery = { finalAmount: 1 };
        break;
      default:
        sortQuery = { createdOn: -1 };
    }

    const orders = await Order.find(searchQuery)
      .populate({ path: "orderedProducts.product" })
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("order", {
      user,
      orders,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      search,
      totalOrders,
      status,
      sort,
    });
  } catch (error) {
    console.error(error);
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};



const cancelEntireOrder = async (req, res) => {
  try {
    console.log("cancelEntireOrder");
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Order not found" });
    }

    if (["Shipped", "Delivered", "Canceled", "Return Request", "Returned"].includes(order.status)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.status}`,
      });
    }

    // Restore stock first
    for (const item of order.orderedProducts) {
      if (!item.product) continue;

      const product = item.product;
      if (product) {
        if (product.variant && product.variant.length > 0) {
          product.variant[0].stock += item.quantity;
        } else if (product.stock !== undefined) {
          product.stock += item.quantity;
        }
        await product.save();
        console.log(`Stock restored for ${product.productName}`);
      }
    }

    //  Update order status to Canceled
    order.status = "Cancelled";
    order.cancellationReason = reason || "Cancelled by user";
    await order.save();



    //  after cancellation, refund to wallet - online payment
    if (order.paymentMethod === "Razorpay" || order.paymentMethod === "Online") {
      const refundAmount = order.finalAmount;

      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
      }

      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: "credit",
        amount: refundAmount,
        reason: "Order cancelled - Refund",
        orderId: order.orderId,
        date: new Date()
      });
      await wallet.save();

      console.log(" Wallet refund completed. New balance:", wallet.balance);
    }

    return res.status(Status.OK).json({
      success: true,
      message: order.paymentMethod === "Razorpay"
        ? `Order cancelled successfully. ₹${order.finalAmount} credited to your wallet`
        : "Order cancelled successfully!"
    });

  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:message.SERVER_ERROR
    });
  }
};

const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Order not found" });
    }

    const item = order.orderedProducts.find(
      (i) => i.product && i.product._id.toString() === productId
    );

    if (!item) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Product not found in order" });
    }

    // Check if item is already cancelled
    if (item.status === "Cancelled") {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "This item is already cancelled"
      });
    }

    // Can only cancel if order is Pending or Processing
    if (!["Pending", "Processing"].includes(order.status)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Cannot cancel item after shipping or delivery"
      });
    }

    // Restore stock
    const product = await Product.findById(productId);
    if (product) {
      if (product.variant && product.variant.length > 0) {
        product.variant[0].stock += item.quantity;
      } else if (product.stock !== undefined) {
        product.stock += item.quantity;
      }
      await product.save({ validateModifiedOnly: true });
    }

    // Mark item as cancelled
    item.status = "Cancelled";
    item.cancelReason = reason || "Cancelled by user";
    item.cancelledAt = new Date();

    const refundAmount = item.price * item.quantity;

    // Check if ALL items are now cancelled
    const allItemsCancelled = order.orderedProducts.every(
      (i) => i.status === "Cancelled"
    );

    // If ALL items cancelled, update order status to Canceled
    if (allItemsCancelled) {
      order.status = "Canceled";
      order.cancelledAt = new Date();
      order.cancelledBy = "user";
      order.cancellationReason = "All items cancelled";

      // Set final amount to 0 if all cancelled
      order.finalAmount = 0;
    } else {
      // If some items still active, recalculate order totals
      order.totalPrice -= refundAmount;
      order.finalAmount = Math.max(0, order.totalPrice - order.discount - (order.itemDiscount || 0) + (order.shippingCost || 0));
    }

    // Refund to wallet for online payments
    if (order.paymentMethod === "Razorpay" || order.paymentMethod === "Online" || order.paymentMethod === "Wallet") {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
      }

      let totalRefund = refundAmount;

      // If all items cancelled, also refund shipping
      if (allItemsCancelled && order.shippingCost > 0) {
        totalRefund += order.shippingCost;
      }

      wallet.balance += totalRefund;
      wallet.transactions.push({
        type: "credit",
        amount: totalRefund,
        reason: allItemsCancelled
          ? `Full refund - Order ${order.orderId} cancelled`
          : `Refund for cancelled item - Order ${order.orderId}`,
        orderId: order.orderId,
        date: new Date()
      });
      await wallet.save();
    }

    await order.save({ validateModifiedOnly: true });

    const message = allItemsCancelled
      ? "All items cancelled. Order has been canceled."
      : "Item cancelled successfully";

    const refundMessage = (order.paymentMethod === "Razorpay" || order.paymentMethod === "Online" || order.paymentMethod === "Wallet")
      ? ` ₹${refundAmount} refunded to wallet.`
      : "";

    res.status(Status.OK).json({
      success: true,
      message: message + refundMessage,
      allCancelled: allItemsCancelled
    });

  } catch (error) {
    console.error("Error cancelling item:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.SERVER_ERROR
    });
  }
};

const returnOrderItem = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;

    console.log("Return request for order:", orderId, "product:", productId);

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.status !== "Delivered") {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Return is only allowed for delivered orders"
      });
    }

    if (!reason || reason.trim() === "") {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Return reason is required"
      });
    }

    // Find the specific product in the order
    const productIndex = order.orderedProducts.findIndex(
      item => item.product._id.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Product not found in this order"
      });
    }

    // Check if product is already returned or return requested
    if (order.orderedProducts[productIndex].status === "Returned" ||
      order.orderedProducts[productIndex].status === "Return Request") {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Return request already submitted for this product"
      });
    }

    // Calculate refund amount for this product
    const product = order.orderedProducts[productIndex];
    const refundAmount = product.price * product.quantity;

    // Update the specific product's status to Returned
    order.orderedProducts[productIndex].status = "Returned";
    order.orderedProducts[productIndex].returnReason = reason;
    order.orderedProducts[productIndex].returnedAt = new Date();

    // Check if all products are returned
    const allReturned = order.orderedProducts.every(
      item => item.status === "Returned"
    );

    let totalRefund = refundAmount;

    // If all items returned, also refund shipping cost
    if (allReturned && order.shippingCost > 0) {
      totalRefund += order.shippingCost;
      order.status = "Returned";
      order.returnReason = reason;
    } else {
      // If partial return, keep order as Delivered
      order.status = "Delivered";
    }

    // Process wallet refund
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] });
    }

    wallet.balance += totalRefund;
    wallet.transactions.push({
      type: "credit",
      amount: totalRefund,
      reason: allReturned
        ? `Full refund - Order ${order.orderId} returned`
        : `Refund for returned item - Order ${order.orderId}`,
      orderId: order.orderId,
      date: new Date()
    });

    await wallet.save();
    await order.save({ validateModifiedOnly: true });

    res.Status(Status.OK).json({
      success: true,
      message: `Product returned successfully. ₹${totalRefund} has been credited to your wallet.`
    });

  } catch (error) {
    console.error("Error submitting return:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};


//  Admin  verify  return requests
const verifyReturnRequest = async (req, res) => {
  try {

    const { orderId } = req.params;
    const { approved, notes } = req.body;

    const order = await Order.findOne({ orderId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Return Request") {
      return res.status(400).json({ success: false, message: "Order is not in return request status" });
    }

    if (approved) {

      const refundAmount = order.finalAmount;


      const refundUserId = order.userId?._id || order.userId;

      let wallet = await Wallet.findOne({ userId: refundUserId });
      if (!wallet) {
        wallet = await Wallet.create({
          userId: refundUserId,
          balance: 0,
          transactions: []
        });
      }

      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: "credit",
        amount: refundAmount,
        reason: `Refund for returned order ${orderId}`,
        orderId: orderId,
        date: new Date(),
      });

      await wallet.save();
      // Restore stock
      for (const item of order.orderedProducts) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { stock: item.quantity }
        });
      }

      order.status = "Returned";
      order.returnApprovedDate = new Date();
      order.returnAdminNotes = notes || "";
      await order.save({ validateModifiedOnly: true })

      return res.status(Status.OK).json({
        success: true,
        message: `Return approved. ₹${refundAmount} credited to wallet.`
      });

    } else {
      order.status = "Delivered";
      order.returnRejectedReason = notes || "";
      await order.save({ validateModifiedOnly: true });

      return res.status(Status.OK).json({
        success: true,
        message: "Return request rejected."
      });
    }

  } catch (error) {
    console.error("Error verifying return:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:message.SERVER_ERROR
    });
  }
};


//   return all pendingrequests (admin)
const getPendingReturns = async (req, res) => {
  try {
    const returns = await Order.find({ status: "Return Request" })
      .populate("userId", "name email")
      .populate("orderedProducts.product", "productName")
      .sort({ returnRequestDate: -1 });

    res.status(Status.OK).json({
      success: true,
      data: returns
    });
  } catch (error) {
    console.error("Error fetching returns:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.SERVER_ERROR
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.status(Status.NOT_FOUND).json({
        succes: false,
        message: "Order not found"
      });
    }

    if (order.status !== "Delivered") {
      return res.status(Status.BAD_REQUEST).json({
        succes: false,
        message: "Invoice is only available for delivered orders"
      });
    }

    const user = await User.findById(userId);
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=MilliMillet-Invoice-${orderId}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(24).text("MilliMillet", { align: "center" });
    doc.fontSize(10).text("Tax Invoice", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(12).text(`Invoice Date: ${new Date().toLocaleDateString()}`, { align: "right" });
    doc.text(`Order ID: ${orderId}`, { align: "right" });
    doc.moveDown();

    doc.fontSize(14).text("Bill To:", { underline: true });
    doc.fontSize(11).text(`Name: ${user.name}`);
    doc.text(`Email: ${user.email}`);
    if (order.address) {
      doc.text(`Address: ${order.address.addressLine1}`);
      if (order.address.addressLine2) {
        doc.text(`         ${order.address.addressLine2}`);
      }
      doc.text(`         ${order.address.city}, ${order.address.state} - ${order.address.pincode}`);
      doc.text(`Phone: ${order.address.mobile}`);
    }
    doc.moveDown(2);

    doc.fontSize(12).text("Order Details:", { underline: true });
    doc.moveDown();

    const tableTop = doc.y;
    doc.fontSize(10)
      .text("Item", 50, tableTop, { width: 200 })
      .text("Qty", 280, tableTop, { width: 50 })
      .text("Price", 350, tableTop, { width: 80 })
      .text("Amount", 450, tableTop, { width: 80 });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    doc.moveDown();

    let yPosition = doc.y + 5;
    order.orderedProducts.forEach((item, i) => {
      const productName = item.product ? item.product.productName : "Product";
      const itemTotal = item.price * item.quantity;

      doc.fontSize(10)
        .text(productName, 50, yPosition, { width: 200 })
        .text(item.quantity, 280, yPosition, { width: 50 })
        .text(`₹${item.price.toFixed(2)}`, 350, yPosition, { width: 80 })
        .text(`₹${itemTotal.toFixed(2)}`, 450, yPosition, { width: 80 });

      yPosition += 25;
    });

    doc.moveDown(2);
    yPosition = doc.y;

    doc.moveTo(350, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 10;

    doc.fontSize(11)
      .text("Subtotal:", 350, yPosition)
      .text(`₹${order.totalPrice.toFixed(2)}`, 450, yPosition, { align: "right" });

    yPosition += 20;

    if (order.discount > 0) {
      doc.text("Discount:", 350, yPosition)
        .text(`-₹${order.discount.toFixed(2)}`, 450, yPosition, { align: "right" });
      yPosition += 20;
    }

    doc.fontSize(13)
      .text("Total Amount:", 350, yPosition, { bold: true })
      .text(`₹${order.finalAmount.toFixed(2)}`, 450, yPosition, { align: "right", bold: true });

    yPosition += 10;
    doc.moveTo(350, yPosition).lineTo(550, yPosition).stroke();

    doc.fontSize(9)
      .text(
        "Thank you for your order!",
        50,
        doc.page.height - 100,
        { align: "center" }
      );

    doc.end();
  } catch (error) {
    console.error("Invoice error:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).send("Error generating invoice");
  }
};

//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^//

const placeCodOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { addressId } = req.body;

    if (!userId || !addressId) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.NOT_FOUND
      });
    }

    const result = await placeCodOrderService({ userId, addressId });

    return res.status(Status.OK) .json({
      success: true,
      message: message.ORDER_PLACED_SUCCESSFULLY,
      orderId: result.orderId
    });

  } catch (error) {
    console.error("COD Order Error:", error);

      if (error.isBusinessError && error.message === "COD_LIMIT_EXCEEDED") {
    return res.status(Status.BAD_REQUEST).json({
      success: false,
      message: "Cash on Delivery is available only for orders up to ₹1000"
    });
  }

    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.SERVER_ERROR
    });
  }
};



const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { addressId } = req.body;

    if (!userId || !addressId) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.NOT_FOUND
      });
    }

    const result = await createRazorpayOrderService({ userId, addressId });

    return res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      order: result.razorpayOrder,
      orderId: result.orderId,
      amount: result.amount
    });

  } catch (error) {
    console.error("Create Razorpay Order Error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.SERVER_ERROR
    });
  }
};

const createRetryOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { orderId } = req.body;

    if (!userId || !orderId) {
      return res.status(400).json({
        success: false,
        message: "Invalid request"
      });
    }

    const result = await retryRazorpayOrderService({ userId, orderId });

    return res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      order: result.razorpayOrder
    });

  } catch (error) {
    console.error("Retry Razorpay Error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.SERVER_ERROR
    });
  }
};




const verifyPayment = async (req, res) => {
  try {
    console.log(" verifyPayment controller HIT");

    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Session expired"
      });
    }

    const { paymentResponse } = req.body;
    if (!paymentResponse) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Invalid payment data"
      });
    }

    //  CALL SERVICE AND STORE RETURNED ORDER
    const order = await verifyRazorpayPaymentService({
      paymentResponse,
      userId
    });

    console.log("Payment verified for order:", order.orderId);

    return res.status(Status.OK).json({
      success: true,
      message: "Payment verified successfully",
      orderId: order.orderId
    });

  } catch (error) {
    console.error("Payment Verification Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Payment verification failed"
    });
  }
};





export {
  loadOrderDetails,
  loadOrder,
  cancelEntireOrder,
  cancelOrderItem,
  returnOrderItem,
  verifyReturnRequest,
  getPendingReturns,
  downloadInvoice,
  verifyPayment,
  createRazorpayOrder,
  placeCodOrder,
  createRetryOrder,
};