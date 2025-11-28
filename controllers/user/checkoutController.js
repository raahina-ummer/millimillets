import Cart from "../../models/CartSchema.js";
import Address from "../../models/AddressSchema.js";
import Product from "../../models/ProductSchema.js";
import Order from "../../models/OrderSchema.js";
import User from "../../models/userSchema.js"; // 
import dotenv from "dotenv";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";


const loadCheckOut = async (req, res) => {
  try {
    const userId = req.session.user.id;

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
    let totalDiscount = 0;

    filterCart.forEach((product) => {
      const item = product.productId;
      const variant = item.variant && item.variant[0];

      const regularPrice = variant ? variant.regularPrice : 0;
      const salePrice = variant ? variant.salePrice : regularPrice;
      const quantity = product.quantity || 1;

      const discount = regularPrice - salePrice;
      const totalPrice = salePrice * quantity;

      product.originalPrice = regularPrice;
      product.price = salePrice;
      product.discount = discount;
      product.totalPrice = totalPrice;

      subtotal += regularPrice * quantity;
      totalDiscount += discount * quantity;
    });

    cart.products = filterCart;
    await cart.save();

//Apply Coupon if exists

  // const cartAmount = subtotal - totalDiscount - couponDiscount;
  const tax = 0;
const shipping = subtotal >= 1000 ? 0 : 50;  // Based on SUBTOTAL
const couponDiscount = cart.couponApplied ? cart.couponDiscount : 0;
const total = subtotal - totalDiscount - couponDiscount + tax + shipping;


   return res.render("checkout", {
  user,
  cart: { products: filterCart },
  addresses: address.addresses,
  subtotal,
  discount: totalDiscount,
  couponDiscount,
  tax,
  shipping,
  total,
  itemCount: filterCart.length,
  availableCoupons: [],
  appliedCoupon: cart.couponApplied ? cart.couponCode : null,
});

  } catch (error) {
    console.error("Error loading checkout page:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({success: false, message: "Failed to load checkout page. Please try again.",});
  }
};




const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    const userId = req.session.user.id;

    if (!addressId || !paymentMethod) {
      return res.status(Status.BAD_REQUEST).json({success: false, message: "Address and payment method are required",});
    }

    const userAddress = await Address.findOne({ userId });
    if (!userAddress) return res.status(400).send("Invalid Request");

    const selectedAddress = userAddress.addresses.find(
      (addr) => addr._id.toString() === addressId
    );
    if (!selectedAddress) return res.status(Status.BAD_REQUEST).send("Please add a valid address");

    if (paymentMethod !== "cod") {
      return res.status(Status.BAD_REQUEST).send("Only Cash on Delivery is available");
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "products.productId",
      populate: "category",
    });

    if (!cart || cart.products.length === 0) {
      return res.status(Status.NOT_FOUND).json({success: false,message: "Cart is empty or not found",});
    }

    // Fix: Check stock and prices using product.variant[0]
    const validCartItems = cart.products.filter((item) => {
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

    if (validCartItems.length === 0) {
      return res.status(Status.BAD_GATEWAY).json({success: false,message: "No valid items in cart" });
    }

    let subtotal = 0;
    let totalDiscount = 0;
    const orderItems = [];

    for (const item of validCartItems) {
      const product = item.productId;
      const variant = product.variant?.[0]; 

      const regularPrice = variant.regularPrice;
      const salePrice = variant.salePrice;
      const discountAmount = regularPrice - salePrice;
      const totalPrice = salePrice * item.quantity;

      subtotal += regularPrice * item.quantity;
      totalDiscount += discountAmount * item.quantity;

      orderItems.push({
        productId: product._id,
        productName: product.productName,
        quantity: item.quantity,
        price: salePrice,
        totalPrice: totalPrice,
        productImage: product.productImage[0] || null,
        regularPrice,
        discountAmount,
        category: product.category,
      });

      // Update product stock immediately (COD)
      await Product.findByIdAndUpdate(product._id, {
        $inc: { "variant.0.stock": -item.quantity },
      });
    }

    const shipping = subtotal >= 1000 ? 0 : 50;
    const finalAmount = subtotal - totalDiscount + shipping;

    const orderId =
      "ORD" +
      Date.now() +
      Math.random().toString(36).substr(2, 5).toUpperCase();

    const newOrder = new Order({
      orderId,
      userId,
      orderedProducts: orderItems.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice: subtotal,
      discount: totalDiscount,
      finalAmount,
      address: selectedAddress,
      status: "Pending",
      createdOn: new Date(),
    });

    await newOrder.save();

    //  Clear cart after successful order
    await Cart.findOneAndUpdate(
      { userId },
      {
        $set: {
          products: [],
          couponApplied: false,
          couponCode: null,
          couponDiscount: 0,
        },
      }
    );

    return res.status(Status.OK).json({
      success: true,
      message: "Order placed successfully",
      orderId,
      totalAmount: finalAmount,
    });
  } catch (error) {
    console.error(error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
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

    const tax = order.totalPrice * 0.05; //  5% GST


    res.render("ordersuccess", {
      order,
      orderId: order.orderId,
      orderTotal: order.finalAmount,
      user,
      tax,
    });
  } catch (error) {
    console.error("Error loading order success:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};







const loadOrderFaliure = async (req, res) => {
  try {
    const { orderId } = req.query;
    const userId = req.session.user.id;

    const user = await User.findOne({userId });
    let order = null;

    if (orderId) {
      order = await Order.findOne({ orderId }).populate("products.productId");
    }

    if (order.paymentMethod === "online" && order.paymentStatus === "pending") {
      const cart = await Cart.findOne({ userId: order.userId });
      if (cart.couponApplied) {
        await Coupon.findOneAndUpdate(
          { code: cart.couponCode },
          {
            $inc: { usedCount: 1 },
            $push: { usedBy: userId },
          }
        );
      }

      // Clear user's cart
      await Cart.findOneAndUpdate(
        { userId: order.userId },
        {
          $set: {
            items: [],
            couponApplied: false,
            couponCode: null,
            couponDiscount: 0,
          },
        }
      );

      // Reduce stock for each product
      for (const product of order.products) {
        await Product.findByIdAndUpdate(product.productId, {
          $inc: { stock: -product.quantity },
        });
      }
    }

    res.render("orderfailure", { order, user });
  } catch (error) {
    console.error("Error loading failure page:", error);
    res.render("order-failure", { order: null });
  }
};






export {
  loadCheckOut,
  placeOrder,
  loadOrderSuccess,
  loadOrderFaliure,
};