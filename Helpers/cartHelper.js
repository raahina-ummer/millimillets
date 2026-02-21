export const resolveVariant = (product, variantId) => {
  if (!product || !Array.isArray(product.variant)) return null;

  if (!variantId) return null;

  return product.variant.find(
    v => v._id.toString() === variantId.toString()
  ) || null;
};




export const isValidCartItem = (item) => {
  if (!item) return false;

  const product = item.productId;
  if (!product) return false;

  const variant = resolveVariant(product, item.variantId);
  if (!variant) return false;

  if (
    product.isBlocked ||
    !product.category ||
    !product.category.isListed
  ) {
    return false;
  }

 
  if (!Number.isInteger(item.quantity) || item.quantity < 1) {
    return false;
  }

  
  return variant.stock >= item.quantity;
};

export const getValidCartItems = (cart) => {
  if (!cart || !Array.isArray(cart.products)) return [];
  return cart.products.filter(isValidCartItem);
};