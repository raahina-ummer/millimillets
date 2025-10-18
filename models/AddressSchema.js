const mongoose = require("mongoose")
const {Schema} = mongoose;

const addressSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:trusted,
    },
    address:[{
        addressType:{
            type :String,
            required:true
        },
        name:{
            type:String,
            required:true
        },
        country:{
            type:String,
            required:true
        },
        state:{
            type:String,
            required:true,
        },
        city:{
            type:String,
            required:true,
        },
        pincode:{
            type:Number,
            required: true
        },
        mobile:{type:Number,
            required:true,
        },

    }]
})

const Address = moongoose.model("Address",addressSchema)
module.exports = Address;