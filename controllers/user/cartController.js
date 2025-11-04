import Cart from "../../models/CartSchema.js";
import Product from "../../models/ProductSchema.js";
import Category from "../../models/CategorySchema.js";
import User from "../../models/userSchema.js";
import Wishlist from "../../models/WishListSchema.js";

const loadCart = async (req, res) => {
  try {
    const userId = req.session.user.id

    // Load cart with product and category data
    let cart = await Cart.findOne({ userId }).populate({
      path: "products.productId",
      populate: "category",
    });
    if(!cart){
        cart = new Cart({ userId, products: [] });
        await cart.save();
    }

    const user = await User.findById(userId);

    // Filter out unavailable/blocked products
    cart.products = cart.products.filter((product) => {
      const item = product.productId;
      return (
        item &&
        !item.isBlocked &&
        item.category &&
        item.category.isListed &&
        item.status?.toLowerCase() !== "out of stock"
      );
    });

    let subtotal = 0;
    let totalDiscount = 0;

    // Recalculate prices and update cart consistency
    cart.products.forEach((product) => {
      const item = product.productId;
      const regularPrice = item.regularPrice || 0;
      const salePrice = item.salePrice;
      const quantity = product.quantity || 1;

      const discount = regularPrice - salePrice;
      const totalPrice = salePrice * quantity;

      // Update cart item fields with latest values
      product.originalPrice = regularPrice;
      product.price = salePrice;
      product.discount = discount;
      product.totalPrice = totalPrice;

      subtotal += regularPrice * quantity;
      totalDiscount += discount * quantity;
    });

    // Save updated cart
    await cart.save();

    // const tax = calculateTax(subtotal - totalDiscount); // 10% assumed
    const tax = 0;
    const shipping = subtotal >= 1000 ? 0 : 50;
    const total = subtotal - totalDiscount + tax + shipping;

    res.render("cart", {
      user,
      cart,
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      tax: tax.toFixed(2),
      shipping: shipping.toFixed(2),
      total: total.toFixed(2),
      productCount: cart.products.length,
    });
  } catch (error) {
    console.error("Error loading cart page:", error);
    return res.status(500).json({ success: false, message: "An error occured.Please try again" })
  }
};


const maxItemLimit = 10;

const addToCart = async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.session.user.id;

    const item = await Product.findById(productId).populate("category");

    if (!item) {
      return res.status(400).json({success:false,message:"Product Not Found"});
    }

    if (item.isBlocked || (item.category && !item.category.isListed)) {
      return res.status(400).json({success:false,message:"The product is currently unavailable"});
    }

    if (item.stock <= 0) {
      return res.status(400).json({success:false,message:"The product is currently out of stock"});
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, products: [] });
    }

    const isItemExitIndex = cart.products.findIndex(
      (p) => p.productId.toString() === productId
    );

    const salePrice = item.salePrice;
    const originalPrice = item.regularPrice;
    const discountAmount = originalPrice - salePrice;

    if (isItemExitIndex >= 0) {
      const newQty = cart.products[isItemExitIndex].quantity + 1;
      if (newQty > maxItemLimit)
        return res.status(400).json({success:false,message:"Maximum limit reached"});
      if (newQty > item.stock)
        return res.status(400).json({success:false,message:`Only ${item.stock} items left`});
      cart.products[isItemExitIndex].quantity = newQty;
      cart.products[isItemExitIndex].totalPrice = newQty * salePrice;
    } else {
      cart.products.push({
        productId,
        quantity: 1,
        price: salePrice,
        originalPrice,
        discount: discountAmount,
        totalPrice: salePrice,
      });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      cart,
      cartCount: cart.products.length,
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


const updateCartQuantity = async (req, res) => {
  try {
    const { quantity, productId } = req.body;
    const userId = req.session.user.id;

    console.log(quantity, productId);

    const items = await Product.findById(productId);

    if (items.isBlocked || items.stock <= 0) {
      return res.status(400).json({success:false,message:PRODUCT_NOT_FOUND});
    }

    if (items.stock < quantity) {
      res.status(400).json({success:false,message:`Only ${items.stock} is left`});
    }

    let cart = await Cart.findOne({ userId, "items.productId": productId });

    if (!cart) {
     res.status(400).json({success:false,message:"Product doesn't exit in the cart"});
    }

    const productIndex = cart.products.findIndex(
      (product) => product.productId.toString() === productId
    );

    if (maxItemLimit < Number(quantity)) {
      res.status(400).json({success:false,message:"Maxium quantity limit is reached"});
    }

    if (productIndex === -1) {
      res.status(400).json({success:false,message:"Product not found in the cart"});
    }

  
    // Update quantity & prices
    const product = cart.products[productIndex];
    product.quantity = quantity;
    product.price = item.salePrice;
    product.originalPrice = item.regularPrice;
    product.discount = item.regularPrice - item.salePrice;
    product.totalPrice = quantity * item.salePrice;

    await cart.save();

    // Calculate summary values
    let subtotal = 0;
    let totalDiscount = 0;

    cart.products.forEach((product) => {
      subtotal += product.originalPrice * product.quantity;
      totalDiscount += (product.originalPrice - product.price) * product.quantity;
    });

    //  const tax = calculateTax(subtotal - totalDiscount);
    const tax = 0;
    const shipping = subtotal >= 1000 ? 0 : 50; // Free shipping above 1000
    const total = subtotal - totalDiscount + tax + shipping;

    res.json({
      success: true,
      message: message.CART_UPDATED_SUCCESSFULLY,
      productTotal: cart.products[productIndex].totalPrice.toFixed(2),
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      tax: tax.toFixed(2),
      shipping: shipping.toFixed(2),
      total: total.toFixed(2),
      productCount: cart.products.length,
    });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ success: false, message: error.message });
  }
};




const deleteCartItem = async (req, res) => {
  try {
    const productId = req.body.productId;
    const userId = req.session.user.id;

    const user = await User.findById(userId);

    if (!user) {
      res.status(400).json({success:false,message:"User Not Found"});
    }

    let cart = await Cart.findOne({ userId });

    cart.products = cart.products.filter((item) => {
      return item.productId.toString() !== productId;
    });

    await cart.save();

    res
      .status(200)
      .json({ success: true, message: "Deleted Successfully" });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};


const clearCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) {
      res.send(400).json({success:false,message:"Invalid Request"});
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: userId },
      { $set: { products: [] } }
    );

    await cart.save();

    return res.status(200).json({ success: true, message: "Cleared Successfully" });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// Use named exports
export { loadCart, 
         addToCart,
         updateCartQuantity,
         deleteCartItem,
         clearCart,
      
        };
