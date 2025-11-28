import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema } = mongoose;

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  orderedProducts: [
    {
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      productNameSnapshot: String,
      productImageSnapshot: String,
      price: Number,
      quantity: Number,
      variantName: String,
    },
  ],

  totalPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  itemDiscount: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },

  couponApplied: { type: Boolean, default: false },
  couponCode: { type: String, default: null },

  paymentMethod: {
    type: String,
    enum: ["COD", "Razorpay", "Wallet", "Card", "UPI"],
    default: "Razorpay",
  },

  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,

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
    default: "Pending",
  },

  createdOn: { type: Date, default: Date.now },
  processedAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  returnedAt: Date,
  returnRequestedAt: Date,
  returnRejectedAt: Date,
  cancellationReason: String,
  returnReason: String,

  refundAmount: { type: Number, default: 0 },
  refundMethod: { type: String, enum: ["wallet", "bank", null], default: null },

  InvoiceDate: Date,
  invoiceNumber: String,
},{ timestamps: true });


const Order = mongoose.model("Order", orderSchema);
export default Order;