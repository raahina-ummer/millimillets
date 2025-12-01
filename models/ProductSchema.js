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



// Method to calculate final price with offers
productSchema.methods.calculateFinalPrice = function(variantIndex = 0) {
  const variant = this.variant[variantIndex];
  if (!variant) return 0;
  
  let finalPrice = variant.salePrice;
  
  if (this.productOffer.offerActive && this.productOffer.discountPercentage > 0) {
    // Check if offer is valid (date check)
    const now = new Date();
    const offerValid = (!this.productOffer.offerStartDate || this.productOffer.offerStartDate <= now) &&
                       (!this.productOffer.offerEndDate || this.productOffer.offerEndDate >= now);
    
    if (offerValid) {
      const offerDiscount = (variant.salePrice * this.productOffer.discountPercentage) / 100;
      const actualDiscount = this.productOffer.maxDiscountAmount 
        ? Math.min(offerDiscount, this.productOffer.maxDiscountAmount)
        : offerDiscount;
      
      finalPrice = variant.salePrice - actualDiscount;
    }
  }
  
  return Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
};

// Method to get discount percentage
productSchema.methods.getDiscountPercentage = function(variantIndex = 0) {
  const variant = this.variant[variantIndex];
  if (!variant) return 0;
  
  const finalPrice = this.calculateFinalPrice(variantIndex);
  const salePrice = variant.salePrice;
  
  if (finalPrice < salePrice) {
    return Math.round(((salePrice - finalPrice) / salePrice) * 100);
  }
  
  // If no offer, calculate discount from regular to sale price
  const regularPrice = variant.regularPrice;
  if (salePrice < regularPrice) {
    return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
  }
  
  return 0;
};

// Method to check if offer is currently valid
productSchema.methods.isOfferValid = function() {
  if (!this.productOffer.offerActive) return false;
  
  const now = new Date();
  const startValid = !this.productOffer.offerStartDate || this.productOffer.offerStartDate <= now;
  const endValid = !this.productOffer.offerEndDate || this.productOffer.offerEndDate >= now;
  
  return startValid && endValid;
};

// Virtual for total stock across all variants
productSchema.virtual('totalStock').get(function() {
  return this.variant.reduce((total, v) => total + v.stock, 0);
});

// Ensure virtuals are included when converting to JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// ============== CREATE MODEL HERE ============== //
const Product = mongoose.model("Product", productSchema);
export default Product;
