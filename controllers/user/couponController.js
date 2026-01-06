import Cart from "../../models/CartSchema.js";
import User from "../../models/userSchema.js";
import Coupon from "../../models/CouponSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from '../../utils/logger.js';




const loadCoupon = async (req, res) => {
  try {
    console.log("COupon page");
    const userId = req.session.user.id;
    
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect('/login');
    }

    const totalCoupons = await Coupon.countDocuments({});
    const coupons = await Coupon.find({})
      .sort({ expiresAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalCoupons / limit);

    // Check if coupons are still active based on expiry date and usage limit
    const currentDate = new Date();
    const couponsWithStatus = coupons.map(coupon => {
      const isExpired = new Date(coupon.expiresAt) < currentDate;

      // Check if total usage limit reached
      const usageLimitReached = coupon.totalUsageLimit && coupon.usedCount >= coupon.totalUsageLimit;

      // Check user eligibility based on onlyFor field
      let isEligible = true;
      if (coupon.onlyFor === 'specificUsers') {
        isEligible = coupon.allowedUsers && coupon.allowedUsers.some(id => id.toString() === userId.toString());
      }
      // Add logic for 'newUsers' and 'vipUsers' if needed

      return {
        ...coupon,
        // Determine if coupon is truly active and user is eligible
        isActive: coupon.isActive && !isExpired && !usageLimitReached && isEligible
      };
    });

    // Separate active and expired coupons
    const activeCoupons = couponsWithStatus.filter(c => c.isActive);
    const expiredCoupons = couponsWithStatus.filter(c => !c.isActive);

    // Combine: active first, then expired
    const sortedCoupons = [...activeCoupons, ...expiredCoupons];

    res.render('listcoupon', {
      user,
      coupons: sortedCoupons,
      title: 'Available Coupons',
      currentPage: page,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    });

  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};



const applyCoupon = async (req, res) => {
  try {
    console.log("applyCoupon controller INVOKED");

    const userId = req.session.user?.id;
    const { couponCode } = req.body;

    if (!userId) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: "User not authenticated" });
    }

    if (!couponCode) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: "Coupon code required" });
    }

    const cart = await Cart.findOne({ userId }).populate("products.productId");

    if (!cart || cart.products.length === 0) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.CART_EMPTY });
    }

    // Filter valid items
    const validItems = cart.products.filter(p => {
      const item = p.productId;
      const variant = item?.variant?.[0];
      return item && variant && !item.isBlocked && variant.stock > 0;
    });

    if (!validItems.length) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: "No valid items in your cart" });
    }

    // SALE TOTAL (already includes product discount)
    const saleTotal = validItems.reduce((total, p) => {
      const variant = p.productId.variant?.[0];
      return total + (variant.salePrice * p.quantity);
    }, 0);

    console.log("Sale Total:", saleTotal);

    //  Find coupon
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.COUPON_INVALID });
    }

    // Minimum order check (based on SALE TOTAL)
    if (coupon.minAmount && saleTotal < coupon.minAmount) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: `Minimum order ₹${coupon.minAmount} required`,
      });
    }

    //  Prevent re-applying same coupon
    if (cart.couponApplied && cart.couponCode === coupon.code) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.COUPON_ALREADY_USED });
    }

    //  Coupon discount (ONLY on sale total)
    let couponDiscount = (saleTotal * coupon.discountPercent) / 100;

    if (coupon.maxDiscountAmount) {
      couponDiscount = Math.min(
        couponDiscount,
        coupon.maxDiscountAmount
      );
    }

    console.log("Coupon Discount:", couponDiscount);

    
    const shipping = saleTotal >= 1000 ? 0 : 50;

    
    const newTotal = Math.max(
      saleTotal - couponDiscount + shipping,
      0
    );

    // Save ONLY coupon info
    cart.couponApplied = true;
    cart.couponCode = coupon.code;
    cart.couponDiscount = couponDiscount;
    cart.total = newTotal;

    await cart.save();

    console.log("Coupon applied successfully");

    return res.status(Status.OK).json({
      success: true,
      message: message.COUPON_APPLIED_SUCCESSFULLY,
      discount: couponDiscount,
      newTotal: newTotal,
      cart: {
        total: newTotal.toFixed(2),
        discount: couponDiscount.toFixed(2),
      },
    });

  } catch (error) {
    console.error("Error in applyCoupon:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.SERVER_ERROR });
  }
};



const removeCoupon = async (req, res) => {
  try {
    console.log(" removeCoupon controller called");

    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "User not authenticated" });
    }

    const cart = await Cart.findOne({ userId }).populate("products.productId");

    if (!cart) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Cart is empty" });
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

    res.status(Status.OK).json({
      success: true,
      message: message.COUPON_REMOVED,
      newTotal: newTotal
    });

  } catch (error) {
    console.error(" Error in removeCoupon:", error);
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};
export {
  loadCoupon,
  applyCoupon,
  removeCoupon,
}


















