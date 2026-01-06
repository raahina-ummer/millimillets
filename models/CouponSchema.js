import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const CouponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    discountPercent: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    maxDiscountAmount: {
      type: Number,
      default: null,
    },

    minPurchaseAmount: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    onlyFor: {
      type: String,
      enum: ["all", "newUsers", "vipUsers", "specificUsers"],
      default: "all",
    },

    allowedUsers: [
      {
        type: Types.ObjectId,
        ref: "User",
      },
    ],

    usageLimitPerUser: {
      type: Number,
      default: 1,
    },

    totalUsageLimit: {
      type: Number,
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    usedBy: [
      {
        type: Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Coupon || mongoose.model("Coupon", CouponSchema);

