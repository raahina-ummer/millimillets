import Coupon from "../../models/CouponSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from '../../utils/logger.js';

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
    const activeCoupons = await Coupon.countDocuments({ ...query, isActive: true });
    const expiredCoupons = await Coupon.countDocuments({
      ...query,
      expiresAt: { $lt: new Date() }
    });
    const usedCoupons = await Coupon.countDocuments({ ...query, usedCount: { $gt: 0 } });

    const totalPages = Math.ceil(totalCoupons / limit);
    const skip = (page - 1) * limit;

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render("admincoupon", {
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
    return res.Status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
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

    //validations
    if (!code || !code.trim()) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    if (discountPercent === undefined || discountPercent === null) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Discount percentage is required",
      });
    }

    if (!expiresAt) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Expiry date is required",
      });
    }



    const couponCode = code.trim().toUpperCase();
    const discount = parseInt(discountPercent);
    const minPurchase = parseInt(minPurchaseAmount) || 0;
    const maxDiscount = maxDiscountAmount ? parseInt(maxDiscountAmount) : null;
    const perUserLimit = parseInt(usageLimitPerUser) || 1;
    const totalLimit = totalUsageLimit ? parseInt(totalUsageLimit) : null;
    const expiryDate = new Date(expiresAt);

    if (isNaN(discount) || discount <= 0) {
      throw new Error("Discount percentage must be greater than 0");
    }

    if (isNaN(minPurchase) || minPurchase < 0) {
      throw new Error("Minimum purchase amount cannot be negative");
    }

    if (maxDiscount !== null && (isNaN(maxDiscount) || maxDiscount < 0)) {
      throw new Error("Max discount amount cannot be negative");
    }

    if (perUserLimit < 1) {
      throw new Error("Usage limit per user must be at least 1");
    }

    if (totalLimit !== null && totalLimit < 1) {
      throw new Error("Total usage limit must be at least 1");
    }


    const existingCoupon = await Coupon.findOne({ code: couponCode });
    if (existingCoupon) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Coupon code already exists",
      });
    }



    if (isNaN(expiryDate.getTime())) {
      throw new Error("Invalid expiry date");
    }

    if (expiryDate < new Date()) {
      throw new Error("Expiry date cannot be in the past");
    }


    if (discount > 70) {
      throw new Error("Discount percentage cannot exceed 70%");
    }

    if (minPurchase < 800) {
      throw new Error("Minimum purchase amount must be at least 800");
    }

    if (maxDiscount !== null && maxDiscount > 10000) {
      throw new Error("Maximum discount amount must be below 10000");
    }

    const estimatedDiscount = (discount / 100) * minPurchase;
    if (maxDiscount !== null && estimatedDiscount > maxDiscount) {
      throw new Error("Minimum purchase amount is too low for this discount");
    }

    if (totalLimit !== null && perUserLimit > totalLimit) {
      throw new Error(
        "Usage limit per user cannot exceed total usage limit"
      );
    }



    const allowedOnlyFor = ["all", "newUsers", "existingUsers"];
    if (onlyFor && !allowedOnlyFor.includes(onlyFor)) {
      throw new Error("Invalid coupon eligibility type");
    }


    const newCoupon = new Coupon({
      code: couponCode,
      discountPercent: discount,
      maxDiscountAmount: maxDiscount,
      minPurchaseAmount: minPurchase,
      expiresAt: expiryDate,
      onlyFor: onlyFor || "all",
      usageLimitPerUser: perUserLimit,
      totalUsageLimit: totalLimit,
    });

    await newCoupon.save();

    return res.status(Status.CREATED).json({
      success: true,
      message: message.COUPON_APPLIED_SUCCESSFULLY,
    });

  } catch (error) {
    console.error("Error adding coupon:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.SERVER_ERROR,
    });
  }
};



const loadEditCoupon = async (req, res) => {
  try {
    const { id } = req.query;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      throw new Error("Not Coupon")
    }

    return res.render("editcoupon", {
      coupon,
      user: null,
    });
  } catch (error) {
    console.error(error);
    return res.Status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR })
  }
};


const editCoupon = async (req, res) => {
  try {
    console.log(req.body);
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

    // Check if coupon code already exists (excluding current coupon)
    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase(),
      _id: { $ne: id },
    });

    if (existingCoupon) {
      return res.json({
        success: false,
        message: "Coupon code already exists"
      });
    }

    // Validate max discount amount
    if (maxDiscountAmount > 10000) {
      throw new Error("The max discount should be below 10000");
    }

    // Validate min purchase amount
    if (minPurchaseAmount < 800) {
      throw new Error("The min purchase amount should be atleast 800 or above");
    }

    // Validate discount percent
    if (discountPercent > 70) {
      throw new Error("The maximum discount amount should be below 70%");
    }

    // Validate relationship between discount percent and minimum purchase
    const estimatedDiscount = (discountPercent / 100) * minPurchaseAmount;
    if (maxDiscountAmount && estimatedDiscount > maxDiscountAmount) {
      throw new Error("Minimum purchase too low for the discount percent");
    }

    const updateData = {
      code: code.toUpperCase(),
      discountPercent: parseInt(discountPercent),
      maxDiscountAmount: maxDiscountAmount ? parseInt(maxDiscountAmount) : null,
      minPurchaseAmount: parseInt(minPurchaseAmount) || 0,
      expiresAt: new Date(expiresAt),
      onlyFor,
      usageLimitPerUser: parseInt(usageLimitPerUser) || 1,
      totalUsageLimit: totalUsageLimit ? parseInt(totalUsageLimit) : null,
      isActive: isActive === "true",
    };

    await Coupon.findByIdAndUpdate(id, updateData);
    res.status(Status.ACCEPTED).json({
      success: true, message: "Coupon updated successfully"
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return res.Status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR })

  }
};



const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.body;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.json({
        success: false,
        message: "Coupon not found"
      });
    }

    // Check if coupon has been used
    if (coupon.usedCount > 0) {
      return res.json({
        success: false, message: "Cannot delete coupon that has been used. Deactivate it instead.",
      });
    }

    await Coupon.findByIdAndDelete(id);
    res.Status(Status.OK).json({
      success: true, message: message.COUPON_REMOVED
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res.Status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR })
  }
};



const activateCoupon = async (req, res) => {
  try {
    const { id } = req.body;
    await Coupon.findByIdAndUpdate(id, { isActive: true });
    res.json({ success: true, message: "Coupon activated successfully" });
  } catch (error) {
    console.error("Error activating coupon:", error);
    return res.Status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR })
  }
};




const deactivateCoupon = async (req, res) => {
  try {
    const { id } = req.body;
    await Coupon.findByIdAndUpdate(id, { isActive: false });
    res.Status(Status.OK).json({ success: true, message: "Coupon deactivated successfully" });
  } catch (error) {
    console.error("Error deactivating coupon:", error);
    return res.Status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR })
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
}