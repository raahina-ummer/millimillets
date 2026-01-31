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
import { calculateOrderTotals } from "../../Helpers/orderTotal.js";
import logger from '../../utils/logger.js';

dotenv.config();


const loadOrderDetails = async (req, res) => {
  try {

    if (!req.session.user || !req.session.user.id) {
      return res.redirect("/login");
    }

    const { orderId } = req.params;
    const userId = req.session.user.id;

   
    const user = await User.findById(userId);
    if (!user) {
      req.session.destroy();
      return res.redirect("/login");
    }

    const order = await Order.findOne({ userId, orderId })
      .populate("userId", "name email phone")
      .populate({
        path: "orderedProducts.product",
        select: "productName productImage",
      })
      .lean();

   
    if (!order) {
      return res.redirect("/p-404");
    }
    order.itemDiscount = order.itemDiscount || 0;
    order.shippingCost = order.shippingCost || 0;
    order.walletUsed = order.walletUsed || 0;
    order.paymentStatus = order.paymentStatus || 'Pending';


   
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
// Handle deleted + active products
if (order.orderedProducts.length > 0) {
  order.orderedProducts = order.orderedProducts.map(item => {

    // Deleted product
    if (!item.product) {
      return {
        ...item,
        product: {
          productName: item.productNameSnapshot || "Product Unavailable",
          productImage: item.productImageSnapshot || ["/default-product.jpg"],
        },
        unitTypeSnapshot: item.unitTypeSnapshot || "N/A",
        productRefId: item.product,   
      };
    }

    // Active product
    return {
      ...item,
      product: {
        _id: item.product._id,        
        productName: item.product.productName,
        productImage: item.product.productImage,
      },
      unitTypeSnapshot: item.unitTypeSnapshot || "N/A",
    };
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
      created: formatDate(order.createdAt),
      processed: formatDate(order.processedAt),
      shipped: formatDate(order.shippedAt),
      delivered: formatDate(order.deliveredAt),
      cancelled: formatDate(order.cancelledAt),
      returned: formatDate(order.returnedAt),
    };
const originalSubtotal = order.orderedProducts.reduce(
  (sum, item) => sum + (item.price * item.quantity),
  0
);

const activeItemsTotal = order.orderedProducts
  .filter(item => !['Cancelled', 'Returned'].includes(item.status))
  .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const activeCouponUsed = order.couponApplied && originalSubtotal > 0
  ? (activeItemsTotal / originalSubtotal) * order.couponDiscount
  : 0;

 order.summary = {
  subtotal: activeItemsTotal,
  couponDiscount: Math.round(activeCouponUsed),
  shipping: order.shippingCost || 0,
  grandTotal: Math.max(
    activeItemsTotal - activeCouponUsed + (order.shippingCost || 0),
    0
  )
};




console.log({
  couponApplied: order.couponApplied,
  couponCode: order.couponCode,
  couponDiscount: order.couponDiscount
});


    res.render("orderdetails", {
      order,
      user,
      title: `Order Details - ${order.orderId}`
    });

  } catch (error) {
    console.error("Error loading order details:", error);

    
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

   
    let searchQuery = { userId: userId };

    if (status) {
      searchQuery.status = status;
    }

    if (search) {
      searchQuery.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    let sortQuery = {};
    switch (sort) {
      case "date_desc":
        sortQuery = { createdAt: -1 };
        break;
      case "date_asc":
        sortQuery = { createdAt: 1 };
        break;
      case "amount_desc":
        sortQuery = { finalAmount: -1 };
        break;
      case "amount_asc":
        sortQuery = { finalAmount: 1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }

    const orders = await Order.find(searchQuery)
      .populate({ path: "orderedProducts.product",
        select: "productName productImage",
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

      // Snapshot handling (unchanged logic)
      order.orderedProducts = order.orderedProducts.map(item => {
        if (!item.product) {
          return {
            ...item,
            product: {
              productName: item.productNameSnapshot || "Product Unavailable",
              productImage: item.productImageSnapshot || ["/default-product.jpg"],
            },
            unitTypeSnapshot: item.unitTypeSnapshot || "N/A",
          };
        }

        return {
          ...item,
          product: {
            productName: item.product.productName,
            productImage: item.product.productImage,
          },
          unitTypeSnapshot: item.unitTypeSnapshot || "N/A",
        };
      });
    });
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
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.GENERAL.SERVER_ERROR });
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

    if (["Shipped", "Delivered", "Cancelled", "Return Requested", "Returned"].includes(order.status)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.status}`,
      });
    }

  for (const item of order.orderedProducts) {
  if (!item.product || !item.variantId) continue;

  await Product.updateOne(
    {
      _id: item.product._id,
      "variant._id": item.variantId
    },
    {
      $inc: { "variant.$.stock": item.quantity }
    }
  );
}


    //  Update order status to Cancelled
    order.status = "Cancelled";
    order.cancellationReason = reason || "Cancelled by user";
    await order.save();



    //  after cancellation, refund to wallet - online payment
    if (order.paymentMethod === "Razorpay" || order.paymentMethod === "Online") {
      const refundAmount = order.orderedProducts.reduce(
  (sum, item) =>
    sum + (item.price * item.quantity - (item.couponShare || 0)),
  0
);


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
        ? `Order cancelled successfully. ₹${refundAmount} credited to your wallet`
        : "Order cancelled successfully!"
    });

  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR
    });
  }
};

const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, productId, variantId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.status(Status.NOT_FOUND).json({ success: false, message:"Order not found" });
    }

    const item = order.orderedProducts.find(
      (i) =>
        i.product &&
        i.product._id.toString() === productId.toString() &&
        i.variantId?.toString() === variantId.toString()
    );
    if (!item) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Product not found in order" });
    }

    
    if (item.status === "Cancelled") {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "This item is already cancelled"
      });
    }

    if (!["Pending", "Processing"].includes(order.status)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Cannot cancel item after shipping or delivery"
      });
    }


    const product = await Product.updateOne(
      { _id: productId, "variant._id": item.variantId },
      { $inc: { "variant.$.stock": item.quantity } }
    );


    item.status = "Cancelled";
    item.cancelReason = reason || "Cancelled by user";
    item.cancelledAt = new Date();

 const itemSaleValue = item.price * item.quantity;
const refundAmount = Math.max(
  itemSaleValue - (item.couponShare || 0),
  0
);



    const allItemsCancelled = order.orderedProducts.every(
      (i) => i.status === "Cancelled"
    );

    
    if (allItemsCancelled) {
      order.status = "Cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = "All items cancelled";
      order.finalAmount = 0;
    } else {

     order.finalAmount = Math.max(
  order.finalAmount - refundAmount,
  0
);


    }

    // Refund to wallet for online payments
    if (order.paymentMethod === "Razorpay" || order.paymentMethod === "Online" || order.paymentMethod === "Wallet") {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: 0,
          transactions: []
        });
      }

      let totalRefund = refundAmount;


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
      ? "All items cancelled. Order has been cancelled."
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
      message: message.GENERAL.SERVER_ERROR
    });
  }
};

const returnOrderItem = async (req, res) => {
  try {
    const { orderId, productId,variantId } = req.params;
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


    if (!reason || reason.trim() === "") {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Return reason is required"
      });
    }

    const productIndex = order.orderedProducts.findIndex(
  item =>
    item.product &&
    item.product._id.toString() === productId.toString() &&
    item.variantId?.toString() === variantId.toString()
);

    if (productIndex === -1) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Product not found in this order"
      });
    }

    const productItem = order.orderedProducts[productIndex];
if (productItem.status !== "Delivered") {
  return res.status(Status.BAD_REQUEST).json({
    success: false,
    message: "Return is only allowed for delivered products"
  });
}


    if (
  productItem.status === "Returned" ||
  productItem.status === "Return Requested"
) {
  return res.status(Status.BAD_REQUEST).json({
    success: false,
    message: "Return request already submitted for this product"
  });
}

    

productItem.status = "Return Requested";
productItem.returnReason = reason;
productItem.returnRequestedAt = new Date();

const allReturned = order.orderedProducts.every(
  item => item.status === "Returned"
);

order.status = allReturned ? "Returned" : "Partially Returned";


    await order.save({ validateModifiedOnly: true });

    res.status(Status.OK).json({
      success: true,
      message: "Return request submitted successfully"

    });

  } catch (error) {
    console.error("Error submitting return:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};




//   return all pendingrequests (admin)
const getPendingReturns = async (req, res) => {
  try {
    const returns = await Order.find({ status: "Return Requested" })
      .populate("userId", "name email")
      .populate("orderedProducts.product", "productName")
      .sort({ "orderedProducts.returnRequestedAt": -1 });


    res.status(Status.OK).json({
      success: true,
      data: returns
    });
  } catch (error) {
    console.error("Error fetching returns:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderId, userId });

    if (!order) {
      return res.status(Status.NOT_FOUND).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.status !== "Delivered") {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Invoice is only available for delivered orders"
      });
    }

    if (!order.invoiceSnapshot) {
      return res.status(400).json({
        success: false,
        message: "Invoice not generated yet"
      });
    }

    const invoice = order.invoiceSnapshot;
    const user = await User.findById(userId);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=MilliMillet-Invoice-${order.orderId}.pdf`
    );

    doc.pipe(res);

    /* HEADER */
    doc.fontSize(24).text("MilliMillet", { align: "center" });
    doc.fontSize(10).text("Tax Invoice", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(12)
      .text(`Invoice Date: ${new Date(order.InvoiceDate).toLocaleDateString()}`, { align: "right" })
      .text(`Order ID: ${order.orderId}`, { align: "right" });

    doc.moveDown();

    /* BILL TO */
    doc.fontSize(14).text("Bill To:", { underline: true });
    doc.fontSize(11)
      .text(`Name: ${user.name}`)
      .text(`Email: ${user.email}`);

    if (order.address) {
      doc.text(`Address: ${order.address.addressLine1}`);
      if (order.address.addressLine2) {
        doc.text(`         ${order.address.addressLine2}`);
      }
      doc.text(`         ${order.address.city}, ${order.address.state} - ${order.address.pincode}`);
      doc.text(`Phone: ${order.address.mobile}`);
    }

    doc.moveDown(2);

    /* TABLE HEADER */
    const tableTop = doc.y;
    doc.fontSize(10)
      .text("Item", 50, tableTop, { width: 200 })
      .text("Qty", 280, tableTop, { width: 50 })
      .text("Price", 350, tableTop, { width: 80 })
      .text("Amount", 450, tableTop, { width: 80 });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    /* ITEMS */
    let y = tableTop + 25;

    invoice.items.forEach(item => {
      doc.fontSize(10)
        .text(item.name, 50, y, { width: 200 })
        .text(item.quantity, 280, y)
        .text(`₹${item.price.toFixed(2)}`, 350, y)
        .text(`₹${item.total.toFixed(2)}`, 450, y);

      y += 22;
    });

    y += 10;
    doc.moveTo(350, y).lineTo(550, y).stroke();
    y += 10;

    /* TOTALS */
    doc.fontSize(11)
      .text("Subtotal:", 350, y)
      .text(`₹${invoice.subtotal}`, 450, y, { align: "right" });

    y += 18;

    if (invoice.couponDiscount > 0) {
      doc.text("Coupon Discount:", 350, y)
        .text(`-₹${invoice.couponDiscount}`, 450, y, { align: "right" });
      y += 18;
    }

    doc.fontSize(13)
      .text("Total Amount:", 350, y, { bold: true })
      .text(`₹${invoice.finalAmount}`, 450, y, { align: "right", bold: true });

    doc.moveDown(2);

    doc.fontSize(9)
      .text("Thank you for your order!", 50, doc.page.height - 100, { align: "center" });

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

    return res.status(Status.OK).json({
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
      message: message.GENERAL.SERVER_ERROR
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
      message: message.GENERAL.SERVER_ERROR
    });
  }
};

const createRetryOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { orderId } = req.body;

    if (!userId || !orderId) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.AUTH.USER_NOT_LOGGED_IN
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
      message: message.GENERAL.SERVER_ERROR
    });
  }
};




const verifyPayment = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.AUTH.SESSION_EXPIRED
      });
    }

    const { paymentResponse } = req.body;
    if (!paymentResponse) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.PAYMENT.INVALID_DATA
      });
    }

    const order = await verifyRazorpayPaymentService({
      paymentResponse,
      userId
    });

    return res.status(200).json({
      success: true,
      message: message.PAYMENT.SUCCESS,
      orderId: order.orderId
    });

  } catch (error) {
    console.error("Payment Verification Error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR
    });
  }
};


export {
  loadOrderDetails,
  loadOrder,
  cancelEntireOrder,
  cancelOrderItem,
  returnOrderItem,
  getPendingReturns,
  downloadInvoice,
  verifyPayment,
  createRazorpayOrder,
  placeCodOrder,
  createRetryOrder,
  
};