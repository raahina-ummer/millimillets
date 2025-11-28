import Product from "../../models/ProductSchema.js";
import User from "../../models/userSchema.js";
import Category from "../../models/CategorySchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";


const productDetails = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userData = await User.findById(userId);
    const productId = req.query.id;

    const product = await Product.findById(productId).populate("category");
    if (!product) return res.redirect("/pageNotFound");

    const relatedProducts = await Product.find().limit(4);

    const findCategory = product.category;

    const productOffer = product.productOffer?.discountPercentage || 0;
    const categoryOffer = findCategory?.categoryOffer || 0;

    const totalOffer = productOffer + categoryOffer;

    res.render("productdetails", {
      user: userData,
      product,
      quantity: product.variant?.[0]?.stock || 0,
      totalOffer,
      category: findCategory,
      relatedProducts,
      wishlist: [],
    });

  } catch (error) {
    console.error("Error fetching product details:", error);
    res.redirect("pageNotFound");
  }
};


export  { productDetails };
