import Product from "../../models/ProductSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import mongoose from "mongoose";
import logger from '../../utils/logger.js';






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
          const stockFilters = {
        critical: { totalStock: { $lt: 10, $gt: 0 } },
        low: { totalStock: { $gte: 10, $lt: 50 } },
        good: { totalStock: { $gte: 50 } },
        out: { totalStock: 0 }
          }

    let aggregationPipeline = [
      { $match: query },
      { $addFields: { totalStock: { $sum: "$variant.stock" } } }
    ];


      if (stockFilters[filter]) aggregationPipeline.push({ $match: stockFilters[filter] });
    

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
      message:message.GENERAL.SERVER_ERROR,
    });
  }
};


const updateVariantStock = async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;

    // Validate input
    if (!productId || !variantId || !quantity) {
      return res.json({ 
        success: false, 
        message: message.STOCK.MISSING_FIELDS 
      });
    }

    const quantityToAdd = Number(quantity);
    if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
      return res.json({ 
        success: false, 
        message: message.STOCK.INVALID_QUANTITY
    })
  }

    // Convert to ObjectId if needed
    const productObjectId = mongoose.Types.ObjectId.isValid(productId) 
      ? new mongoose.Types.ObjectId(productId) 
      : productId;

    // Find the product
    const product = await Product.findById(productObjectId);
    
    if (!product) {
      return res.json({ 
        success: false, 
        message: message.STOCK.PRODUCT_NOT_FOUND
      });
    }


    // Find the variant using Mongoose subdocument id() method
    const variant = product.variant.id(variantId);
    
    if (!variant) {
      
      return res.json({ 
        success: false, 
        message: message.STOCK.VARIANT_NOT_FOUND
      });
    }

    const oldStock = Number(variant.stock) || 0;
    
    // Update the stock
    variant.stock = oldStock + quantityToAdd;

    // Mark the variant array as modified (important for Mongoose)
    product.markModified('variant');

    
    const savedProduct = await product.save();
    
    const verifyVariant = savedProduct.variant.id(variantId);
    
    if (verifyVariant.stock !== variant.stock) {
      console.log('Warning: Stock mismatch after save');
    }

    res.status(Status.OK).json({ 
      success: true, 
      message: message.STOCK.UPDATED_SUCCESS,
      data: {
        productName: product.productName,
        variantName: variant.unitType,
        oldStock,
        addedQuantity: quantityToAdd,
        newStock: verifyVariant.stock
      }
    });

  } catch (err) {
    console.error('Error updating stock:', err);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: message.GENERAL.SERVER_ERROR
    });
  }
};



export { getStockManagement,
        updateVariantStock,
 };
