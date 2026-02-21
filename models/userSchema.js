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
    type: String,
    sparse: true,
    default: null,
    match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"],
  },

  dateOfBirth: String,

  profileImage: String,

  googleId: {
    type: String,
    sparse: true,
  },

  password: {
    type: String,
  },

  isBlocked: {
    type: Boolean,
    default: false,
  },

  isAdmin: {
    type: Boolean,
    default: false,
  },

  cart: [
    {
      type: Schema.Types.ObjectId,
      ref: "Cart",
    },
  ],

 

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

 referredBy: {
  type: Schema.Types.ObjectId,
  ref: "User",
  default: null,
},


  referralCode: {
    type: String,
    unique: true,

  },

  redeemed: {
    type: Boolean,
    default: false,
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
      product: String,
      searchOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const User = mongoose.model("User", userSchema);
export default User;
