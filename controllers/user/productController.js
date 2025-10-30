const Product = require("../../models/ProductSchema")
const Category = require("../../models/CategorySchema.js");
const User = require("../../models/userSchema");


const productDetails= async (req,res)=>{
    try {

        const userId = req.session.user.id;
        const userData = await User.findById(userId)
        const productId = req.query.id;
        const product = await Product.findById(productId).populate("category");
        const findCategory = product.category;
        const relatedProducts = await Product.find().limit(4);
        console.log(product)
        // const categoryOffer = findCategory ?.categoryOffer +productOffer;
        // const productOffer = product.productOffer || 0;
        // const totalOffer = categoryOffer+productOffer;
        res.render("productdetails",{
            user:userData,
            product:product,
            quantity:product.quantity,
            // totalOffer:totalOffer,
            category:findCategory,
            relatedProducts,
            wishlist:[]
        })
        


        
    } catch (error) {
        console.error("Error for fetching product details",error);
        res.redirect("pageNotFound")
        
    }
}


module.exports = {
    productDetails,
}