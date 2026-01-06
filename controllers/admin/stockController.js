import Product from "../../models/ProductSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";

const getStockManagement = async (req, res) => {
  try {
    const { search, filter, page = 1, limit = 10 } = req.query;
    let query = { isBlocked: false };

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    let aggregationPipeline = [
      { $match: query },
      { $addFields: { totalStock: { $sum: "$variant.stock" } } }
    ];

    if (filter) {
      const stockFilters = {
        critical: { totalStock: { $lt: 10, $gt: 0 } },
        low: { totalStock: { $gte: 10, $lt: 50 } },
        good: { totalStock: { $gte: 50 } },
        out: { totalStock: 0 }
      };

      if (stockFilters[filter]) aggregationPipeline.push({ $match: stockFilters[filter] });
    }

    aggregationPipeline.push(
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    const products = await Product.aggregate(aggregationPipeline);
    await Product.populate(products, { path: "category" });

    let countPipeline = [
      { $match: query },
      { $addFields: { totalStock: { $sum: "$variant.stock" } } }
    ];

    if (filter && stockFilters?.[filter]) {
      countPipeline.push({ $match: stockFilters[filter] });
    }

    countPipeline.push({ $count: "total" });

    const countResult = await Product.aggregate(countPipeline);
    const totalProducts = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit);

    const productsWithStock = products.map(product => ({
      ...product,
      stock: product.totalStock,
      regularPrice:
        product.variant.length > 0
          ? product.variant.reduce((sum, v) => sum + v.regularPrice, 0) / product.variant.length
          : 0,
      salePrice:
        product.variant.length > 0
          ? product.variant.reduce((sum, v) => sum + v.salePrice, 0) / product.variant.length
          : 0
    }));

    res.render("stockalert", {
      products: productsWithStock,
      search,
      filter,
      currentPage: parseInt(page),
      totalPages,
      limit: parseInt(limit),
      totalProducts
    });

  } catch (error) {
    console.error(error.message);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

 const updateVariantStock = async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;

    const product = await Product.findOne({
      _id: productId,
      "variant._id": variantId
    });

    if (!product) return res.json({ success: false, message: "Product not found" });

    const variant = product.variant.id(variantId);
    variant.stock += parseInt(quantity);

    await product.save();

    res.json({ success: true, message: "Stock updated" });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error" });
  }
};


export { getStockManagement,
        updateVariantStock,
 };
