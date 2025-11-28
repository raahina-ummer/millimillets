import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema } = mongoose;

const orderSchema = new Schema({
  // Unique Order ID
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },

  // User who placed the order
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Each product snapshot at the time of purchase
  orderedProducts: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      productNameSnapshot: String,  // Stores product name at time of order
      productImageSnapshot: String, // Stores image at time of order
      price: Number,                // Price at time of order
      quantity: Number,
      variantName: String,          // (Optional) If product has variants
    },
  ],

  // Pricing details
  totalPrice: {
    type: Number,
    required: true,
  },

  discount: {
    type: Number,
    default: 0,
  },

  // NEW FIELD - Safe to add
  itemDiscount: {
    type: Number,
    default: 0,
  },

  maxDiscount: {
    type: Number,
    default: 0,                      // Useful when coupon has max cap
  },

  // NEW FIELD - Safe to add
  tax: {
    type: Number,
    default: 0,
  },

  shippingCost: {
    type: Number,
    default: 0,              // ← Safe default value
  },


  finalAmount: {
    type: Number,
    required: true,
  },

  // Coupon details
  couponApplied: {
    type: Boolean,
    default: false,
  },
  couponCode: {
    type: String,
    default: null,
  },

  // NEW FIELD - Safe to add
  paymentMethod: {
    type: String,
    enum: ["COD", "Razorpay", "Wallet", "Card", "UPI"],
    default: "COD",
  },

  // Delivery address (snapshot)
  address: {
    addressType: String,
    name: String,
    country: String,
    state: String,
    city: String,
    pincode: Number,
    mobile: Number,
    addressLine1: String,
    addressLine2: String,
  },

  // Status fields
  status: {
    type: String,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Canceled",
      "Return Request",
      "Returned",
    ],
    required: true,
  },

  // Timestamps for each stage
  createdOn: {
    type: Date,
    default: Date.now,
  },
  processedAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  returnedAt: Date,
  returnRequestedAt: Date,

  // Reason fields (important for admin panel)
  cancellationReason: String,
  returnReason: String,

  // Refund / Wallet
  refundAmount: {
    type: Number,
    default: 0,
  },
  refundMethod: {
    type: String,
    enum: ["wallet", "bank", null],
    default: null,
  },

  // Invoice
  InvoiceDate: Date,
  invoiceNumber: String, // AUTO-GENERATED (optional)

});

const Order = mongoose.model("Order", orderSchema);
export default Order;