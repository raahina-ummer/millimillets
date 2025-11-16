import Cart from "../../models/CartSchema.js";
import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import User from "../../models/userSchema.js";
import OrderHistory from "../../models/OrderHistorySchema.js";
import Order from "../../models/OrderSchema.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import dotenv from "dotenv";

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
    return res.json({ message: error.message });
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

    let searchQuery = { userId: userId };

    if (search) {
      searchQuery.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    const orders = await Order.find(searchQuery)
      .populate({ path: "orderedProducts.product" })
      .sort({ createdOn: -1 })
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
    });
  } catch (error) {
    console.error(error);
    return res.json({ message: error.message });
  }
};

// Cancel an entire order
const cancelEntireOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;

    console.log("Cancelling order:", orderId, "for user:", userId);

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      console.log("Order not found");
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    console.log("Current order status:", order.status);

    // Check if order can be cancelled
    if (["Shipped", "Delivered", "Canceled", "Return Request", "Returned"].includes(order.status)) {
      return res.status(400).json({
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
      
      // Find the product and update stock
      const product = await Product.findById(item.product._id);
      
      if (product) {
        // Check if variant exists and has stock field
        if (product.variant && product.variant.length > 0) {
          product.variant[0].stock += item.quantity;
        } else if (product.stock !== undefined) {
          // Fallback to direct stock field if no variants
          product.stock += item.quantity;
        }
        
        await product.save();
        console.log(`Stock restored for ${product.productName}`);
      } else {
        console.log(`Product ${item.product._id} not found in database`);
      }
    }

    // Update order status
    order.status = "Canceled";
    order.cancellationReason = reason || "Cancelled by user";
    await order.save();

    console.log("Order cancelled successfully");

    return res.json({ 
      success: true, 
      message: "Order cancelled successfully. Stock has been restored." 
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ 
      success: false, 
      message: "An error occurred while cancelling the order. Please try again." 
    });
  }
};

// Cancel a specific product in an order
const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    const item = order.orderedProducts.find(
      (i) => i.product && i.product._id.toString() === productId
    );

    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found in order" 
      });
    }

    if (["Shipped", "Delivered", "Canceled"].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot cancel item after shipping or delivery" 
      });
    }

    // Restore stock for this item
    const product = await Product.findById(productId);
    if (product) {
      if (product.variant && product.variant.length > 0) {
        product.variant[0].stock += item.quantity;
      } else if (product.stock !== undefined) {
        product.stock += item.quantity;
      }
      await product.save();
    }

    // Mark the item as cancelled
    item.status = "Cancelled";
    item.cancelReason = reason || "Cancelled by user";
    
    // Recalculate order totals if needed
    order.totalPrice -= item.price * item.quantity;
    order.finalAmount = order.totalPrice - order.discount;
    
    await order.save();

    res.json({ 
      success: true, 
      message: "Item cancelled successfully and stock restored" 
    });
  } catch (error) {
    console.error("Error cancelling item:", error);
    res.status(500).json({ 
      success: false, 
      message: "An error occurred. Please try again." 
    });
  }
};

// Return a delivered product
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

// Download Invoice (PDF)
const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderId, userId })
      .populate("orderedProducts.product");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    if (order.status !== "Delivered") {
      return res.status(400).send("Invoice is only available for delivered orders");
    }

    const user = await User.findById(userId);
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition", 
      `attachment; filename=MilliMillet-Invoice-${orderId}.pdf`
    );
    
    doc.pipe(res);

    // Header
    doc.fontSize(24).text("MilliMillet", { align: "center" });
    doc.fontSize(10).text("Tax Invoice", { align: "center" });
    doc.moveDown(2);

    // Order Details
    doc.fontSize(12).text(`Invoice Date: ${new Date().toLocaleDateString()}`, { align: "right" });
    doc.text(`Order ID: ${orderId}`, { align: "right" });
    doc.moveDown();

    // Customer Details
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

    // Products Table Header
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

    // Products
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

    // Summary
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

    // Footer
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
    res.status(500).send("Error generating invoice");
  }
};

export {
  loadOrderDetails,
  loadOrder,
  cancelEntireOrder,
  cancelOrderItem,
  returnOrderItem,
  downloadInvoice,
};