import Product from "../../models/ProductSchema.js";

const getStockManagement = async (req, res) => {
  try {
    const { search, filter, page = 1, limit = 10 } = req.query;
    let query = { isBlocked: false };

    // Search functionality
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    // Filter by stock levels
    // Since stock is in variants, we need to use aggregation
    let aggregationPipeline = [
      { $match: query },
      {
        $addFields: {
          totalStock: { $sum: "$variant.stock" }
        }
      }
    ];

    // Apply filter based on total stock
    if (filter) {
      switch (filter) {
        case "critical":
          aggregationPipeline.push({
            $match: { totalStock: { $lt: 10, $gt: 0 } }
          });
          break;
        case "low":
          aggregationPipeline.push({
            $match: { totalStock: { $gte: 10, $lt: 50 } }
          });
          break;
        case "good":
          aggregationPipeline.push({
            $match: { totalStock: { $gte: 50 } }
          });
          break;
        case "out":
          aggregationPipeline.push({
            $match: { totalStock: 0 }
          });
          break;
      }
    }

    // Add pagination
    aggregationPipeline.push(
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    // Execute aggregation
    const products = await Product.aggregate(aggregationPipeline);

    // Populate category after aggregation
    await Product.populate(products, { path: "category" });

    // Get total count for pagination
    let countPipeline = [
      { $match: query },
      {
        $addFields: {
          totalStock: { $sum: "$variant.stock" }
        }
      }
    ];

    if (filter) {
      switch (filter) {
        case "critical":
          countPipeline.push({
            $match: { totalStock: { $lt: 10, $gt: 0 } }
          });
          break;
        case "low":
          countPipeline.push({
            $match: { totalStock: { $gte: 10, $lt: 50 } }
          });
          break;
        case "good":
          countPipeline.push({
            $match: { totalStock: { $gte: 50 } }
          });
          break;
        case "out":
          countPipeline.push({
            $match: { totalStock: 0 }
          });
          break;
      }
    }

    countPipeline.push({ $count: "total" });
    const countResult = await Product.aggregate(countPipeline);
    const totalProducts = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit);

    // Add stock property to products for template compatibility
    const productsWithStock = products.map(product => ({
      ...product,
      stock: product.totalStock,
      // Calculate average prices from variants
      regularPrice: product.variant.length > 0 
        ? product.variant.reduce((sum, v) => sum + v.regularPrice, 0) / product.variant.length 
        : 0,
      salePrice: product.variant.length > 0 
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
      totalProducts,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateStockQuantity = async (req, res) => {
  try {
    const { productId, quantity, variantIndex = 0 } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Invalid request - productId and quantity are required"
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid quantity"
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    if (!product.variant || product.variant.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product has no variants"
      });
    }

    // If variantIndex is provided, update that specific variant
    // Otherwise, update the first variant
    const index = parseInt(variantIndex) || 0;

    if (index >= product.variant.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant index"
      });
    }

    // Add quantity to the variant's stock
    product.variant[index].stock += parseInt(quantity);

    // Update product status based on total stock
    const totalStock = product.variant.reduce((sum, v) => sum + v.stock, 0);
    if (totalStock === 0) {
      product.status = "Out of Stock";
    } else {
      product.status = "Available";
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product stock updated successfully",
      newStock: product.variant[index].stock,
      totalStock: totalStock
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export { getStockManagement, 
        updateStockQuantity,
         };