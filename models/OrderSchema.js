import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema } = mongoose;

const orderSchema = new Schema(
  {
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
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variantId: { type: Schema.Types.ObjectId, required: true },
        productNameSnapshot: String,
        productImageSnapshot: String,

        price: Number,
        quantity: Number,
        variantName: String,
        status: {
          type: String,
          enum: [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled",
            "Returned",
            "Return Requested",
            "Partially Returned",
            "Partially Delivered"
          ],
          default: "Pending",
        },
        cancelReason: String,
        shippedAt: Date,
        deliveredAt: Date,
        cancelledAt: Date,
        cancelledBy: String,
        returnReason: String,
        returnedAt: Date,
        couponShare: { type: Number, default: 0 },

        refundProcessed: {
          type: Boolean,
          default: false,
        },
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
    couponDiscount: { type: Number, default: 0 },
    couponMinPurchase: { type: Number, default: 0 },
    couponMaxDiscount: { type: Number, default: 0 },
    couponPercent: { type: Number, default: 0 },

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
        "Cancelled",
        "Return Requested",
        "Partially Returned",
        "Returned",
        "Partially Delivered",
        "Pending Payment",
        "Payment Failed",
        "Completed",
      ],
      default: "Pending",
    },

    processedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    returnedAt: Date,
    returnRequestedAt: Date,
    returnRejectedAt: Date,
    cancellationReason: String,
    returnReason: String,
    returnRejectedReason: String,

    refundAmount: { type: Number, default: 0 },
    refundMethod: {
      type: String,
      enum: ["wallet", "bank", null],
      default: null,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Refunded"],
      default: "Pending",
    },
    refundStatus: {
      type: String,
      enum: ["None", "Pending", "Completed", "Failed"],
      default: "None",
    },
    refundDate: {
      type: Date,
      default: null,
    },
    amountToPay: {
      type: Number,
      default: 0,
    },
    returnStatus: {
      type: String,
      enum: ["None", "Requested", "Approved", "Rejected"],
      default: "None",
    },
    returnRequestDate: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },

    walletUsed: {
      type: Number,
      default: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    InvoiceDate: Date,
    invoiceNumber: String,
    invoiceSnapshot: {
      items: [
        {
          name: String,
          quantity: Number,
          price: Number,
          couponShare: Number,
          total: Number,
        },
      ],
      subtotal: Number,
      discount: Number,
      couponDiscount: Number,
      shipping: Number,
      finalAmount: Number,
    },
  },
  { timestamps: true },
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
