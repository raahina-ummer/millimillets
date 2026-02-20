import Cart from "../../models/CartSchema.js";
import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import User from "../../models/userSchema.js";
import Wishlist from "../../models/WishListSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import { calculateTotals } from "../../utils/calculateTotals.js";
import logger from "../../utils/logger.js";
import { calculateFinalPriceForVariant } from "../../utils/offerCalculator.js";
import { isValidCartItem,getValidCartItems } from "../../Helpers/cartHelper.js";
import { calculateOrderTotals } from "../../Helpers/orderTotal.js";


const loadCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) {
      return res.redirect("/login");
    }

    let cart = await Cart.findOne({ userId }).populate({
      path: "products.productId",
      populate: "category",
    });

    if (!cart) {
      cart = new Cart({ userId, products: [] });
      await cart.save();
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: message.CART.LOGIN_REQUIRED });
    }
  let cartUpdated = false;
  let removedUnavailable = false; 
  const cartWarning = req.session.cartWarning || null;  

 const validItems = getValidCartItems(cart);

if (validItems.length !== cart.products.length) {
      cart.products = validItems;
      cartUpdated = true;
      removedUnavailable = true; 
    }
    if (removedUnavailable) {
  req.session.cartWarning =
    "Some unavailable or blocked products were removed from your cart.";
}



for (const cartItem of cart.products) {
  
    const variant = cartItem.productId.variant.find(
      v => v._id.toString() === cartItem.variantId.toString()
    );

    if (!variant) continue;

    const { finalPrice } = calculateFinalPriceForVariant(
      variant,
      cartItem.productId,
      cartItem.productId.category
    );

        if (cartItem.price !== finalPrice) {
        cartItem.price = finalPrice;
        cartUpdated = true;
      }
  }


    const totals = calculateTotals(cart.products, 0);
    cart.total = totals.finalAmount;
    if (cartUpdated) {
      await cart.save();
    }

    req.session.cartWarning = null; 

    res.render("cart", {
      user,
      cart,
      saletotal: totals.saletotal,
      couponDiscount: 0,
      tax: totals.tax,
      shipping: totals.shipping,
      total: totals.finalAmount,
      productCount: cart.products.length,
      cartWarning,
    });
  } catch (error) {
    console.error("Error loading cart page:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const maxItemLimit = 10;

const addToCart = async (req, res) => {
  try {

      if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "Login required",
      });
    }
    const productId = req.params.productId;
    const userId = req.session.user.id;
    const { variantId, quantity } = req.body;
    const qtyToAdd = Math.max(1, Number(quantity) || 1);

    const item = await Product.findById(productId).populate("category");

    if (!item) {
      return res
        .status(Status.NOT_FOUND)
        .json({ success: false, message: message.CART.PRODUCT_NOT_FOUND });
    }

    if (item.isBlocked || (item.category && !item.category.isListed)) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.CART.PRODUCT_UNAVAILABLE });
    }

    const variant = item.variant.find(
      (v) => v._id.toString() === variantId.toString(),
    );

    if (!variant || variant.stock <= 0) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.CART.OUT_OF_STOCK });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, products: [] });
    }
    const itemIndex = cart.products.findIndex(
      (p) =>
        p.productId.toString() === productId &&
        p.variantId.toString() === variantId,
    );

    const { finalPrice } = calculateFinalPriceForVariant(
      variant,
      item,
      item.category,
    );
    if (itemIndex >= 0) {
      const newQty = cart.products[itemIndex].quantity + qtyToAdd;

      if (newQty > maxItemLimit) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: message.CART.MAX_LIMIT_REACHED,
        });
      }

      if (newQty > variant.stock) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: message.CART.STOCK_LIMIT,
        });
      }

      cart.products[itemIndex].quantity = newQty;
    } else {
      cart.products.push({
        productId,
        variantId: variant._id,
        quantity: qtyToAdd,
        price: finalPrice,
      });
    }

    // CLEAR COUPON when cart is modified
    cart.couponApplied = false;
    cart.couponCode = null;
    cart.couponDiscount = 0;

    // Recalculate total WITHOUT coupon
    const { finalAmount } = calculateTotals(cart.products, 0);
    cart.total = finalAmount;

    await cart.save();

    // Auto removal from wishlist
    try {
      const wishlist = await Wishlist.findOne({ userId });

      if (wishlist) {
        const productIndex = wishlist.products.findIndex(
          (item) => item.productId.toString() === productId.toString(),
        );

        if (productIndex > -1) {
          wishlist.products.splice(productIndex, 1);
          await wishlist.save();
          console.log("Product removed from wishlist");
        }
      }
    } catch (wishlistError) {
      console.error("Failed to remove from wishlist:", wishlistError);
    }

    return res.status(Status.OK).json({
      success: true,
      message: message.CART.ITEM_ADDED,
      isExisting: itemIndex >= 0,
      cartCount: cart.products.length,
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const updateCartQuantity = async (req, res) => {
  try {
    const { quantity, productId, variantId } = req.body;
    const userId = req.session.user.id;
    const newQuantity = Number(quantity);

    if (isNaN(newQuantity) || newQuantity < 1) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.CART.INVALID_QUANTITY,
      });
    }

    const productData = await Product.findById(productId);
    if (!productData) {
      return res.status(Status.NOT_FOUND).json({
        success: false,
        message: message.CART.PRODUCT_NOT_FOUND,
      });
    }

    const variant = productData.variant.find(
      (v) => v._id.toString() === variantId.toString(),
    );

    if (!variant || newQuantity > variant.stock) {
      return res.status(Status.OK).json({
        success: false,
        message: `Only ${variant?.stock ?? 0} left`,
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(Status.NOT_FOUND).json({
        success: false,
        message: message.CART.NOT_FOUND,
      });
    }

    const productIndex = cart.products.findIndex(
      (p) =>
        p.productId.toString() === productId &&
        p.variantId.toString() === variantId,
    );

    if (productIndex === -1) {
      return res.status(Status.NOT_FOUND).json({
        success: false,
        message: message.CART.PRODUCT_NOT_FOUND,
      });
    }

    if (newQuantity > maxItemLimit) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.CART.STOCK_LIMIT,
      });
    }

    // USE STORED CART PRICE ONLY
    const product = cart.products[productIndex];

    product.quantity = newQuantity;

    await cart.save();
    await cart.populate("products.productId");
    const totals = calculateTotals(cart.products, cart.couponDiscount);

    cart.total = totals.finalAmount;
    await cart.save();

    return res.json({
      success: true,
      message: message.CART.UPDATED_SUCCESS,
      itemTotal: product.price * product.quantity,
      saletotal: totals.saletotal,
      shipping: totals.shipping,
      total: totals.finalAmount,
    });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId, variantId } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: message.CART.NOT_FOUND,
      });
    }

    const productIndex = cart.products.findIndex(
      (p) =>
        p.productId.toString() === productId &&
        p.variantId.toString() === variantId,
    );

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: message.CART.PRODUCT_NOT_FOUND,
      });
    }

    cart.products.splice(productIndex, 1);
    await cart.populate("products.productId");
    const totals = calculateTotals(cart.products, cart.couponDiscount);
    cart.total = totals.finalAmount;
    await cart.save();

    return res.json({
      success: true,
      message: message.CART.ITEM_REMOVED,
    });
  } catch (error) {
    console.error("Error removing cart item:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.session.user.id;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res
        .status(Status.NOT_FOUND)
        .json({ success: false, message: message.CART.NOT_FOUND });
    }

    cart.products = [];
    await cart.populate("products.productId");
    const totals = calculateTotals(cart.products, cart.couponDiscount);
    cart.total = totals.finalAmount;
    await cart.save();

    return res.json({
      success: true,
      message: message.CART.CLEARED_SUCCESS,
      saletotal: 0,
      shipping: 0,
      total: 0,
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const getCartCount = async (req, res) => {
  try {
    let userId = req.session.user.id;

    if (!userId) {
      return res.json({ success: false, message: message.CART.LOGIN_REQUIRED });
    }
    let userCart = await Cart.findOne({ userId });

    if (!userCart) return res.json({ success: false });

    return res.json({
      success: true,
      cartCount: userCart?.products?.length ?? 0,
    });
  } catch (error) {
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ sucess: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export {
  loadCart,
  addToCart,
  updateCartQuantity,
  removeCartItem,
  clearCart,
  getCartCount,
};
