const message = {

  /* ================= AUTH & USER ================= */
  AUTH: {
    USER_NOT_LOGGED_IN: "Please login to continue.",
    USER_ALREADY_EXISTS: "User already exists with this email or phone.",
    USER_NOT_FOUND: "User not found.",
    INVALID_CREDENTIALS: "Invalid email or password.",
    ACCOUNT_BLOCKED: "Your account has been blocked. Please contact support.",

    EMAIL_REQUIRED: "Email is required.",
    EMAIL_INVALID: "Please enter a valid email address.",
    PASSWORD_REQUIRED: "Password is required.",
    PASSWORD_MIN_LENGTH: "Password must be at least 8 characters long.",

    UNAUTHORIZED_ACCESS: "Unauthorized access. Please login again.",
    SESSION_EXPIRED: "Session expired. Please signup again.",
  },

  /* ================= OTP ================= */
  OTP: {
    SENT: "OTP has been sent to your registered email address.",
    INVALID: "Invalid OTP. Please try again.",
    EXPIRED: "OTP has expired. Please request a new one.",
    PASSWORD_RESET_SUCCESS: "Password has been reset successfully.",
    PASSWORD_MISMATCH: "Passwords do not match.",
  },

  /* ================= USER PROFILE ================= */
  PROFILE: {
    UPDATED_SUCCESS: "Profile updated successfully.",
    NAME_REQUIRED: "Name is required.",
    NAME_INVALID: "Name contains invalid characters.",
    PHONE_REQUIRED: "Phone number is required.",
    PHONE_INVALID: "Phone number must be 10 digits.",
    IMAGE_TYPE_INVALID: "Only JPG and PNG images are allowed.",
    IMAGE_SIZE_EXCEEDED: "Image size must be less than 2MB.",
  },

  /* ================= CATEGORY ================= */
CATEGORY: {
  ALREADY_EXISTS: "The category already exists.",
  CREATED_SUCCESS: "Category created successfully.",
  UPDATED_SUCCESS: "Category updated successfully.",
  NOT_FOUND: "Category not found.",

  OFFER_UPDATED_SUCCESS: "Category offer updated successfully.",
  OFFER_DELETED_SUCCESS: "Category offer deleted successfully.",

  DISCOUNT_PERCENTAGE_INVALID: "Discount must be between 0 and 100.",
  MAX_DISCOUNT_NEGATIVE: "Max discount amount cannot be negative.",
  OFFER_DATE_INVALID: "Start date cannot be after end date.",

  LISTED_SUCCESS: "Category listed successfully.",
  UNLISTED_SUCCESS: "Category unlisted successfully.",
},


  /* ================= PRODUCT ================= */
    PRODUCT: {
    NOT_FOUND: "Product not found.",
    ALREADY_EXISTS: "Product already exists.",
    CREATED_SUCCESS: "Product added successfully.",
    UPDATED_SUCCESS: "Product updated successfully.",
    DELETED_SUCCESS: "Product deleted successfully.",

    INVALID_CATEGORY: "Invalid category name.",
    MISSING_REQUIRED_FIELDS: "Missing required fields.",
    INVALID_GST: "GST must be between 0 and 100.",

    IMAGE_REQUIRED: "At least three product images are required.",
    IMAGE_MAX_LIMIT: "Maximum 4 images allowed.",
    IMAGE_TYPE_INVALID: "Only image files (PNG, JPEG, JPG, WEBP) are allowed.",
    IMAGE_DELETE_LAST_NOT_ALLOWED:
      "Cannot delete the last image. A product must have at least one image.",
    IMAGE_NOT_FOUND: "Image not found in product.",

    VARIANT_REQUIRED: "At least one variant is required.",
    VARIANT_INVALID_WEIGHT: "Variant weight must be greater than zero.",
    VARIANT_INVALID_PRICE: "Variant price must be greater than zero.",
    VARIANT_INVALID_STOCK: "Variant stock must be non-negative.",
    VARIANT_SALE_PRICE_INVALID:
      "Sale price cannot exceed regular price.",

    OFFER_UPDATED_SUCCESS: "Product offer updated successfully.",
    OFFER_FETCH_SUCCESS: "Product offer fetched successfully.",
    OFFER_DATE_INVALID: "Start date cannot be after end date.",
    OFFER_DISCOUNT_INVALID: "Discount must be between 0 and 100.",
  },
//================CART===============
CART: {
  // General
  EMPTY: "Your cart is empty.",
  NOT_FOUND: "Cart not found.",
  UPDATED_SUCCESS: "Cart updated successfully.",
  CLEARED_SUCCESS: "Cart cleared successfully.",

  // Add to cart
  ITEM_ADDED: "Item added to cart successfully.",
  ITEM_ALREADY_EXISTS: "Item is already in your cart.",
  PRODUCT_NOT_FOUND: "Product not found.",
  PRODUCT_UNAVAILABLE: "The product is currently unavailable.",
  VARIANT_REQUIRED: "Variant not selected.",
  OUT_OF_STOCK: "The product is currently out of stock.",

  // Quantity / limits
  INVALID_QUANTITY: "Invalid quantity.",
  MAX_LIMIT_REACHED: "Maximum quantity limit reached.",
  STOCK_LIMIT: qty => `Only ${qty} items left.`,

  // Remove
  ITEM_REMOVED: "Item removed from cart.",
  ITEM_NOT_IN_CART: "Product not found in the cart.",

  // Auth
  LOGIN_REQUIRED: "Please login to continue."
},
  /* ================= WISHLIST ================= */
 WISHLIST: {
  ITEM_ADDED: "Item added to wishlist.",
  ITEM_REMOVED: "Item removed from wishlist.",
  ITEM_ALREADY_EXISTS: "Item already exists in wishlist.",
  PRODUCT_NOT_FOUND: "Product not found.",
  WISHLIST_NOT_FOUND: "Wishlist not found.",
  CLEARED: "Your wishlist is empty.",
  CLEAR_FAILED: "Failed to clear wishlist. Please try again.",
},

/* ================= ORDER ================= */
ORDER: {
  /* -------- General -------- */
  NOT_FOUND: "Order not found.",
  INVALID_ID: "Invalid order ID.",
  NO_ORDERS_FOUND: "No orders found.",

  /* -------- Placement & Payment -------- */
  PLACED_SUCCESS: "Order placed successfully.",
  PAYMENT_VERIFIED: "Payment verified successfully.",
  PAYMENT_FAILED: "Payment verification failed.",
  COD_LIMIT_EXCEEDED: "Cash on Delivery is available only for orders up to ₹1000.",

  /* -------- Cancellation -------- */
  CANCELLED_SUCCESS: "Order cancelled successfully.",
  ITEM_CANCELLED_SUCCESS: "Item cancelled successfully.",
  ALREADY_CANCELLED: "This order item is already cancelled.",
  CANNOT_BE_CANCELLED: "Order cannot be cancelled at this stage.",
  CANCELLED_BY_ADMIN: "Cancelled by admin.",
  CANCELLED_BY_USER: "Cancelled by user.",

  /* -------- Return (User) -------- */
  RETURN_REASON_REQUIRED: "Return reason is required.",
  RETURN_ONLY_DELIVERED: "Return is only allowed for delivered orders.",
  RETURN_REQUEST_SUBMITTED: "Return request submitted successfully.",
  RETURN_ALREADY_REQUESTED: "Return request already submitted for this product.",

  /* -------- Return (Admin) -------- */
  RETURN_ACTION_INVALID: "Action must be 'approve' or 'reject'.",
  RETURN_REQUEST_NOT_FOUND: "No return request found for this item.",
  RETURN_ALREADY_PROCESSED: "Return request has already been processed.",
  RETURN_APPROVED: "Return approved successfully.",
  RETURN_REJECTED: "Return request rejected.",
  RETURN_PROCESS_FAILED: "Failed to process return request.",

  /* -------- Status -------- */
  STATUS_INVALID: "Invalid order status value.",
  STATUS_UPDATED: status => `Order status updated to ${status}.`,
  STATUS_TRANSITION_INVALID: "Invalid order status transition.",

  /* -------- Invoice -------- */
  INVOICE_ONLY_DELIVERED: "Invoice is only available for delivered orders.",
},


  /* ================= ADDRESS ================= */
  ADDRESS: {
    ADDED: "Address added successfully.",
    UPDATED: "Address updated successfully.",
    DELETED: "Address deleted successfully.",
    NOT_FOUND: "Address not found.",
      DELETE_FAILED: "Failed to delete address. Please try again.",
      DELETED_SUCCESS:"Deleted Successfully"

  },

  /* ================= PAYMENT ================= */
  PAYMENT: {
    FAILED: "Payment failed. Please try again.",
    SUCCESS: "Payment successful.",
    PENDING: "Payment is still pending.",
    INVALID_METHOD: "Invalid payment method selected.",
    REFUND_INITIATED: "Refund has been initiated.",
    REFUND_COMPLETED: "Refund completed successfully.",
    WALLET_INSUFFICIENT: "Insufficient wallet balance.",
    INVALID_DATA: "Invalid payment data.",

  },

  /* ================= COUPON ================= */

/* ================= COUPON ================= */
COUPON: {
  // Validation
  CODE_REQUIRED: "Coupon code is required.",
  INVALID: "Invalid coupon code.",
  EXPIRED: "This coupon has expired.",
  ALREADY_USED: "You have already used this coupon.",
  NO_ACTIVE: "No active coupons available.",

  // Eligibility
  CART_EMPTY: "Your cart is empty.",
  NO_VALID_ITEMS: "No valid items in your cart.",
  MIN_AMOUNT_NOT_MET: amount =>
    `Minimum order ₹${amount} required to apply this coupon.`,

  // Success
  APPLIED_SUCCESS: "Coupon applied successfully.",
  REMOVED: "Coupon removed from order."
},

  CUSTOMER: {
  FETCH_FAILED: "Failed to load customers.",
  BLOCKED_SUCCESS: "Customer blocked successfully.",
  UNBLOCKED_SUCCESS: "Customer activated successfully.",
  NOT_FOUND: "Customer not found.",
  INVALID_ID: "Invalid customer ID.",
},


  /* ================= REVIEW ================= */
  REVIEW: {
    SUBMITTED: "Review submitted successfully.",
    ALREADY_EXISTS: "You have already reviewed this product.",
    NOT_FOUND: "Review not found.",
  },
  STOCK: {
  FETCH_FAILED: "Failed to load stock management data.",
  MISSING_FIELDS: "Missing required fields.",
  INVALID_QUANTITY: "Invalid quantity. Must be a positive number.",
  PRODUCT_NOT_FOUND: "Product not found.",
  VARIANT_NOT_FOUND: "Variant not found in this product.",
  UPDATED_SUCCESS: "Stock updated successfully.",
},


  /* ================= GENERAL ================= */
  GENERAL: {
    INVALID_INPUT: "Invalid input provided.",
    ACTION_NOT_ALLOWED: "You are not allowed to perform this action.",
    SERVER_ERROR: "Something went wrong. Please try again later.",
    NOT_FOUND: "The requested resource was not found.",
    PAGE_NOT_FOUND: "Page not found.",
    SOMETHING_WENT_WRONG: "Oops! Something went wrong.",
    DATA_SAVED: "Data saved successfully.",
    DATA_UPDATED: "Data updated successfully.",
    DATA_DELETED: "Data deleted successfully.",
  }

};


export default message;
