import Cart from "../../models/CartSchema.js";
import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import User from "../../models/userSchema.js";
import OrderHistory from "../../models/OrderHistorySchema.js";
import Order from "../../models/OrderSchema.js";
import Wallet from "../../models/WalletSchema.js"; // NEW
import PDFDocument from "pdfkit";
import fs from "fs";
import dotenv from "dotenv";
import crypto from "crypto"; // FIX #1: Added crypto import
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import { razorpay } from "../../utils/razorpay.js";
import Address from "../../models/AddressSchema.js";

dotenv.config();

const loadOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;
    const user = await User.findById(userId);

    const order = await Order.findOne({ userId, orderId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.redirect("/p-404");
    }

    res.render("orderdetails", { order, user });
  } catch (error) {
    console.error(error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

// const loadOrder = async (req, res) => {
//   try {
//     const userId = req.session.user.id;
//     const user = await User.findById(userId);
//     let search = req.query.search || "";
//     const limit = 4;
//     let page = parseInt(req.query.page) || 1;
//     let skip = (page - 1) * limit;
    
//     const status = req.query.status || "";
//     const sort = req.query.sort || "date_desc";

//     let searchQuery = { userId: userId };

//     if (search) {
//       searchQuery.$or = [
//         { orderId: { $regex: search, $options: "i" } },
//         { status: { $regex: search, $options: "i" } },
//       ];
//     }

//     const orders = await Order.find(searchQuery)
//       .populate({ path: "orderedProducts.product" })
//       .sort({ createdOn: -1 })
//       .skip(skip)
//       .limit(limit);

//     const totalOrders = await Order.countDocuments(searchQuery);
//     const totalPages = Math.ceil(totalOrders / limit);

//     res.render("order", {
//       user,
//       orders,
//       currentPage: page,
//       totalPages,
//       hasNextPage: page < totalPages,
//       hasPrevPage: page > 1,
//       search,
//       totalOrders,
//       status,
//       sort,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(Status.INTERNAL_SERVER_ERROR).json({ message: error.message });
//   }
// };


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
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

const createOrder = async (req, res) => {
  try {

    console.log("CreateOrder INVOCKED")

    //       const razorpay = new Razorpay({
    //   key_id: process.env.RAZORPAY_KEY_ID,
    //   key_secret: process.env.RAZORPAY_SECRET
    // });

    const { amount } = req.body;
    

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
      payment_capture: 1



    });
    console.log("RAZORPAY ORDER:", order);
    res.json({ success: true, key: process.env.RAZORPAY_KEY_ID, order });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};

const cancelEntireOrder = async (req, res) => {
  try {
    console.log("cancelEntireOrder");
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;

    console.log("Cancelling order:", orderId, "for user:", userId);

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      console.log("Order not found");
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Order not found" });
    }

    console.log("Current order status:", order.status);

    if (["Shipped", "Delivered", "Canceled", "Return Request", "Returned"].includes(order.status)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.status}`,
      });
    }

    // Restore product stock for each item
    for (const item of order.orderedProducts) {
      if (!item.product) {
        console.log("Product not found in order item");
        continue;
      }

      console.log(`Restoring stock for product ${item.product._id}: +${item.quantity}`);

      const product = await Product.findById(item.product._id);

      if (product) {
        if (product.variant && product.variant.length > 0) {
          product.variant[0].stock += item.quantity;
        } else if (product.stock !== undefined) {
          product.stock += item.quantity;
        }

        await product.save();
        console.log(`Stock restored for ${product.productName}`);
      } else {
        console.log(`Product ${item.product._id} not found in database`);
      }
    }

    order.status = "Canceled";
    order.cancellationReason = reason || "Cancelled by user";
    await order.save();

    console.log("Order cancelled successfully");

    return res.status(Status.OK).json({
      success: true,
      message: "Order cancelled successfully. Stock has been restored."
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred while cancelling the order. Please try again."
    });
  }
};

const cancelOrderItem = async (req, res) => {
  try {
    console.log("WHY??? WHy???");
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

    if (["Shipped", "Delivered", "Canceled"].includes(order.status)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Cannot cancel item after shipping or delivery"
      });
    }

    const product = await Product.findById(productId);
    if (product) {
      if (product.variant && product.variant.length > 0) {
        product.variant[0].stock += item.quantity;
      } else if (product.stock !== undefined) {
        product.stock += item.quantity;
      }
      await product.save();
    }

    item.status = "Cancelled";
    item.cancelReason = reason || "Cancelled by user";

    order.totalPrice -= item.price * item.quantity;
    order.finalAmount = order.totalPrice - order.discount;

    await order.save();

    res.status(Status.OK).json({
      success: true,
      message: "Item cancelled successfully and stock restored"
    });
  } catch (error) {
    console.error("Error cancelling item:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again."
    });
  }
};


const returnOrderItem = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;

    console.log("Return request for order:", orderId);

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.status !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Return is only allowed for delivered orders",
      });
    }

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Return reason is required",
      });
    }

    // Update order status to Return Request
    order.status = "Return Request";
    order.returnReason = reason;
    await order.save();

    res.json({
      success: true,
      message: "Return request submitted successfully. We'll process it soon."
    });
  } catch (error) {
    console.error("Error submitting return:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again."
    });
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
        description: `Refund for returned order ${orderId}`,
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
      await order.save();

      return res.status(200).json({
        success: true,
        message: `Return approved. ₹${refundAmount} credited to wallet.`
      });

    } else {
      order.status = "Delivered";
      order.returnRejectedReason = notes || "";
      await order.save();

      return res.status(200).json({
        success: true,
        message: "Return request rejected."
      });
    }

  } catch (error) {
    console.error("Error verifying return:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while processing the return."
    });
  }
};


// const verifyReturnRequest = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { approved, notes } = req.body; 

//     const order = await Order.findOne({ orderId })
//       .populate("orderedProducts.product");

//     if (!order) {
//       return res.status(Status.NOT_FOUND).json({ 
//         success: false, 
//         message: "Order not found" 
//       });
//     }

//     if (order.status !== "Return Request") {
//       return res.status(Status.BAD_REQUEST).json({
//         success: false,
//         message: "Order is not in return request status"
//       });
//     }

//     if (approved) {
//       // Process refund to wallet
//       let wallet = await Wallet.findOne({ userId: order.userId });

//       if (!wallet) {
//         wallet = new Wallet({
//           userId: order.userId,
//           balance: 0,
//           transactions: []
//         });
//       }

//       ;
//       wallet.balance += order.finalAmount;
//       wallet.transactions.push({
//         type: "credit",
//         amount: order.finalAmount,
//         reason: `Refund for returned order ${orderId}`,
//         date: new Date()
//       });

//       await wallet.save();

//       // Restore stock
//       for (const item of order.orderedProducts) {
//         if (!item.product) continue;

//         const product = await Product.findById(item.product._id);
//         if (product) {
//           if (product.variant && product.variant.length > 0) {
//             product.variant[0].stock += item.quantity;
//           } else if (product.stock !== undefined) {
//             product.stock += item.quantity;
//           }
//           await product.save();
//         }
//       }

//       order.status = "Returned";
//       order.returnApprovedDate = new Date();
//       order.returnAdminNotes = notes || "";
//       await order.save();

//       return res.status(Status.OK).json({
//         success: true,
//         message: `Return approved. ₹${refundAmount} credited to wallet.`
//       });
//     } else {
//       // Reject return
//       order.status = "Delivered"; // Back to delivered
//       order.returnRejectedReason = notes || "";
//       await order.save();

//       return res.status(Status.OK).json({
//         success: true,
//         message: "Return request rejected."
//       });
//     }
//   } catch (error) {
//     console.error("Error verifying return:", error);
//     res.status(Status.INTERNAL_SERVER_ERROR).json({
//       success: false,
//       message: "An error occurred while processing return."
//     });
//   }
// };

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
      message: "An error occurred."
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

const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    const userId = req.user._id;

    if (!addressId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Address and payment method are required",
      });
    }

    const userAddress = await Address.findOne({ userId });
    if (!userAddress) return res.status(400).send("Invalid Request");

    const selectedAddress = userAddress.addresses.find(
      (addr) => addr._id.toString() === addressId
    );
    if (!selectedAddress) return res.status(400).send("Please add a valid address");

    // if (paymentMethod !== "cod") {
    //   return res.status(Status.BAD_REQUEST).json({sucess:false,message:"Only Cash on Delivery is available"});
    // }

    const cart = await Cart.findOne({ userId }).populate({
      path: "products.productId",
      populate: "category",
    });

    if (!cart || cart.products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty or not found",
      });
    }

    //  Check stock and prices using product.variant[0]
    const validCartItems = cart.products.filter((item) => {
      const product = item.productId;
      const variant = product.variant?.[0];
      return (
        product &&
        variant &&
        !product.isBlocked &&
        product.category?.isListed &&
        variant.stock >= item.quantity
      );
    });

    if (validCartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid items in cart",
      });
    }

    let subtotal = 0;
    let totalDiscount = 0;
    const orderItems = [];

    for (const item of validCartItems) {
      const product = item.productId;
      const variant = product.variant?.[0];

      const regularPrice = variant.regularPrice;
      const salePrice = variant.salePrice;
      const discountAmount = regularPrice - salePrice;
      const totalPrice = salePrice * item.quantity;

      subtotal += regularPrice * item.quantity;
      totalDiscount += discountAmount * item.quantity;

      orderItems.push({
        productId: product._id,
        productName: product.productName,
        quantity: item.quantity,
        price: salePrice,
        totalPrice: totalPrice,
        productImage: product.productImage[0] || null,
        regularPrice,
        discountAmount,
        category: product.category,
      });

      // Update product stock immediately (COD)
      await Product.findByIdAndUpdate(product._id, {
        $inc: { "variant.0.stock": -item.quantity },
      });
    }

    const shipping = subtotal >= 1000 ? 0 : 50;
    const finalAmount = subtotal - totalDiscount + shipping;

    const orderId =
      "ORD" +
      Date.now() +
      Math.random().toString(36).substr(2, 5).toUpperCase();

    const newOrder = new Order({
      orderId,
      userId,
      orderedProducts: orderItems.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice: subtotal,
      discount: totalDiscount,
      finalAmount,
      address: selectedAddress,
      status: "Pending",
      createdOn: new Date(),
    });

    await newOrder.save();

    //  Clear cart after successful order
    await Cart.findOneAndUpdate(
      { userId },
      {
        $set: {
          products: [],
          couponApplied: false,
          couponCode: null,
          couponDiscount: 0,
        },
      }
    );

    return res.json({
      success: true,
      message: "Order placed successfully",
      orderId,
      totalAmount: finalAmount,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// // Verify Razorpay Payment
// const verifyPayment = async (req, res) => {
//   try {
//     const { paymentResponse, orderId } = req.body;

//     const generatedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_SECRET)
//       .update(paymentResponse.razorpay_order_id + "|" + paymentResponse.razorpay_payment_id)
//       .digest("hex");

//     if (generatedSignature !== paymentResponse.razorpay_signature) {
//       // Payment verification failed - Update order status
//       await Order.findOneAndUpdate(
//         { orderId }, 
//         {
//           paymentStatus: "Failed",
//           status: "Payment Failed"
//         }
//       );
//       return res.json({ success: false, message: "Payment verification failed!" });
//     }

//     // Payment verified successfully
//     const order = await Order.findOne({ orderId }).populate('orderedProducts.product');

//     if (!order) {
//       return res.json({ success: false, message: "Order not found" });
//     }

//     // Update order status
//     order.paymentStatus = "Paid";
//     order.status = "Processing";
//     order.razorpayOrderId = paymentResponse.razorpay_order_id;
//     order.paymentId = paymentResponse.razorpay_payment_id;
//     await order.save();

//     // Reduce stock
//     for (let item of order.orderedProducts) {
//       const product = await Product.findById(item.product);
//       if (product) {
//         if (product.variant && product.variant.length > 0) {
//           product.variant[0].stock -= item.quantity;
//         } else if (product.stock !== undefined) {
//           product.stock -= item.quantity;
//         }
//         await product.save();
//       }
//     }

//     // Clear cart and coupon
//     await Cart.findOneAndUpdate(
//       { userId: req.session.user.id },
//       { products: [] }
//     );
//     delete req.session.appliedCoupon;

//     return res.json({
//       success: true,
//       message: "Payment verified and order updated",
//       orderId
//     });

//   } catch (error) {
//     console.error("Payment Verification Error:", error);
//     res.status(500).json({ success: false, message: "Server error while verifying payment" });
//   }
// };



const verifyPayment = async (req, res) => {
  try {
    const { paymentResponse, orderId } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (!userId) {
      return res.status(401).json({ success: false, message: "Session expired" });
    }

    console.log("PAYMENT RESPONSE : : : : : : ", paymentResponse, orderId)
    if (!paymentResponse || !orderId) {
      return res.json({ success: false, message: "Invalid payment data" });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(paymentResponse.razorpay_order_id + "|" + paymentResponse.razorpay_payment_id)
      .digest("hex");

    console.log(generatedSignature)

    if (generatedSignature !== paymentResponse.razorpay_signature) {
      await Order.findOneAndUpdate(
        { orderId },
        {
          paymentStatus: "Failed",
          status: "Payment Failed"
        }
      );
      return res.json({ success: false, message: "Payment verification failed!" });
    }


    const order = await Order.findOne({ orderId }).populate('orderedProducts.product');

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }


    // update payment info
    order.paymentStatus = "Paid";
    order.status = "Processing";
    order.razorpayOrderId = paymentResponse.razorpay_order_id;
    order.paymentId = paymentResponse.razorpay_payment_id;
    await order.save();

    // Clear cart
    await Cart.findOneAndUpdate(
      { userId },
      {
        products: [],
        couponApplied: false,
        couponCode: null,
        couponDiscount: 0
      }
    );

    delete req.session.appliedCoupon;

    return res.json({
      success: true,
      message: "Payment verified successfully",
      orderId
    });

  } catch (error) {
    console.log("Payment Verification Error:", error);
    return res.status(500).json({ success: false, message: "Server error while verifying payment" });
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
  createOrder,
  placeOrder,
};