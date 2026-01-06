const Messages = {
  // Auth & User
  USER_NOT_LOGGED_IN: "Please login to continue.",
  USER_ALREADY_EXISTS: "User already exists with this email or phone.",
  USER_NOT_FOUND: "User not found.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_BLOCKED: "Your account has been blocked. Please contact support.",
  OTP_SENT: "OTP has been sent to your registered mobile number.",
  OTP_INVALID: "Invalid OTP. Please try again.",
  OTP_EXPIRED: "OTP has expired. Please request a new one.",
  PASSWORD_RESET_SUCCESS: "Password has been reset successfully.",
  PASSWORD_MISMATCH: "Passwords do not match.",
  UNAUTHORIZED_ACCESS: "Unauthorized access. Please login again.",

  // Category
  CATEGORY_ALREADY_EXISTS: "The category already exists",
  CATEGORY_UPDATED_SUCCESS: "Category updated successfully",
  CATEGORY_NOT_FOUND: "Category not found",
  CATEGORY_OFFER_UPDATED_SUCCESS: "Category offer updated successfully",
  CATEGORY_OFFER_DELETED_SUCCESS: "Category offer deleted successfully",

  DISCOUNT_PERCENTAGE_INVALID: "Discount must be between 0 and 100",
  MAX_DISCOUNT_NEGATIVE: "Max discount amount cannot be negative",
  OFFER_DATE_INVALID: "Start date cannot be after end date",
  CATEGORY_NOT_FOUND: "Category not found",
  CATEGORY_CREATED_SUCCESS: "Category created successfully",
CATEGORY_UPDATED_SUCCESS: "Category updated successfully",
CATEGORY_OFFER_UPDATED_SUCCESS: "Category offer updated successfully",




  // Product
  PRODUCT_NOT_FOUND: "Product not found.",
  PRODUCT_OUT_OF_STOCK: "This product is currently out of stock.",
  PRODUCT_UNAVAILABLE: "This product is no longer available.",
  PRODUCT_ALREADY_EXISTS: "Product with this name already exists.",
  CATEGORY_NOT_FOUND: "Category not found.",
  BRAND_NOT_FOUND: "Brand not found.",

  // Cart
  CART_EMPTY: "Your cart is empty.",
  ITEM_ALREADY_IN_CART: "Item is already in your cart.",
  ITEM_ADDED_TO_CART: "Item added to cart successfully.",
  ITEM_REMOVED_FROM_CART: "Item removed from cart.",
  CART_UPDATED_SUCCESSFULLY: "Cart updated successfully.",

  // Wishlist
  ITEM_ADDED_TO_WISHLIST: "Item added to wishlist.",
  ITEM_ALREADY_IN_WISHLIST: "Item already exists in wishlist.",
  ITEM_REMOVED_FROM_WISHLIST: "Item removed from wishlist.",
  WISHLIST_EMPTY: "Your wishlist is empty.",

  // Order
  ORDER_NOT_FOUND: "Order not found.",
  ORDER_PLACED_SUCCESSFULLY: "Order placed successfully.",
  ORDER_CANCELLED_SUCCESSFULLY: "Order cancelled successfully.",
  ORDER_ALREADY_CANCELLED: "This order item is already cancelled.",
  ORDER_ITEM_NOT_FOUND: "Order item not found.",
  RETURN_REQUEST_SUBMITTED: "Return request submitted successfully.",
  RETURN_REQUEST_REJECTED: "Return request has been rejected.",
  ORDER_CANNOT_BE_CANCELLED: "Order cannot be cancelled at this stage.",
  INVALID_ORDER_ID: "Invalid order ID.",
  NO_ORDERS_FOUND: "No orders found.",

  // Address
  ADDRESS_ADDED: "Address added successfully.",
  ADDRESS_UPDATED: "Address updated successfully.",
  ADDRESS_DELETED: "Address deleted successfully.",
  ADDRESS_NOT_FOUND: "Address not found.",

  // Payment
  PAYMENT_FAILED: "Payment failed. Please try again.",
  PAYMENT_SUCCESS: "Payment successful.",
  PAYMENT_PENDING: "Payment is still pending.",
  INVALID_PAYMENT_METHOD: "Invalid payment method selected.",
  REFUND_INITIATED: "Refund has been initiated.",
  REFUND_COMPLETED: "Refund completed successfully.",
  WALLET_BALANCE_INSUFFICIENT: "Insufficient wallet balance.",

  // Coupon & Offers
  COUPON_INVALID: "Invalid coupon code.",
  COUPON_EXPIRED: "This coupon has expired.",
  COUPON_ALREADY_USED: "You have already used this coupon.",
  COUPON_MINIMUM_AMOUNT_NOT_MET: "Cart total does not meet the minimum amount required for this coupon.",
  COUPON_APPLIED_SUCCESSFULLY: "Coupon applied successfully.",
  COUPON_REMOVED: "Coupon removed from order.",
  NO_ACTIVE_COUPONS: "No active coupons available.",

  // Reviews
  REVIEW_SUBMITTED: "Review submitted successfully.",
  REVIEW_ALREADY_EXISTS: "You have already reviewed this product.",
  REVIEW_NOT_FOUND: "Review not found.",

  // Stock / Inventory
  INSUFFICIENT_STOCK: "Insufficient stock available.",
  STOCK_UPDATED_SUCCESSFULLY: "Stock updated successfully.",

  // Admin / General
  INVALID_INPUT: "Invalid input provided.",
  ACTION_NOT_ALLOWED: "You are not allowed to perform this action.",
  SERVER_ERROR: "Something went wrong. Please try again later.",
  NOT_FOUND: "The requested resource was not found.",
  SOMETHING_WENT_WRONG: "Oops! Something went wrong.",
  PAGE_NOT_FOUND: "Page not found.",
  DATA_SAVED_SUCCESSFULLY: "Data saved successfully.",
  DATA_UPDATED_SUCCESSFULLY: "Data updated successfully.",
  DATA_DELETED_SUCCESSFULLY: "Data deleted successfully.",
};

export default Messages;
