import Cart from "../../models/CartSchema.js";
import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import User from "../../models/userSchema.js";
import Wishlist from "../../models/WishListSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import { calculateTotals } from "../../utils/calculateTotals.js";
import logger from '../../utils/logger.js';


const addToCart = async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.session.user.id;

    const item = await Product.findById(productId).populate("category");

    if (!item) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Product Not Found" });
    }

    if (item.isBlocked || (item.category && !item.category.isListed)) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "The product is currently unavailable" });
    }

    const variant = item.variant && item.variant.length > 0 ? item.variant[0] : null;

    if (!variant || variant.stock <= 0) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "The product is currently out of stock" });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, products: [] });
    }

    const isItemExitIndex = cart.products.findIndex(
      (p) => p.productId.toString() === productId
    );

    const salePrice = Number(variant.salePrice) || 0;
    const originalPrice = Number(variant.regularPrice) || salePrice;
    const discountAmount = originalPrice - salePrice;

    if (isItemExitIndex >= 0) {
      const newQty = cart.products[isItemExitIndex].quantity + 1;

      if (newQty > maxItemLimit) {
        return res.status(400).json({ success: false, message: "Maximum limit reached" });
      }

      if (newQty > variant.stock) {
        return res.status(400).json({ success: false, message: `Only ${variant.stock} items left` });
      }

      cart.products[isItemExitIndex].quantity = newQty;
      cart.products[isItemExitIndex].price = salePrice;
      cart.products[isItemExitIndex].originalPrice = originalPrice;
      cart.products[isItemExitIndex].discount = discountAmount;
      cart.products[isItemExitIndex].totalPrice = newQty * salePrice;
    } else {
      cart.products.push({
        productId,
        quantity: 1,
        price: salePrice,
        originalPrice: originalPrice,
        discount: discountAmount,
        totalPrice: salePrice,
      });
    }

    // CLEAR COUPON when cart is modified
    cart.couponApplied = false;
    cart.couponCode = null;
    cart.couponDiscount = 0;

    // Recalculate total WITHOUT coupon
    await cart.populate('products.productId');
    const { finalAmount } = calculateTotals(cart.products, 0);
    cart.total = finalAmount;

    await cart.save();

    // Auto removal from wishlist
    try {
      const wishlist = await Wishlist.findOne({ userId });

      if (wishlist) {
        const productIndex = wishlist.products.findIndex(
          item => item.productId.toString() === productId.toString()
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
      message: isItemExitIndex >= 0 ? "Cart updated successfully" : "Added to cart successfully",
      isExisting: isItemExitIndex >= 0,
      cart,
      cartCount: cart.products.length,
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};



const loadCart = async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.redirect('/login');
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
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Filter out unavailable products
    cart.products = cart.products.filter((product) => {
      const item = product.productId;

      if (!item) return false;

      return (
        !item.isBlocked &&
        item.category &&
        !item.category.isBlocked &&
        item.category.isListed &&
        item.status?.toLowerCase() !== "out of stock"
      );
    });
    let subtotal = 0;
    let saletotal = 0;
    let discount = 0;

    // Filter valid products
    cart.products = cart.products.filter(product => {
      const item = product.productId;
      return item && !item.isBlocked && item.status !== "Out of Stock";
    });

    // Calculate prices
    cart.products.forEach(product => {
      const variant = product.productId.variant?.[0];
      if (!variant) return;

      const regularPrice = variant.regularPrice;
      const salePrice = variant.salePrice;
      const quantity = product.quantity;

      // Sale price total
      product.price = salePrice;
      product.totalPrice = salePrice * quantity;

     subtotal += regularPrice * quantity;
saletotal += salePrice * quantity;
discount += (regularPrice - salePrice) * quantity;

    });

   
    const shipping = saletotal >= 1000 ? 0 : 50;
    const total = saletotal + shipping;

    // Save cart total
    cart.total = total;
    await cart.save();

    // Render cart page
    res.render("cart", {
      user,
      cart,
      subtotal,
      saletotal,
      discount,
      tax: 0,
      shipping,
      total,
      productCount: cart.products.length
    });


  } catch (error) {
    console.error("Error loading cart page:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};


const maxItemLimit = 10;



const updateCartQuantity = async (req, res) => {
  try {
    const { quantity, productId } = req.body;
    const userId = req.session.user.id;

    // Validate quantity is a valid number
    const newQuantity = Number(quantity);
    if (isNaN(newQuantity) || newQuantity < 1) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Invalid quantity" });
    }

    const productData = await Product.findById(productId);
    if (!productData) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Product not found" });
    }

    if (productData.isBlocked || productData.quantity <= 0) {  // Changed from stock to quantity
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Product is unavailable or out of stock" });
    }

    if (productData.quantity < newQuantity) {  // Changed from stock to quantity
      return res.status(Status.BAD_REQUEST).json({ success: false, message: `Only ${productData.quantity} left in stock` });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Cart not found" });
    }

    const productIndex = cart.products.findIndex(
      (product) => product.productId.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Product not found in the cart" });
    }

    if (newQuantity > maxItemLimit) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Maximum quantity limit reached" });
    }


    const salePrice = Number(productData.salePrice) || 0;
    const regularPrice = Number(productData.regularPrice) || 0;
    const discountAmount = regularPrice - salePrice;


    const product = cart.products[productIndex];
    product.quantity = newQuantity;
    product.price = salePrice;
    product.originalPrice = regularPrice;
    product.discount = discountAmount;
    product.totalPrice = newQuantity * salePrice;

    await cart.save();

    // Recalculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    cart.products.forEach((p) => {
      const itemOriginalPrice = Number(p.originalPrice) || 0;
      const itemPrice = Number(p.price) || 0;
      const itemQuantity = Number(p.quantity) || 0;

      subtotal += itemOriginalPrice * itemQuantity;
      totalDiscount += (itemOriginalPrice - itemPrice) * itemQuantity;
    });

    const tax = 0;
    const shipping = subtotal >= 1000 ? 0 : 50;
    const total = subtotal - totalDiscount + tax + shipping;

    return res.json({
      success: true,
      message: "Cart updated successfully",
      productTotal: product.totalPrice.toFixed(2),
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      shipping: shipping.toFixed(2),
      total: total.toFixed(2),
    });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};


const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId } = req.body;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Cart not found" });
    }

    const productIndex = cart.products.findIndex(
      (p) => p.productId.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Product not found in cart" });
    }


    cart.products.splice(productIndex, 1);
    await cart.save();

    //  Recalculate totals
    let subtotal = 0;
    let totalDiscount = 0;

    cart.products.forEach((p) => {
      subtotal += p.originalPrice * p.quantity;
      totalDiscount += (p.originalPrice - p.price) * p.quantity;
    });

    const tax = 0;
    const shipping = subtotal >= 1000 || subtotal === 0 ? 0 : 50;
    const total = subtotal - totalDiscount + tax + shipping;

    return res.json({
      success: true,
      message: "Product removed successfully",
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      shipping: shipping.toFixed(2),
      total: total.toFixed(2),
    });
  } catch (error) {
    console.error("Error removing cart item:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};


const clearCart = async (req, res) => {
  try {
    const userId = req.session.user.id;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(Status.NOT_FOUND).json({ success: false, message: "Cart not found" });
    }

    cart.products = []; //  Clear all products
    await cart.save();

    return res.json({
      success: true,
      message: "Cart cleared successfully",
      subtotal: 0,
      discount: 0,
      shipping: 0,
      total: 0,
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};



const getCartCount = async (req, res) => {
  try {

    let userId = req.session.user.id;
    console.log("hai hello from cart count")
    if (!userId) {
      return res.json({ success: false, message: "login for futher access" })
    }
    let userCart = await Cart.findOne({ userId });
    console.log(userCart)
    if (!userCart) return res.json({ success: false });
    console.log("hell end", userCart.products.length)
    return res.json({ success: true, cartCount: userCart?.products?.length ?? 0 })
  } catch (error) {
    return res.json({ sucess: false, message: error.message })
  }
}


// Use named export
export {
  loadCart,
  addToCart,
  updateCartQuantity,
  removeCartItem,
  clearCart,
  getCartCount

};
