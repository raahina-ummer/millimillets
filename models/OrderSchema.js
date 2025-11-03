const mongoose = require("mongoose");
const {Schema} = mongoose;
const {v4:uuidv4} = require("uuid")

const orderSchema = new Schema({
    orderId :{
        type:String,
        default: ()=>uuidv4(),
        unique:true,
    },
        userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    orderedProducts:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            default:0
        }
    }],
    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
   address:{
        addressType: String,
        name: String,
        country: String,
        state: String,
        city: String,
        pincode: Number,
        mobile: Number,
        addressLine1: String,
        addressLine2: String
    },
    InvoiceDate:{
        type:Date
    },
    status:{
        type:String,
        required:true,
        enum : ["Pending","Processing","Shipped","Delivered","Canceled","Return Request","Returned"]
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false,
    }
})

const Order = mongoose.model("Order",orderSchema);
module.exports = Order;