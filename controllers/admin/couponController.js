import Coupon from "../../models/CouponSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";

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
    return res.json({ success: false, message: error.message });
  }
};


 const createCoupon = async (req, res) => {
  try {
    console.log("the add Coupon req.body", req.body);
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

    // Check if already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    // Validate expiry date
    if (new Date(expiresAt) < new Date()) {
      return res.json({
        success: false,
        message: "Expiry date cannot be in the past",
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
    console.log("The estimatedDiscount is", estimatedDiscount);
    if (maxDiscountAmount && estimatedDiscount > maxDiscountAmount) {
      throw new Error("Minimum purchase too low for the discount percent");
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountPercent: parseInt(discountPercent),
      maxDiscountAmount: maxDiscountAmount ? parseInt(maxDiscountAmount) : null,
      minPurchaseAmount: parseInt(minPurchaseAmount) || 0,
      expiresAt: new Date(expiresAt),
      onlyFor,
      usageLimitPerUser: parseInt(usageLimitPerUser) || 1,
      totalUsageLimit: totalUsageLimit ? parseInt(totalUsageLimit) : null,
    });

    await newCoupon.save();
    res.status(Status.CREATED).json({ 
      success: true, 
      message: "Coupon added successfully" 
    });
  } catch (error) {
    console.error("Error adding coupon:", error);
    res.json({ success: false, message: error.message });
  }
};

const loadEditCoupon = async (req, res) => {
  try {
    const { id } = req.query;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.redirect("/pageerror");
    }

    return res.render("editcoupon", { 
        coupon,
         user: null,
     });
  } catch (error) {
    console.error(error);
    return res.redirect("/pageerror");
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
    res.status(Status.ACCEPTED).json({success: true,message: "Coupon updated successfully" 
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.json({ success: false, message: error.message });
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
      return res.json({success: false, message:"Cannot delete coupon that has been used. Deactivate it instead.",
      });
    }

    await Coupon.findByIdAndDelete(id);
    res.json({ success: true, message: "Coupon deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.json({success: false,message: message.SERVER_ERROR });
  }
};

 const activateCoupon = async (req, res) => {
  try {
    const { id } = req.body;
    await Coupon.findByIdAndUpdate(id, { isActive: true });
    res.json({success: true,message: "Coupon activated successfully"});
  } catch (error) {
    console.error("Error activating coupon:", error);
    res.json({success: false,message: "Error activating coupon"});
  }
};

 const deactivateCoupon = async (req, res) => {
  try {
    const { id } = req.body;
    await Coupon.findByIdAndUpdate(id, { isActive: false });
    res.json({ success: true,message: "Coupon deactivated successfully"});
  } catch (error) {
    console.error("Error deactivating coupon:", error);
    res.json({success: false,message: "Error deactivating coupon"});
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