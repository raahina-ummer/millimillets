import Cart from "../models/CartSchema.js";
import Order from "../models/OrderSchema.js";
import Product from "../models/ProductSchema.js";
import Address from "../models/AddressSchema.js";
import crypto from "crypto";
import { razorpay } from "../utils/razorpay.js";
import { calculateTotals } from "../utils/calculateTotals.js";
import { v4 as uuidv4 } from "uuid";
import {isValidCartItem, resolveVariant } from "../Helpers/cartHelper.js"
import { calculateOrderTotals } from "../Helpers/orderTotal.js";



export const placeCodOrderService = async ({ userId, addressId }) => {

  const userAddress = await Address.findOne({ userId });
  if (!userAddress) throw new Error("Address not found");

  const selectedAddress = userAddress.addresses.find(
    addr => addr._id.toString() === addressId
  );
  if (!selectedAddress) throw new Error("Invalid address");

  const cart = await Cart.findOne({ userId }).populate({
    path: "products.productId",
    populate: "category"
  });

  if (!cart || cart.products.length === 0) {
    throw new Error("Cart is empty");
  }

  const validItems = cart.products.filter(isValidCartItem);
  if (validItems.length === 0) {
    throw new Error("No valid items in cart");
  }

  // 🔒 SOURCE OF TRUTH
  const {
    saleTotal,
    couponDiscount,
    shipping,
    finalAmount
  } = calculateOrderTotals(validItems, cart.couponDiscount || 0);

  // COD LIMIT
  if (finalAmount > 1000) {
    const err = new Error("COD_LIMIT_EXCEEDED");
    err.isBusinessError = true;
    throw err;
  }

  // ================= COUPON SHARE FREEZE =================
  let remainingCoupon = couponDiscount;

  const orderedProducts = validItems.map((item, index) => {
    const itemTotal = item.price * item.quantity;
    let couponShare = 0;

    if (couponDiscount > 0 && saleTotal > 0) {
      if (index === validItems.length - 1) {
        couponShare = remainingCoupon;
      } else {
        couponShare = Math.round(
          (itemTotal / saleTotal) * couponDiscount
        );
        remainingCoupon -= couponShare;
      }
    }

    return {
      product: item.productId._id,
      productNameSnapshot: item.productId.productName,
      productImageSnapshot: item.productId.productImage?.[0],
      variantId: item.variantId,
      variantName: resolveVariant(item.productId, item.variantId)?.unitType,
      price: item.price,
      quantity: item.quantity,
      couponShare,
      status: "Processing"
    };
  });
  // =======================================================

  const order = new Order({
    orderId: "ORD" + Date.now() + uuidv4().slice(0, 6),
    userId,

    orderedProducts,

    totalPrice: saleTotal,
    couponDiscount,
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

  // 🧾 INVOICE SNAPSHOT (TRUSTED)
  order.invoiceSnapshot = {
    items: validItems.map(item => ({
      name: item.productId.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity
    })),
    subtotal: saleTotal,
    couponDiscount,
    shipping,
    finalAmount
  };

  order.invoiceNumber = order.orderId;

  await order.save();

  // 📉 REDUCE STOCK ONCE
  for (const item of validItems) {
    await Product.updateOne(
      {
        _id: item.productId._id,
        "variant._id": item.variantId,
        "variant.stock": { $gte: item.quantity }
      },
      { $inc: { "variant.$.stock": -item.quantity } }
    );
  }

  // 🧹 CLEAR CART
  await Cart.findOneAndUpdate(
    { userId },
    {
      products: [],
      couponApplied: false,
      couponCode: null,
      couponDiscount: 0
    }
  );

  return { orderId: order.orderId };
};


export const createRazorpayOrderService = async ({ userId, addressId }) => {

  const userAddress = await Address.findOne({ userId });
  if (!userAddress) throw new Error("Address not found");

  const selectedAddress = userAddress.addresses.find(
    addr => addr._id.toString() === addressId
  );
  if (!selectedAddress) throw new Error("Invalid address");

  const cart = await Cart.findOne({ userId }).populate({
    path: "products.productId",
    populate: "category"
  });

  if (!cart || cart.products.length === 0) {
    throw new Error("Cart is empty");
  }

  const validItems = cart.products.filter(isValidCartItem);
  if (validItems.length === 0) {
    throw new Error("No valid items in cart");
  }

  const couponDiscount = cart.couponApplied ? cart.couponDiscount : 0;

  const {
    saleTotal,
    couponDiscount: finalCouponDiscount,
    shipping,
    finalAmount
  } = calculateOrderTotals(validItems, couponDiscount);

  if (!finalAmount || finalAmount < 1) {
    throw new Error("Invalid order amount");
  }

  const receiptId = "ORD" + Date.now() + uuidv4().slice(0, 6);

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(finalAmount * 100),
    currency: "INR",
    receipt: receiptId,
    payment_capture: 1
  });

  // ================= COUPON SHARE FREEZE =================
  let remainingCoupon = finalCouponDiscount;

  const orderedProducts = validItems.map((item, index) => {
    const itemTotal = item.price * item.quantity;
    let couponShare = 0;

    if (finalCouponDiscount > 0 && saleTotal > 0) {
      if (index === validItems.length - 1) {
        couponShare = remainingCoupon;
      } else {
        couponShare = Math.round(
          (itemTotal / saleTotal) * finalCouponDiscount
        );
        remainingCoupon -= couponShare;
      }
    }

    return {
      product: item.productId._id,
      productNameSnapshot: item.productId.productName,
      productImageSnapshot: item.productId.productImage?.[0],
      variantId: item.variantId,
      variantName: resolveVariant(item.productId, item.variantId)?.unitType,
      price: item.price,
      quantity: item.quantity,
      couponShare,
      status: "Pending"
    };
  });
  // =======================================================

  // ✅ NOW create Order properly
  const order = new Order({
    orderId: receiptId,
    userId,

    orderedProducts,               // ✅ FIXED

    totalPrice: saleTotal,
    couponDiscount: finalCouponDiscount,
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

  order.invoiceSnapshot = {
    items: validItems.map(item => ({
      name: item.productId.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity
    })),
    subtotal: saleTotal,
    couponDiscount: finalCouponDiscount,
    shipping,
    finalAmount
  };

  order.invoiceNumber = order.orderId;

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

  //  Prevent double verification
  if (order.paymentStatus === "Completed") {
    return order;
  }

  // Verify Razorpay signature
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(
      paymentResponse.razorpay_order_id + "|" +
      paymentResponse.razorpay_payment_id
    )
    .digest("hex");

  if (generatedSignature !== paymentResponse.razorpay_signature) {
    order.paymentStatus = "Failed";
    order.status = "Payment Failed";
    await order.save();
    throw new Error("Invalid payment signature");
  }

  // Lock amount
  order.amountPaid = order.finalAmount;

  // Payment success
  order.paymentStatus = "Completed";
  order.status = "Processing";
  order.razorpayPaymentId = paymentResponse.razorpay_payment_id;
  order.razorpaySignature = paymentResponse.razorpay_signature;

  order.orderedProducts.forEach(item => {
    item.status = "Processing";
  });

  await order.save();

  // Reduce stock ONCE
  for (const item of order.orderedProducts) {
    await Product.updateOne(
  {
    _id: item.product,
    "variant._id": item.variantId,
    "variant.stock": { $gte: item.quantity }
  },
  { $inc: { "variant.$.stock": -item.quantity } }
);

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
