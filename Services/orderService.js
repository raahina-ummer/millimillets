import Cart from "../models/CartSchema.js";
import Order from "../models/OrderSchema.js";
import Product from "../models/ProductSchema.js";
import Address from "../models/AddressSchema.js";
import crypto from "crypto";
import { razorpay } from "../utils/razorpay.js";
import { calculateTotals } from "../utils/calculateTotals.js";
import { v4 as uuidv4 } from "uuid";

export const placeCodOrderService = async ({ userId, addressId }) => {

  //  Address validation
  const userAddress = await Address.findOne({ userId });
  if (!userAddress) throw new Error("Address not found");

  const selectedAddress = userAddress.addresses.find(
    addr => addr._id.toString() === addressId
  );
  if (!selectedAddress) throw new Error("Invalid address");

  //  Cart validation
  const cart = await Cart.findOne({ userId }).populate({
    path: "products.productId",
    populate: "category"
  });

  if (!cart || cart.products.length === 0) {
    throw new Error("Cart is empty");
  }

  //  Validate products
  const validItems = cart.products.filter(item => {
    const product = item.productId;
    const variant = product.variant?.[0];
    return (
      product &&
      variant &&
      !product.isBlocked &&
      product.category?.isListed &&
      variant.stock >= item.quantity
    );
  });

  if (validItems.length === 0) {
    throw new Error("No valid items in cart");
  }

  //  calculate totals
  const {
  subtotal,
  productDiscount,
  saleTotal,
  finalAmount,
  shipping
} = calculateTotals(validItems, cart.couponDiscount || 0);


  //cod not allowed above 1000rs
 if (finalAmount > 1000) {
  const err = new Error("COD_LIMIT_EXCEEDED");
  err.isBusinessError = true;
  throw err;
}

  //  Reduce stock (COD → immediate)
  for (const item of validItems) {
    await Product.findByIdAndUpdate(item.productId._id, {
      $inc: { "variant.0.stock": -item.quantity }
    });
  }


  // create order
  const order = new Order({
    orderId: "ORD" + Date.now() + uuidv4().slice(0, 6),
    userId,

    orderedProducts: validItems.map(item => ({
      product: item.productId._id,
      productNameSnapshot: item.productId.productName,
      productImageSnapshot: item.productId.productImage?.[0],
      variantName: item.productId.variant?.[0]?.unitType || "Default",
      quantity: item.quantity,
      price: item.productId.variant?.[0]?.salePrice,
      status: "Processing"
    })),

    totalPrice: subtotal,
    discount: productDiscount,
    couponDiscount: cart.couponDiscount || 0,
    shippingCost: shipping,
    finalAmount,

    paymentMethod: "COD",
    paymentStatus: "Pending",
    status: "Processing",
    amountPaid: 0,
address: {
  addressType: selectedAddress.addressType,

  
  name: `${selectedAddress.firstName} ${selectedAddress.lastName}`,
  mobile: Number(selectedAddress.phone),

 
  addressLine1: selectedAddress.address,
  addressLine2: "",

  city: selectedAddress.city,
  state: selectedAddress.state,
  country: selectedAddress.country,
  pincode: selectedAddress.pinCode
},



    couponApplied: cart.couponApplied || false,
    couponCode: cart.couponCode || null
  });

  await order.save();

  //  Clear cart
  await Cart.findOneAndUpdate(
    { userId },
    {
      $set: {
        products: [],
        couponApplied: false,
        couponCode: null,
        couponDiscount: 0
      }
    }
  );

  return { orderId: order.orderId };
};




export const createRazorpayOrderService = async ({ userId, addressId }) => {

  // Validate address
  const userAddress = await Address.findOne({ userId });
  if (!userAddress) throw new Error("Address not found");

  const selectedAddress = userAddress.addresses.find(
    addr => addr._id.toString() === addressId
  );
  if (!selectedAddress) throw new Error("Invalid address");

  //  Validate cart
  const cart = await Cart.findOne({ userId }).populate({
  path: "products.productId",
  populate: { path: "category" }
});

  if (!cart || cart.products.length === 0) {
    throw new Error("Cart is empty");
  }

  //  Validate products
const validItems = cart.products.filter(item => {
  const product = item.productId;
  const variant = product?.variant?.[0];

  return (
    product &&
    variant &&
    !product.isBlocked &&
    product.status === "Available" &&
    variant.stock >= item.quantity
  );
});

const couponDiscount =
  cart.couponApplied ? cart.couponDiscount : 0;
  //  Calculate final amount DIRECTLY from cart items
const {
  subtotal,
  productDiscount,
  saleTotal,
  shipping,
  finalAmount
} = calculateTotals(validItems, couponDiscount || 0);


// const couponDiscount = cart.couponApplied ? cart.couponDiscount : 0;
// const shipping = subtotal >= 1000 ? 0 : 50;
// const finalAmount = subtotal - couponDiscount + shipping;

console.log("RAZORPAY TOTAL DEBUG:", {
  subtotal,
  productDiscount,
  couponDiscount,
  shipping,
  finalAmount
});


if (!finalAmount || finalAmount < 1) {
  throw new Error("Invalid order amount");
}

  //  Create Razorpay order
  const receiptId = "ORD" + Date.now() + uuidv4().slice(0, 6);

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(finalAmount * 100),
    currency: "INR",
    receipt: receiptId,
    payment_capture: 1
  });

  // Save order in DB (Pending Payment)
  const order = new Order({
    orderId: receiptId,
    userId,

    orderedProducts: validItems.map(item => ({
      product: item.productId._id,
      productNameSnapshot: item.productId.productName,
      productImageSnapshot: item.productId.productImage?.[0],
      variantName: item.productId.variant?.[0]?.unitType || "Default",
      quantity: item.quantity,
      price: item.productId.variant?.[0]?.salePrice,
      status: "Pending"
    })),

    totalPrice: subtotal,
    discount: productDiscount,
    couponDiscount: couponDiscount,
    shippingCost: shipping,
    finalAmount,

    paymentMethod: "Razorpay",
    paymentStatus: "Pending",
    status: "Pending Payment",
    amountPaid: 0,

    razorpayOrderId: razorpayOrder.id,

 address: {
  addressType: selectedAddress.addressType,

 
  name: `${selectedAddress.firstName} ${selectedAddress.lastName}`,
  mobile: Number(selectedAddress.phone),

  addressLine1: selectedAddress.address,
  addressLine2: "",

  city: selectedAddress.city,
  state: selectedAddress.state,
  country: selectedAddress.country,
  pincode: selectedAddress.pinCode
},



    couponApplied: cart.couponApplied || false,
    couponCode: cart.couponCode || null
  });

  await order.save();

  return {
    razorpayOrder,
    orderId: order.orderId,
    amount: finalAmount
  };
};

export const verifyRazorpayPaymentService = async ({
  paymentResponse,
  userId
}) => {

  const order = await Order.findOne({
    razorpayOrderId: paymentResponse.razorpay_order_id
  });

  if (!order) {
    throw new Error("Order not found");
  }

  //Verify Razorpay signature
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(
      paymentResponse.razorpay_order_id + "|" +
      paymentResponse.razorpay_payment_id
    )
    .digest("hex");

    console.log("VERIFY DEBUG:", {
  dbRazorpayOrderId: order.razorpayOrderId,
  frontendRazorpayOrderId: paymentResponse.razorpay_order_id,
  paymentId: paymentResponse.razorpay_payment_id,
  receivedSignature: paymentResponse.razorpay_signature
});


  if (generatedSignature !== paymentResponse.razorpay_signature) {
    order.paymentStatus = "Failed";
    order.status = "Payment Failed";
    await order.save();
    throw new Error("Invalid payment signature");
  }

  // Lock amount
  order.amountPaid = order.finalAmount;



  //Payment success
  order.paymentStatus = "Completed";
  order.status = "Processing";
  order.razorpayPaymentId = paymentResponse.razorpay_payment_id;
  order.razorpaySignature = paymentResponse.razorpay_signature;

  order.orderedProducts.forEach(item => {
    item.status = "Processing";
  });

  await order.save();

  // Reduce stock
  for (const item of order.orderedProducts) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { "variant.0.stock": -item.quantity }
    });
  }

  // Clear cart
  await Cart.findOneAndUpdate(
    { userId },
    {
      products: [],
      couponApplied: false,
      couponCode: null,
      couponDiscount: 0
    }
  );

  return order;
};

export const retryRazorpayOrderService = async ({ userId, orderId }) => {

  const order = await Order.findOne({ orderId, userId });
  if (!order) throw new Error("Order not found");

  //  Allow retry only for unpaid orders
  if (
    order.paymentStatus === "Completed" ||
    order.status !== "Pending Payment"
  ) {
    throw new Error("Payment retry not allowed for this order");
  }

  const receipt = `retry_${Date.now()}`;

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(order.finalAmount * 100),
    currency: "INR",
    receipt,
    payment_capture: 1
  });

  order.razorpayOrderId = razorpayOrder.id;
  await order.save();

  return { razorpayOrder };
};
