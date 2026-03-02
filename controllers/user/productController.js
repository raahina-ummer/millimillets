import Product from "../../models/ProductSchema.js";
import User from "../../models/userSchema.js";
import Category from "../../models/CategorySchema.js";
import Wishlist from "../../models/WishListSchema.js";
import { applyDiscount } from "../../Helpers/discountApply.js";
import { calculateFinalPriceForVariant } from "../../utils/offerCalculator.js";

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const productId = req.params.id;

    if (!productId) return res.redirect("/pageNotFound");

    const product = await Product.findById(productId).populate("category");
    if (!product) {
      return res.status(404).render("product-unavailable", {
        message: "Product not found",
        user: req.session.user || null
      });
    }

    if (
      product.isBlocked ||
      product.status !== "Available" ||
      !product.category?.isListed
    ) {
      return res.status(410).render("product-unavailable", {
        message: "This item is currently unavailable",
        user: req.session.user || null
      });
    }
    if (!product.variant || product.variant.length === 0) {
      return res.render("product-unavailable", {
        message: "This item has no purchasable variants",
        user: req.session.user || null
      });
    }


    /* Wishlist */
    let isInWishlist = false;
    if (userId) {
      isInWishlist = await Wishlist.exists({
        userId,
        productId: productId
      });
    }

    /* Related Products */
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false,
      status: "Available"
    })
      .limit(4)
      .sort({ createdAt: -1 });

    //OFFER LOGIC 
    const now = new Date();

    const isValidOffer = (offer) =>
      offer &&
      offer.offerActive &&
      (!offer.offerStartDate || new Date(offer.offerStartDate) <= now) &&
      (!offer.offerEndDate || new Date(offer.offerEndDate) >= now);

    const productOffer = isValidOffer(product.productOffer)
      ? product.productOffer
      : null;

    const categoryOffer = isValidOffer(product.category?.categoryOffer)
      ? product.category.categoryOffer
      : null;


    // const maxDiscountAmount = bestOffer?.maxDiscountAmount || null;

    //PRICE CALCULATION 
    const firstVariant =
      product.variant.find(v => v.stock > 0) || product.variant[0];

    const { basePrice, finalPrice, appliedOffer } =
      calculateFinalPriceForVariant(
        firstVariant,
        product,
        product.category
      );
    //TOTAL STOCK 
    const totalStock = product.variant.reduce(
      (sum, v) => sum + v.stock,
      0
    );

    res.render("productdetails", {
      user: userId ? await User.findById(userId) : null,
      product,
      finalPrice,
      category: product.category,
      strikePrice: basePrice,
      discountPercentage: appliedOffer.discountPercentage,
      totalStock,
      isInWishlist,
      relatedProducts,
    });


  } catch (error) {
    logger.error("Product details error:", error);
    res.redirect("/pageNotFound");
  }
};

export const getVariantPrice = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    const product = await Product.findById(productId).populate("category");
    if (!product) {
      return res.json({ success: false });
    }

    const variant = product.variant.id(variantId);
    if (!variant) {
      return res.json({ success: false });
    }

    const { basePrice, finalPrice, appliedOffer } =
      calculateFinalPriceForVariant(
        variant,
        product,
        product.category
      );
    res.json({
      success: true,
      finalPrice,
      strikePrice: basePrice,
      discountPercentage: appliedOffer.discountPercentage
    });


  } catch (err) {
    res.json({ success: false });
  }
};

export { productDetails }
