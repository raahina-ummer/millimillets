import mongoose from "mongoose";

const { Schema } = mongoose;

const cartSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
        },
        price: {
          type: Number,
          required: true,
          default: 0,
        },
        originalPrice: {
          type: Number,
          default: 0,
        },
        discount: {
          type: Number,
          default: 0,
        },
        totalPrice: {
          type: Number,
          required: true,
          default: 0,
        },
        status: {
          type: String,
          default: "Placed",
        },
        cancellationReason: {
          type: String,
          default: "none",
        },
      },
    ],

    //  add Coupon fields to cart
    couponApplied: {
      type: Boolean,
      default: false,
    },
    couponCode: {
      type: String,
      default: null,
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true } // Adds createdAt and updatedAt automatically
);

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;



