// wishlist.controller.js
import User from "../../models/userSchema.js";
import Wishlist from "../../models/WishListSchema.js";
import Product from "../../models/ProductSchema.js";
import dotenv from "dotenv";
dotenv.config();
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from '../../utils/logger.js';


const loadWishlist = async (req, res) => {
  try {

    const userId = req.session.user?._id || req.session.user?.id || req.session.user;

    // Fetch wishlist
    let wishlist = await Wishlist.findOne({ userId }).populate({
      path: "products.productId",
      populate: "category",
    });

    // Fetch user details
    const user = await User.findById(userId);

    const items = wishlist?.products || [];

      //calculate totalValuefrom variant[0].salePrice
      const totalValue = items.reduce((acc, cur) => {
      const price = cur.productId?.variant?.[0]?.salePrice || 0;
      return acc + price;
      }, 0);

    //  Calculate in-stock count from variant stock
    const inStockCount = items.filter((item) => {
      if (!item.productId?.variant) return false;
      const totalStock = item.productId.variant.reduce((sum, v) => sum + (v.stock || 0), 0);
      return totalStock > 0;
    }).length;

    return res.status(200).render("wishlist", {
      wishlistItems: items,
      totalValue,
      inStockCount,
      user: user || null, 
    });
  } catch (error) {
    console.error(error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};


const addToWishList = async (req, res) => {
  try {
    console.log("addToWishList Invocked");
   
    const userId = req.session.user?._id || req.session.user?.id || req.session.user;
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) 
        return res.status(Status.BAD_REQUEST).json({success: false, message: "The product doesn't exist"});

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) wishlist = new Wishlist({ userId, products: [] });

    const checkProduct = await Wishlist.findOne({
      userId,
      "products.productId": productId,
    });

    if (checkProduct) 
        return res.status(Status.BAD_REQUEST).json({success: false, message: "The product already exists"});

    wishlist.products.push({ productId });
    await wishlist.save();

    return res.status(Status.OK).json({ success: true, message: "Added to wishlist" });
  } catch (error) {
    console.error(error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};

const deleteWishlist = async (req, res) => {
  try {
    const userId = req.session.user?._id || req.session.user?.id || req.session.user;
    
    const deleted = await Wishlist.findOneAndUpdate(
      { userId },
      { $set: { products: [] } },
      { new: true }
    );

    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: "Could not update... Something went wrong",
      });
    }

    return res.status(Status.OK).json({ success: true, message: "Wishlist cleared successfully" });
  } catch (error) {
    console.error(error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    console.log("removeFromWishlist invocked")
    const { productId } = req.params;

    const userId = req.session.user?._id || req.session.user?.id || req.session.user;

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) 
        return res.status(Status.BAD_REQUEST).json({success: false, message: "Wishlist not found"});

    const findProductIndex = wishlist.products.findIndex(
      (item) => productId.toString() === item.productId.toString()
    );

    if (findProductIndex === -1) 
        return res.status(Status.BAD_REQUEST).json({success: false, message: "The product not found"});

    wishlist.products.splice(findProductIndex, 1);
    await wishlist.save();

    return res.status(Status.OK).json({success: true,message: "The product removed from the wishlist successfully" });
  } catch (error) {
    console.error(error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.SERVER_ERROR });
  }
};

export {
  loadWishlist,
  deleteWishlist,
  removeFromWishlist,
  addToWishList,
};