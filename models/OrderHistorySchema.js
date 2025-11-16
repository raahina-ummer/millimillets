import mongoose from "mongoose";

const orderHistorySchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  eventType: {
    type: String,
    enum: ["created", "updated", "cancelled", "returned", "shipped", "delivered"],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Flexible field for additional data
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const OrderHistory = mongoose.model("OrderHistory", orderHistorySchema);
export default  OrderHistory;
