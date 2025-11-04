import mongoose from "mongoose";

const { Schema } = mongoose;

const addressSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  addresses: [
    {
      firstName: {
        type: String,
        required: true,
        trim: true,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        match: [/^\d{10}$/, "Phone number must be 10 digits"],
      },
      address: {
        type: String,
        required: true,
        trim: true,
      },
      pinCode: {
        type: Number,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      addressType: {
        type: String,
        enum: ["home", "work"],
        required: true,
      },
      isDefault: { type: Boolean, default: false },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
}, { timestamps: true });

const Address = mongoose.model("Address", addressSchema);
export default Address;
