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





const loadCheckOut = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const wallet = await Wallet.findOne({ userId });
const walletBalance = wallet ? wallet.balance : 0;



    const cart = await Cart.findOne({ userId }).populate({
      path: "products.productId",
      select: "productName productImage variant category isBlocked status",
      populate: {
        path: "category",
        select: "name isListed",
      }, 
    });

        if (!cart || cart.products.length === 0) {
      return res.redirect("/cart");
    }

    let address = await Address.findOne({ userId });

    if (!address) {
      address = new Address({ userId, addresses: [] });
      await address.save();
    }

    const user = await User.findById(userId);

    if (!cart || !cart.products || cart.products.length === 0) {
      return res.render("checkout", {
        user,
        cart: { products: [] },
        addresses: address.addresses,
        subtotal: 0,
        saletotal: 0,
        discount: 0,
        couponDiscount: 0,
        tax: 0,
        shipping: 0,
        total: 0,
        itemCount: 0,
        availableCoupons: [],
        appliedCoupon: null,
        walletBalance: walletBalance
      });
    }

    //  Filter available products
    const filterCart = cart.products.filter(product => {
  const item = product.productId;
  if (!item || item.isBlocked) return false;

  if (!Array.isArray(item.variant)) return false;

  let variant = null;

  if (product.variantId) {
    variant = item.variant.find(
      v => v._id?.toString() === product.variantId.toString()
    );
  }

 
  if (!variant && item.variant.length > 0) {
    variant = item.variant[0];
  }

  if (!variant) return false;

  return (
      item.category?.isListed &&
  variant.stock > 0 &&
  !item.isBlocked
  
  );
});

    let subtotal = 0;
    let saletotal = 0;
    let discount = 0;

    filterCart.forEach(product => {
  const item = product.productId;
  if (!item || !Array.isArray(item.variant)) return;

  let variant = null;

  if (product.variantId) {
    variant = item.variant.find(
      v => v._id?.toString() === product.variantId.toString()
    );
  }

  if (!variant && item.variant.length > 0) {
    variant = item.variant[0];
  }

  if (!variant) return;

  // auto-fix old cart items
  if (!product.variantId) {
    product.variantId = variant._id;
    product.unitType = variant.unitType;
  }

 const quantity = Number(product.quantity) || 1;

// USE STORED CART PRICE (OFFER-LOCKED)
const price = Number(product.price) || 0;

saletotal += price * quantity;
const regularPrice = Number(variant.regularPrice) || price;

subtotal += regularPrice * quantity;
discount += Math.max(regularPrice - price, 0) * quantity;



  product.selectedVariant = variant;
  product.variantName = variant.unitType;

});


    cart.products = filterCart;
    await cart.save();

//Apply Coupon if exists

let couponDiscount = 0;

if (cart.couponApplied && cart.couponCode) {
  const coupon = await Coupon.findOne({ code: cart.couponCode });

  const isInvalid =
    !coupon ||
    !coupon.isActive ||
    (coupon.expiresAt && coupon.expiresAt < new Date()) ||
    (coupon.minAmount && saletotal < coupon.minAmount);

  if (isInvalid) {

    cart.couponApplied = false;
    cart.couponCode = null;
    cart.couponDiscount = 0;
    await cart.save();
  } else {
    couponDiscount = Math.min(cart.couponDiscount, saletotal);
  }
}


const tax = 0;
const shipping = saletotal === 0 ? 0 : saletotal >= 1000 ? 0 : 50;

const total = Math.max(
  saletotal - couponDiscount + shipping + tax,
  0
);


   return res.render("checkout", {
  user,
  cart: { products: filterCart },
  addresses: address.addresses,
  subtotal,
  saletotal,
  discount,
  couponDiscount,
  tax,
  shipping,
  total,
  itemCount: filterCart.length,
  availableCoupons: [],
  appliedCoupon: cart.couponApplied ? cart.couponCode : null,
   walletBalance: walletBalance,
});

  } catch (error) {
    console.error("Error loading checkout page:", error);
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.GENERAL.SERVER_ERROR});
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

