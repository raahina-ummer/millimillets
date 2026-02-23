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
      type: Number,
      required: true,
    },
    productOffer: {
      discountPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      maxDiscountAmount: {
        type: Number,
        default: null
      },
      offerDescription: {
        type: String,
        default: null
      },
      offerActive: {
        type: Boolean,
        default: false
      },
      offerStartDate: {
        type: Date,
        default: null
      },
      offerEndDate: {
        type: Date,
        default: null
      }
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
productSchema.index({ 'productOffer.offerActive': 1 });
productSchema.index({ 'productOffer.discountPercentage': -1 });
productSchema.index({ status: 1, isBlocked: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ productName: 'text', description: 'text' })




const Product = mongoose.model("Product", productSchema);
export default Product;
