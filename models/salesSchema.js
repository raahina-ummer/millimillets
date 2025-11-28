import mongoose from "mongoose";

const { Schema } = mongoose;

const salesSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    quantity: { type: Number, required: true },
    totalPrice: { type: Number, required: true },

    status: {
      type: String,
      enum: ["Pending", "Completed", "Canceled"],
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "Online", "Card", "UPI"],
      required: true,
    }
  },
  { timestamps: true } // auto adds createdAt & updatedAt
);

const Sales = mongoose.model("Sales", salesSchema);
export default Sales;
