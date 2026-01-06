import Product from "../../models/ProductSchema.js";
import User from "../../models/userSchema.js";
import Category from "../../models/CategorySchema.js";
import Wishlist from "../../models/WishListSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from '../../utils/logger.js';


const productDetails = async (req, res) => {
  try {
    const userId = req.session.user?.id; 
    const productId = req.params.id;

    
    if (!productId) {
      return res.redirect("/pageNotFound");
    }

    const product = await Product.findById(productId).populate("category");
    if (!product || product.isBlocked) {
      return res.redirect("/pageNotFound");
    }

    //  Get user data only if logged in
    let userData = null;
    let userWishlist = [];
    if (userId) {
      userData = await User.findById(userId);
      //  Get actual wishlist 
      userWishlist = await Wishlist.find({ userId }).select('productId');
    }

    // Get related products from same category, exclude current product
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false,
      status: 'Available'
    })
    .limit(4)
    .sort({ createdAt: -1 });

    const findCategory = product.category;

    //  Calculate offers correctly (use highest offer, not sum)
    const productOffer = product.productOffer?.discountPercentage || 0;
    const categoryOffer = findCategory?.categoryOffer || 0;
    
    // Use the HIGHER offer, not sum 
    const totalOffer = Math.max(productOffer, categoryOffer);

    //  Get the first available variant or default values
    const firstVariant = product.variant?.[0] || [];
    const quantity = firstVariant.stock || 0;

    res.render("productdetails", {
      user: userData,
      product,
      quantity,
      totalOffer,
      category: findCategory,
      relatedProducts,
      wishlist: userWishlist,
    });

  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({sucess:false,message:message.SERVER_ERROR})
  }
};




export  { productDetails };
