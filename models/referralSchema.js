import mongoose from "mongoose";
const { Schema } = mongoose;

const referralSchema = new Schema(
  {
    referrer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
    },
    referralToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredUsers: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        registeredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    couponGenerated: [
      {
        couponCode: {
          type: String,
        },
        discount: {
          type: Number, // percentage
        },
        maxUses: {
          type: Number,
          default: 1,
        },
        currentUses: {
          type: Number,
          default: 0,
        },
        expiryDate: {
          type: Date,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        generatedFor: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        generatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    referralSettings: {
      discountPercentage: {
        type: Number,
        default: 10, // 10% discount for referred user
      },
      referrerRewardPercentage: {
        type: Number,
        default: 5, // 5% discount coupon for referrer
      },
      maxRewardsPerReferrer: {
        type: Number,
        default: null, // null means unlimited
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for faster lookups
referralSchema.index({ referrer: 1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ referralToken: 1 });

const ReferralOffer = mongoose.model("ReferralOffer", referralSchema);
export default ReferralOffer;