
import User from "../../models/userSchema.js";
import Wishlist from "../../models/WishListSchema.js";
import Product from "../../models/ProductSchema.js";
import dotenv from "dotenv";
dotenv.config();
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from "../../utils/logger.js";

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user.id;

    let wishlist = await Wishlist.findOne({ userId }).populate({
      path: "products.productId",
      populate: "category",
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, products: [] });
    }

    const user = await User.findById(userId);

    const items = wishlist?.products || [];

    //calculate totalValuefrom variant[0].salePrice
    const totalValue = items.reduce((acc, cur) => {
      const price =
        cur.productId?.variant?.reduce(
          (min, v) => Math.min(min, v.salePrice || Infinity),
          Infinity,
        ) || 0;

      return acc + price;
    }, 0);

    //  Calculate in-stock count from variant stock
    const inStockCount = items.filter((item) => {
      if (!item.productId?.variant) return false;
      const totalStock = item.productId.variant.reduce(
        (sum, v) => sum + (v.stock || 0),
        0,
      );
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
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const addToWishList = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.WISHLIST.PRODUCT_NOT_FOUND });

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) wishlist = new Wishlist({ userId, products: [] });

    const index = wishlist.products.findIndex(
      (item) => item.productId.toString() === productId,
    );

    if (index > -1) {
      wishlist.products.splice(index, 1);
      await wishlist.save();

      return res.status(Status.OK).json({
        success: true,
        action: "removed",
      });
    } else {
      wishlist.products.push({ productId });
      await wishlist.save();

      return res.status(Status.OK).json({
        success: true,
        action: "added",
      });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const deleteWishlist = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const deleted = await Wishlist.findOneAndUpdate(
      { userId },
      { $set: { products: [] } },
      { new: true },
    );

    if (!deleted) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.WISHLIST.WISHLIST_NOT_FOUND,
      });
    }

    return res
      .status(Status.OK)
      .json({ success: true, message: message.WISHLIST.CLEARED });
  } catch (error) {
    console.error(error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const userId = req.session.user.id;

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.WISHLIST.WISHLIST_NOT_FOUND });

    const findProductIndex = wishlist.products.findIndex(
      (item) => productId.toString() === item.productId.toString(),
    );

    if (findProductIndex === -1)
      return res
        .status(Status.BAD_REQUEST)
        .json({ success: false, message: message.WISHLIST.PRODUCT_NOT_FOUND });

    wishlist.products.splice(findProductIndex, 1);
    await wishlist.save();

    return res
      .status(Status.OK)
      .json({ success: true, message: message.WISHLIST.ITEM_REMOVED });
  } catch (error) {
    console.error(error);
    return res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export { loadWishlist, deleteWishlist, removeFromWishlist, addToWishList };
