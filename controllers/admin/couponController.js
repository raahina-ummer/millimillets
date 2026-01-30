import Coupon from "../../models/CouponSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from "../../utils/logger.js";

const loadCoupon = async (req, res) => {
  try {
    const { search } = req.query;
    const limit = 10;
    const page = parseInt(req.query.page) || 1;

    let query = {};
    if (search) {
      query = {
        code: { $regex: search, $options: "i" },
      };
    }

    const totalCoupons = await Coupon.countDocuments(query);
    const activeCoupons = await Coupon.countDocuments({
      ...query,
      isActive: true,
    });
    const expiredCoupons = await Coupon.countDocuments({
      ...query,
      expiresAt: { $lt: new Date() },
    });
    const usedCoupons = await Coupon.countDocuments({
      ...query,
      usedCount: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalCoupons / limit);
    const skip = (page - 1) * limit;

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render("admincoupon", {
      title: "Coupons",
currentRoute: "coupon",
      coupons,
      currentPage: page,
      totalPages,
      limit,
      search,
      totalCoupons,
      activeCoupons,
      expiredCoupons,
      usedCoupons,
      user: null,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountPercent,
      maxDiscountAmount,
      minPurchaseAmount,
      expiresAt,
      onlyFor,
      usageLimitPerUser,
      totalUsageLimit,
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Coupon code is required.",
      });
    }

    if (
      discountPercent === undefined ||
      discountPercent === null ||
      discountPercent === ""
    ) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Discount percentage is required.",
      });
    }

    if (!expiresAt) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Expiry date is required.",
      });
    }

    // normalize/parse
    const couponCode = code.trim().toUpperCase();
    const discount = Number.parseInt(discountPercent, 10);
    const minPurchase = minPurchaseAmount
      ? Number.parseInt(minPurchaseAmount, 10)
      : 0;
    const maxDiscount =
      maxDiscountAmount !== undefined &&
      maxDiscountAmount !== null &&
      maxDiscountAmount !== ""
        ? Number.parseInt(maxDiscountAmount, 10)
        : null;
    const perUserLimit = usageLimitPerUser
      ? Number.parseInt(usageLimitPerUser, 10)
      : 1;
    const totalLimit =
      totalUsageLimit !== undefined &&
      totalUsageLimit !== null &&
      totalUsageLimit !== ""
        ? Number.parseInt(totalUsageLimit, 10)
        : null;
    const expiryDate = new Date(expiresAt);

    // numeric validations
    if (Number.isNaN(discount) || discount <= 0) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Discount percentage must be a positive number.",
      });
    }

    if (Number.isNaN(minPurchase) || minPurchase < 0) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Minimum purchase amount must be a non-negative number.",
      });
    }

    if (
      maxDiscount !== null &&
      (Number.isNaN(maxDiscount) || maxDiscount < 0)
    ) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Maximum discount amount must be a non-negative number.",
      });
    }

    if (Number.isNaN(perUserLimit) || perUserLimit < 1) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Usage limit per user must be at least 1.",
      });
    }

    if (totalLimit !== null && (Number.isNaN(totalLimit) || totalLimit < 1)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Total usage limit must be at least 1 or omitted.",
      });
    }

    if (discount > 70) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Discount percentage cannot exceed 70%.",
      });
    }

    if (minPurchase < 800) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Minimum purchase amount must be at least ₹800.",
      });
    }

    if (maxDiscount !== null && maxDiscount > 10000) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Maximum discount amount must be less than ₹10,000.",
      });
    }

    // estimated discount check (discount% * minPurchase)
    if (maxDiscount !== null) {
      const estimatedDiscount = (discount / 100) * minPurchase;
      if (estimatedDiscount > maxDiscount) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message:
            "For the given discount percentage, the minimum purchase amount is too low compared to the maximum discount.",
        });
      }
    }

    if (totalLimit !== null && perUserLimit > totalLimit) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Usage limit per user cannot exceed total usage limit.",
      });
    }

    // expiry date validation
    if (Number.isNaN(expiryDate.getTime())) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Invalid expiry date format.",
      });
    }

    // compare dates at midnight to avoid timezone surprises
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryAtMidnight = new Date(expiryDate);
    expiryAtMidnight.setHours(0, 0, 0, 0);

    if (expiryAtMidnight < today) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Expiry date cannot be in the past.",
      });
    }

    // eligibility types - extended to include vipUsers (matches frontend)
    const allowedOnlyFor = ["all", "newUsers", "existingUsers", "vipUsers"];
    if (onlyFor && !allowedOnlyFor.includes(onlyFor)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Invalid coupon eligibility type.",
      });
    }

    // uniqueness check
    const existingCoupon = await Coupon.findOne({ code: couponCode });
    if (existingCoupon) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.COUPON.ALREADY_USED,
      });
    }

    // create and save
    const newCoupon = new Coupon({
      code: couponCode,
      discountPercent: discount,
      maxDiscountAmount: maxDiscount,
      minPurchaseAmount: minPurchase,
      expiresAt: expiryDate,
      onlyFor: onlyFor || "all",
      usageLimitPerUser: perUserLimit,
      totalUsageLimit: totalLimit,
      usedCount: 0,
      isActive: true,
    });

    await newCoupon.save();

    return res.status(Status.CREATED).json({
      success: true,
      message: "Coupon created successfully.",
      coupon: {
        id: newCoupon._id,
        code: newCoupon.code,
        discountPercent: newCoupon.discountPercent,
        expiresAt: newCoupon.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error adding coupon:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

const loadEditCoupon = async (req, res) => {
  try {
    const { id } = req.query;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      throw new Error("Not Coupon");
    }

    return res.render("editcoupon", {
      coupon,
      user: null,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const editCoupon = async (req, res) => {
  try {
    const {
      id,
      code,
      discountPercent,
      maxDiscountAmount,
      minPurchaseAmount,
      expiresAt,
      onlyFor,
      usageLimitPerUser,
      totalUsageLimit,
      isActive,
    } = req.body;

    if (!id) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.GENERAL.INVALID_INPUT,
      });
    }

    if (!code || !code.trim()) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.GENERAL.INVALID_INPUT,
      });
    }

    const existingCoupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
      _id: { $ne: id },
    });

    if (existingCoupon) {
      return res.status(Status.CONFLICT).json({
        success: false,
        message: message.COUPON.ALREADY_USED,
      });
    }

    const discount = parseInt(discountPercent, 10);
    const minPurchase = parseInt(minPurchaseAmount, 10);
    const maxDiscount = maxDiscountAmount
      ? parseInt(maxDiscountAmount, 10)
      : null;
    const perUserLimit = parseInt(usageLimitPerUser, 10) || 1;
    const totalLimit = totalUsageLimit ? parseInt(totalUsageLimit, 10) : null;

    if (isNaN(discount) || discount <= 0 || discount > 70) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Discount percentage must be between 1 and 70.",
      });
    }

    if (isNaN(minPurchase) || minPurchase < 800) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Minimum purchase amount must be at least ₹800.",
      });
    }

    if (maxDiscount !== null && (isNaN(maxDiscount) || maxDiscount < 0)) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Maximum discount amount must be a non-negative number.",
      });
    }

    if (maxDiscount !== null && maxDiscount > 10000) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Maximum discount amount cannot exceed ₹10,000.",
      });
    }

    const estimatedDiscount = (discount / 100) * minPurchase;
    if (maxDiscount !== null && estimatedDiscount > maxDiscount) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message:
          "Minimum purchase amount is too low for the selected discount.",
      });
    }

    if (totalLimit !== null && perUserLimit > totalLimit) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Usage limit per user cannot exceed total usage limit.",
      });
    }

    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime())) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Invalid expiry date format.",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Expiry date cannot be in the past.",
      });
    }

    const updateData = {
      code: code.trim().toUpperCase(),
      discountPercent: discount,
      maxDiscountAmount: maxDiscount,
      minPurchaseAmount: minPurchase,
      expiresAt: expiryDate,
      onlyFor,
      usageLimitPerUser: perUserLimit,
      totalUsageLimit: totalLimit,
      isActive: isActive === "true",
    };

    await Coupon.findByIdAndUpdate(id, updateData);

    return res.status(Status.ACCEPTED).json({
      success: true,
      message: "Coupon updated successfully.",
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.body;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Check if coupon has been used
    if (coupon.usedCount > 0) {
      return res.json({
        success: false,
        message: message.COUPON.ALREADY_USED,
      });
    }

    await Coupon.findByIdAndDelete(id);
    res.status(Status.OK).json({
      success: true,
      message: message.COUPON_REMOVED,
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const activateCoupon = async (req, res) => {
  try {
    const { id } = req.body;
    await Coupon.findByIdAndUpdate(id, { isActive: true });
    res.json({ success: true, message: message.COUPON.APPLIED_SUCCESS });
  } catch (error) {
    console.error("Error activating coupon:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const deactivateCoupon = async (req, res) => {
  try {
    const { id } = req.body;
    await Coupon.findByIdAndUpdate(id, { isActive: false });
    res
      .status(Status.OK)
      .json({ success: true, message: message.COUPON.INVALID });
  } catch (error) {
    console.error("Error deactivating coupon:", error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export {
  loadCoupon,
  createCoupon,
  deleteCoupon,
  loadEditCoupon,
  editCoupon,
  activateCoupon,
  deactivateCoupon,
};
