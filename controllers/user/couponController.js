import Cart from "../../models/CartSchema.js";
import User from "../../models/userSchema.js";
import Coupon from "../../models/CouponSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from '../../utils/logger.js';



const loadCoupon = async (req, res) => {
  try {
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
    const currentDate = new Date();
    const couponsWithStatus = coupons.map(coupon => {
      const isExpired = new Date(coupon.expiresAt) < currentDate;


      const usageLimitReached = coupon.totalUsageLimit && coupon.usedCount >= coupon.totalUsageLimit;

      // Check user eligibility based on onlyFor field
      let isEligible = true;
      if (coupon.onlyFor === 'specificUsers') {
        isEligible = coupon.allowedUsers && coupon.allowedUsers.some(id => id.toString() === userId.toString());
      }
      // Add logic for 'newUsers' and 'vipUsers' if needed

      return {
        ...coupon,
        isActive: coupon.isActive && !isExpired && !usageLimitReached && isEligible
      };
    });


    const activeCoupons = couponsWithStatus.filter(c => c.isActive);
    const expiredCoupons = couponsWithStatus.filter(c => !c.isActive);


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
    logger.error('Error fetching coupons:', error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};



const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { couponCode } = req.body;

    if (!userId) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.AUTH.USER_NOT_LOGGED_IN });
    }

    if (!couponCode) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.COUPON.INVALID });
    }

    const cart = await Cart.findOne({ userId }).populate("products.productId");

    if (!cart || cart.products.length === 0) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.CART.EMPTY });
    }


    const validItems = cart.products.filter(p => {
      const item = p.productId;
      if (!item || item.isBlocked || !Array.isArray(item.variant)) return false;

      if (!p.variantId) return false;

      const variant = item.variant.find(
        v => v._id.toString() === p.variantId.toString()
      );

      return variant && variant.stock > 0;
    });

    if (!validItems.length) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.COUPON.NO_VALID_ITEMS });
    }
    const saleTotal = validItems.reduce(
      (total, p) => total + (p.price * p.quantity),
      0
    );

    //  Find coupon
    const coupon = await Coupon.findOne({
      code: couponCode.trim().toUpperCase(),

      isActive: true,
    });

    if (!coupon) {
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.COUPON.INVALID });
    }

    if (coupon.minPurchaseAmount && saleTotal < coupon.minPurchaseAmount) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.COUPON.MIN_AMOUNT_NOT_MET,
      });
    }

    if (coupon.usedBy?.includes(userId)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.COUPON.ALREADY_USED
      });
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.COUPON.EXPIRED || "Coupon expired",
      });
    }
    if (
      coupon.totalUsageLimit &&
      coupon.usedCount >= coupon.totalUsageLimit
    ) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Coupon usage limit reached"
      });
    }
    const usedCountByUser =
      coupon.usedBy?.filter(id => id.toString() === userId.toString()).length || 0;

    if (usedCountByUser >= coupon.usageLimitPerUser) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.COUPON.ALREADY_USED
      });
    }

    let couponDiscount = (saleTotal * coupon.discountPercent) / 100;

    if (coupon.maxDiscountAmount) {
      couponDiscount = Math.min(
        couponDiscount,
        coupon.maxDiscountAmount
      );
    }


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
    cart.couponMinPurchase = coupon.minPurchaseAmount;
    cart.couponPercent = coupon.discountPercent;
    cart.couponMaxDiscount = coupon.maxDiscountAmount;



    await cart.save();

    return res.status(Status.OK).json({
      success: true,
      message: message.COUPON.APPLIED_SUCCESS,
      discount: couponDiscount,
      newTotal: newTotal,
      cart: {
        total: newTotal.toFixed(2),
        discount: couponDiscount.toFixed(2),
      },
    });

  } catch (error) {
    logger.error("Error in applyCoupon:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};




const removeCoupon = async (req, res) => {
  try {


    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: message.AUTH.USER_NOT_LOGGED_IN });
    }

    const cart = await Cart.findOne({ userId }).populate("products.productId");
    if (!cart || !cart.products.length) {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: message.COUPON.CART_EMPTY });
    }


    let saleTotal = 0;

    cart.products.forEach(p => {
      const item = p.productId;
      if (!item || !Array.isArray(item.variant)) return;

      let variant = null;

      if (p.variantId) {
        variant = item.variant.find(v =>
          v._id.toString() === p.variantId.toString()
        );
      }

      if (!variant || variant.stock <= 0) return false;


      if (!variant) return;

      const price = Number(variant.salePrice || 0);
      saleTotal += price * p.quantity;
    });

    const shipping = saleTotal === 0 ? 0 : saleTotal >= 1000 ? 0 : 50;
    const newTotal = Math.max(saleTotal + shipping, 0);

    // REMOVE COUPON
    cart.couponApplied = false;
    cart.couponCode = null;
    cart.couponDiscount = 0;
    cart.total = newTotal;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: message.COUPON.REMOVED,
      newTotal: newTotal,
    });

  } catch (error) {
    logger.error("Error in removeCoupon:", error);
    return res.status(500).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};




export {
  loadCoupon,
  applyCoupon,
  removeCoupon
}