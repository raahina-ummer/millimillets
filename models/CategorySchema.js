import mongoose from "mongoose";

const { Schema } = mongoose;

const categorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    type: String,
  },
  isListed: {
    type: Boolean,
    default: true,
  },

  // 🔥 Correct category offer object
  categoryOffer: {
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    offerDescription: {
      type: String,
      default: null,
    },
    offerActive: {
      type: Boolean,
      default: false,
    },
    offerStartDate: {
      type: Date,
      default: null,
    },
    offerEndDate: {
      type: Date,
      default: null,
    },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Category = mongoose.model("Category", categorySchema);
export default Category;
