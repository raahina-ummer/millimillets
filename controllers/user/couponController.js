import Cart from "../../models/CartSchema.js";
import Coupon from "../../models/CouponSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";



const applyCoupon = async (req, res) => {
  try {
    console.log(" applyCoupon controller called");
    
    const userId = req.session.user?.id;
    const { couponCode } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "User not authenticated" });
    }

    if (!couponCode) {
      return res.json({ success: false, message: "Coupon code required" });
    }

    const cart = await Cart.findOne({ userId }).populate("products.productId");
    
    if (!cart || cart.products.length === 0) {
      return res.json({ success: false, message: "Your cart is empty" });
    }

    // Filter valid items
    const validItems = cart.products.filter(p => {
      const item = p.productId;
      const variant = item?.variant?.[0];
      return item && variant && !item.isBlocked && variant.stock > 0;
    });

    if (!validItems.length) {
      return res.json({ success: false, message: "No valid items in your cart" });
    }

    //  CALCULATE SUBTOTAL (Sale Price × Qty)
    const cartSubtotal = validItems.reduce((total, p) => {
      const variant = p.productId.variant?.[0];
      const salePrice = variant?.salePrice || variant?.regularPrice || 0;
      return total + (salePrice * p.quantity);
    }, 0);

    console.log(" Cart Subtotal:", cartSubtotal);

    // Find coupon
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(), 
      isActive: true 
    });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid or expired coupon" });
    }

    // Check minimum amount
    if (coupon.minAmount && cartSubtotal < coupon.minAmount) {
      return res.json({ 
        success: false, 
        message: `Minimum order ₹${coupon.minAmount} required` 
      });
    }

    // Check if already applied
    if (cart.couponApplied && cart.couponCode === coupon.code) {
      return res.json({ success: false, message: "Coupon already applied" });
    }

    //  CALCULATE DISCOUNT
    let discount = (cartSubtotal * coupon.discountPercent) / 100;
    if (coupon.maxDiscountAmount) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }

    console.log(" Discount Amount:", discount);

    // Apply coupon to cart
    cart.couponApplied = true;
    cart.couponCode = coupon.code;
    cart.couponDiscount = discount;
    
    // RECALCULATE TOTAL
    const shipping = cartSubtotal >= 1000 ? 0 : 50;
    
    // Calculate product discount
    const productDiscount = validItems.reduce((total, p) => {
      const variant = p.productId.variant?.[0];
      const regularPrice = variant?.regularPrice || 0;
      const salePrice = variant?.salePrice || regularPrice;
      const itemDiscount = (regularPrice - salePrice) * p.quantity;
      return total + itemDiscount;
    }, 0);

    // New total = Subtotal - Product Discount - Coupon Discount + Shipping
    const newTotal = cartSubtotal - productDiscount - discount + shipping;
    cart.total = newTotal;

    await cart.save();

    console.log(" Coupon applied successfully");

    res.json({
      success: true,
      message: "Coupon applied successfully!",
      discount: discount,
      newTotal: newTotal,
      cart: {
        total: newTotal.toFixed(2),
        discount: discount.toFixed(2)
      }
    });

  } catch (error) {
    console.error("Error in applyCoupon:", error);
    res.status(500).json({ success: false, message: "Server error applying coupon" });
  }
};


const removeCoupon = async (req, res) => {
  try {
    console.log("🔵 removeCoupon controller called");
    
    const userId = req.session.user?.id;

    if (!userId) {
      return res.json({ success: false, message: "User not authenticated" });
    }

    const cart = await Cart.findOne({ userId }).populate("products.productId");

    if (!cart) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    //  RECALCULATE WITHOUT COUPON
    const cartSubtotal = cart.products.reduce((total, p) => {
      const variant = p.productId.variant?.[0];
      const salePrice = variant?.salePrice || variant?.regularPrice || 0;
      return total + (salePrice * p.quantity);
    }, 0);

    const productDiscount = cart.products.reduce((total, p) => {
      const variant = p.productId.variant?.[0];
      const regularPrice = variant?.regularPrice || 0;
      const salePrice = variant?.salePrice || regularPrice;
      const itemDiscount = (regularPrice - salePrice) * p.quantity;
      return total + itemDiscount;
    }, 0);

    const shipping = cartSubtotal >= 1000 ? 0 : 50;
    const newTotal = cartSubtotal - productDiscount + shipping;

    // Remove coupon
    cart.couponApplied = false;
    cart.couponCode = null;
    cart.couponDiscount = 0;
    cart.total = newTotal;
    
    await cart.save();

    console.log(" Coupon removed successfully");

    res.json({
      success: true,
      message: "Coupon removed successfully",
      newTotal: newTotal
    });

  } catch (error) {
    console.error(" Error in removeCoupon:", error);
    res.json({ success: false, message: "Failed to remove coupon" });
  }
};
export{
  applyCoupon,
  removeCoupon,
}























// const applyCoupon = async (req, res) => {
//   try {
//     const userId = req.session.user.id;
//     const { couponCode } = req.body;

//     const cart = await Cart.findOne({ userId }).populate("products.productId");
//     if (!cart || cart.products.length === 0)
//       return res.json({ success: false, message: "Your cart is empty" });

//     const validItems = cart.products.filter(p => {
//       const item = p.productId;
//       const variant = item?.variant?.[0];
//       return item && variant && !item.isBlocked && variant.stock > 0;
//     });

//     if (!validItems.length)
//       return res.json({ success: false, message: "No valid items in your cart" });

//     const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
//     if (!coupon)
//       return res.json({ success: false, message: "Invalid or expired coupon" });

//     if (cart.couponApplied && cart.couponCode === coupon.code)
//       return res.json({ success: false, message: "Coupon already applied" });

//     // FIXED CALCULATION
//     const cartTotal = validItems.reduce((total, p) => {
//       const variant = p.productId.variant?.[0];
//       const price = variant?.salePrice || variant?.regularPrice || 0;
//       return total + (price * p.quantity);
//     }, 0);

//     if (coupon.minAmount && cartTotal < coupon.minAmount)
//       return res.json({ success: false, message: `Minimum order ₹${coupon.minAmount} required` });

//     let discount = (cartTotal * coupon.discountPercent) / 100;
//     if (coupon.maxDiscountAmount)
//       discount = Math.min(discount, coupon.maxDiscountAmount);

//     cart.couponApplied = true;
//     cart.couponCode = coupon.code;
//     cart.couponDiscount = discount;
//     cart.total = cartTotal - discount;
//     await cart.save();

//     res.json({
//       success: true,
//       message: "Coupon applied successfully!",
//       discount,
//       newTotal: cartTotal - discount
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Server error applying coupon" });
//   }
// };



// const removeCoupon = async (req, res) => {
//   try {
//     const userId = req.session.user.id;
//     const cart = await Cart.findOne({ userId });

//     if (!cart) return res.json({ success: false, message: "Cart is empty" });

//     cart.couponApplied = false;
//     cart.couponCode = null;
//     cart.couponDiscount = 0;
//     cart.total = originalTotal

//     await cart.save();

//     return res.json({ 
//   success: true, 
//   message: "Coupon removed successfully",
//   newTotal: cart.total 
// });

//   } catch (error) {
//     console.error(error);
//     res.json({ success: false, message: "Failed to remove coupon" });
//   }
// };


// export {
//     applyCoupon,
//     removeCoupon
// }