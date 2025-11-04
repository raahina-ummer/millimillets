import mongoose from "mongoose";
const { Schema } = mongoose;

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    productImage: {
      type: [String],
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Available", "Out of Stock", "Discontinued"],
      default: "Available",
      required: true,
    },
    gst: {
      type: String,
      required: true,
    },
    variant: [
      {
        unitType: {
          type: String,
          required: true,
        },
        stock: {
          type: Number,
          required: true,
        },
        regularPrice: {
          type: Number,
          required: true,
        },
        salePrice: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
