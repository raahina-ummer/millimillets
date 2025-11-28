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
    const findCategory = product.category;
    const relatedProducts = await Product.find().limit(4);

    console.log(product);

    const categoryOffer = findCategory?.categoryOffer + productOffer;
    const productOffer = product.productOffer || 0;
    const totalOffer = categoryOffer + productOffer;

    res.render("productdetails", {
      user: userData,
      product,
      quantity: product.quantity,
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
