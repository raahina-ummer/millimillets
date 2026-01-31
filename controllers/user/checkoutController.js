import Cart from "../../models/CartSchema.js";
import Address from "../../models/AddressSchema.js";
import Product from "../../models/ProductSchema.js";
import Order from "../../models/OrderSchema.js";
import User from "../../models/userSchema.js"; // 
import dotenv from "dotenv";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import Wallet from "../../models/WalletSchema.js";
import logger from '../../utils/logger.js';
import Coupon from "../../models/CouponSchema.js";
import { isValidCartItem } from "../../Helpers/cartHelper.js";
import { calculateTotals } from "../../utils/calculateTotals.js";





const loadCheckOut = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const wallet = await Wallet.findOne({ userId });
    const walletBalance = wallet ? Number(wallet.balance) : 0;

    const cart = await Cart.findOne({ userId }).populate({
      path: "products.productId",
      select: "productName productImage variant category isBlocked status",
      populate: {
        path: "category",
        select: "name isListed",
      },
    });

    if (!cart || !Array.isArray(cart.products) || cart.products.length === 0) {
      return res.redirect("/cart");
    }

    let address = await Address.findOne({ userId });
    if (!address) {
      address = await Address.create({ userId, addresses: [] });
    }

    const user = await User.findById(userId);

    const filteredProducts = cart.products.filter(item => {
      const product = item.productId;
      if (!product) return false;
      if (product.isBlocked) return false;
      if (!product.category?.isListed) return false;
      if (!Array.isArray(product.variant)) return false;

      const variant =
        product.variant.find(v => v._id?.toString() === item.variantId?.toString()) ||
        product.variant[0];

      if (!variant) return false;
      if (Number(variant.stock) <= 0) return false;

      return true;
    });

    if (filteredProducts.length === 0) {
      return res.redirect("/cart");
    }

    filteredProducts.forEach(item => {
      const product = item.productId;

      const variant =
        product.variant.find(v => v._id?.toString() === item.variantId?.toString()) ||
        product.variant[0];

      item.variantId = item.variantId || variant._id;
      item.unitType = item.unitType || variant.unitType;

      item.quantity = Number(item.quantity) || 1;
      item.price = Number(item.price) || 0;

      item.selectedVariant = variant;
      item.variantName = variant.unitType;
    });

    cart.products = filteredProducts;
    await cart.save();

    const initialTotals = calculateTotals(filteredProducts, 0);
    const saletotal = Number(initialTotals.saletotal) || 0;


    let couponDiscount = 0;

if (cart.couponApplied && cart.couponCode) {
  const coupon = await Coupon.findOne({ code: cart.couponCode });

  const invalidCoupon =
    !coupon ||
    !coupon.isActive ||
    (coupon.expiresAt && coupon.expiresAt < new Date()) ||
    (coupon.minPurchaseAmount && saletotal < coupon.minPurchaseAmount);

  if (invalidCoupon) {
    cart.couponApplied = false;
    cart.couponCode = null;
    cart.couponDiscount = 0;
    await cart.save();
  } else {
    couponDiscount = (saletotal * coupon.discountPercent) / 100;

    if (coupon.maxDiscountAmount !== null) {
      couponDiscount = Math.min(
        couponDiscount,
        coupon.maxDiscountAmount
      );
    }

    couponDiscount = Math.min(couponDiscount, saletotal);

    cart.couponDiscount = couponDiscount;
    await cart.save();
  }
}


    const finalTotals = calculateTotals(filteredProducts, couponDiscount);
    const shipping = Number(finalTotals.shipping) || 0;
    const tax = Number(finalTotals.tax) || 0;
    const finalAmount = Number(finalTotals.finalAmount) || 0;

    let subtotal = 0;
    let discount = 0;

    filteredProducts.forEach(item => {
      const regularPrice =
        Number(item.selectedVariant?.regularPrice) || item.price;

      subtotal += regularPrice * item.quantity;
      discount += Math.max(regularPrice - item.price, 0) * item.quantity;
    });console.log({
  saletotal,
  couponDiscount,
  shipping,
  tax,
  finalAmount
});

    return res.render("checkout", {
      user,
      cart: { products: filteredProducts },
      addresses: address.addresses,
      subtotal,
      saletotal,
      discount,
      couponDiscount,
      tax,
      shipping,
      total: finalAmount,
      itemCount: filteredProducts.length,
      availableCoupons: [],
      appliedCoupon: cart.couponApplied ? cart.couponCode : null,
      walletBalance,
    });
  } catch (error) {
    console.error("Error loading checkout page:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};


const loadOrderSuccess = async (req, res) => {
  try {
    console.log(req.query);
    const { orderId } = req.query;
    const userId = req.session.user.id;

   const user = await User.findById(userId);

    console.log(user);

    if (!orderId) {
      return res.redirect("/");
    }

   const order = await Order.findOne({ orderId })
  .populate({
    path: "orderedProducts.product",
    select: "productName productImage",
  })
 

    if (!order) {
      return res.redirect("/");
    }

    const tax = order.finalAmount * 0.05; 


    res.render("ordersuccess", {
      order,
      orderId: order.orderId,
      orderTotal: order.finalAmount,
      user,
      tax,
    });
  } catch (error) {
    console.error("Error loading order success:", error);
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.GENERAL.SERVER_ERROR});
  }
};


const loadOrderFailure = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const reason = req.query.reason || 'Payment failed';
    const orderId = req.query.orderId; 

    
    const user = await User.findById(userId);
    
    let order = null;
    if (orderId) {
      order = await Order.findOne({ orderId: orderId }).populate("orderedProducts.product");
      console.log("Order found:", order); 
    }

    res.render("orderfailure", { 
      user, 
      reason,
      order: order  
    });

  } catch (error) {
    console.error("Error loading failure page:", error);
    res.render("orderfailure", { 
      user: null, 
      reason: 'Payment failed',
      order: null
    });
  }
};




export {
  loadCheckOut,
  loadOrderSuccess,
 loadOrderFailure,
};

