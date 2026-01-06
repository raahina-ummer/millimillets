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
    const filterCart = cart.products.filter((product) => {
      const item = product.productId;
      if (!item) return false;

      const variant = item.variant && item.variant[0];
      if (!variant) return false;

      return (
        !item.isBlocked &&
        item.category &&
        item.category.isListed &&
        variant.stock > 0 &&
        item.status?.toLowerCase() !== "out of stock"
      );
    });

    let subtotal = 0;
    let saletotal = 0;
    let discount = 0;

    filterCart.forEach((product) => {
      const item = product.productId;
      const variant = item.variant && item.variant[0];

      const regularPrice =  variant.regularPrice;
      const salePrice = variant.salePrice;
      const quantity = product.quantity || 1;

const itemDiscount = regularPrice - salePrice;
  const itemTotalPrice = salePrice * quantity;


      product.originalPrice = regularPrice;
      product.price = salePrice;
      product.discount = itemDiscount;
      product.totalPrice = itemTotalPrice;

      subtotal += regularPrice * quantity;
      saletotal += salePrice * quantity;
      discount += (regularPrice - salePrice) * quantity;

     
    });

    cart.products = filterCart;
    await cart.save();

//Apply Coupon if exists

  // const cartAmount = subtotal - totalDiscount - couponDiscount;
  const tax = 0;
const shipping = saletotal >= 1000 ? 0 : 50;  
const couponDiscount = cart.couponApplied ? cart.couponDiscount : 0;
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
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};






const loadOrderSuccess = async (req, res) => {
  try {
    console.log(req.query);
    const { orderId } = req.query;
    const userId = req.session.user.id;

    const user = await User.findOne({userId });
    console.log(user);

    if (!orderId) {
      return res.redirect("/");
    }

    const order = await Order.findOne({ orderId }).populate({
      path: "orderedProducts.product",
      select: "productName productImage regularPrice salePrice",
    });

    if (!order) {
      return res.redirect("/");
    }

    const tax = order.totalPrice * 0.05; 


    res.render("ordersuccess", {
      order,
      orderId: order.orderId,
      orderTotal: order.finalAmount,
      user,
      tax,
    });
  } catch (error) {
    console.error("Error loading order success:", error);
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
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

