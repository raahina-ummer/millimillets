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
    if (!product || product.isBlocked) {
      return res.redirect("/pageNotFound");
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

    const productDiscount = productOffer?.discountPercentage || 0;
    const categoryDiscount = categoryOffer?.discountPercentage || 0;

    const bestOffer =
      productDiscount >= categoryDiscount ? productOffer : categoryOffer;

    const discountPercentage = bestOffer?.discountPercentage || 0;
    const maxDiscountAmount = bestOffer?.maxDiscountAmount || null;

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
      category: product.category,
      relatedProducts,
      isInWishlist,
      basePrice,
      finalPrice: Math.round(finalPrice),
      discountPercentage,
      totalStock
    });

  } catch (error) {
    console.error("Product details error:", error);
    res.redirect("/pageNotFound");
  }
};
export const getVariantPrice = async (req, res) => {
  const { productId, variantId } = req.params;

  const product = await Product.findById(productId).populate("category");
  if (!product) return res.status(404).json({ success: false });

  const variant = product.variant.find(
    v => v._id.toString() === variantId
  );
  if (!variant) return res.status(404).json({ success: false });

  const { basePrice, finalPrice, appliedOffer } =
    calculateFinalPriceForVariant(
      variant,
      product,
      product.category
    );

  res.json({
    success: true,
    basePrice,
    finalPrice,
    discountPercentage: appliedOffer.discountPercentage || 0
  });
};
export { productDetails };
