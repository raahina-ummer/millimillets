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

         variantId: { type: mongoose.Schema.Types.ObjectId ,required:false},
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
      },
    ],

    // Coupon fields
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
    
    // ADD THIS: Total amount after discount
    total: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;