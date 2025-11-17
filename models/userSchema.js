import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: Number,
    required: false, // Optional for single signup
    unique: false,
    sparse: true,
    default: null,
  },
  dateOfBirth: {
    type: String, // Optional field
  },
  profileImage: {
    type: String,
  },
  googleId: {
    type: String,
    sparse: true,
    unique: false,
  },
  password: {
    type: String,
    required: false, // Optional for Google sign-in users
  },
  confirmPassword: {
    type: String,
    required: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false, // Default to regular user
  },
  cart: [
    {
      type: Schema.Types.ObjectId,
      ref: "Cart",
    },
  ],
  wallet: {
    type: Number,
    default: 0,
  },
  wishlist: [
    {
      type: Schema.Types.ObjectId,
      ref: "Wishlist",
    },
  ],
  orderHistory: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  createdOn: {
    type: Date,
    default: Date.now,
  },
  referralCode: {
    type: String,
  },
  redeemed: {
    type: Boolean,
  },
  redeemedUsers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  searchHistory: [
    {
      category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
      product: {
        type: String,
      },
      searchOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const User = mongoose.model("User", userSchema);
export default User;
