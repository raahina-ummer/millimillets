import User from "../../models/userSchema.js";
import Wallet from "../../models/WalletSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import Address from "../../models/AddressSchema.js";
import Cart from "../../models/CartSchema.js";
import Product from "../../models/ProductSchema.js";
import Order from "../../models/OrderSchema.js";
import { getPendingReturns } from "./orderController.js";
import { calculateTotals } from "../../utils/calculateTotals.js";
import logger from '../../utils/logger.js';

const loadWallet = async (req, res) => {
  try {
    const userId = req.session.user.id;
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const startIndex = (page - 1) * limit;
    const totalTransactions = wallet.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    const paginatedTransactions = wallet.transactions
      .sort((a, b) => b.date - a.date)
      .slice(startIndex, startIndex + limit)
      .map((tx) => ({
        type: tx.type,
        amount: tx.amount.toFixed(2),
        reason: tx.reason,
        orderId: tx.orderId || "",
        date: tx.date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        icon:
          tx.type === "credit"
            ? tx.reason === "Cashback Received"
              ? "gift"
              : "plus"
            : "shopping-bag",
      }));

    const walletData = {
      balance: wallet.balance.toFixed(2),
      lastUpdated: wallet.updatedOn.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      transactions: paginatedTransactions,
    };

    const user = await User.findById(userId);

    res.render("wallet", {
      walletData,
      user,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching wallet page:", error.message);
    res.status(Status.INTERNAL_SERVER_ERROR).json("error", { message: message.SOMETHING_WENT_WRONG });
  }
};

const walletPayment = async (req, res) => {
  try {
    const userId = req.session.user?.id;
     const { addressId } = req.body;
    if (!userId) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "User not authenticated",
      });
    }


        // Fetch address
    const userAddress = await Address.findOne({ userId });
    if (!userAddress) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Address not found",
      });
    }

    const selectedAddress = userAddress.addresses.find(
      addr => addr._id.toString() === addressId
    );

    if (!selectedAddress) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Invalid address",
      });
    }

    // Get cart
    const cart = await Cart.findOne({ userId }).populate("products.productId");
    if (!cart || cart.products.length === 0) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.CART_EMPTY,
      });
    }

    //Filter valid cart items 
    const validCartItems = cart.products.filter(item => {
      const product = item.productId;
      const variant = product?.variant?.[0];
      return (
        product &&
        !product.isBlocked &&
        variant &&
        variant.stock >= item.quantity
      );
    });

    if (!validCartItems.length) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "No valid items in cart",
      });
    }

    
    const {
      subtotal,          
      productDiscount,   
      shipping,
      finalAmount
    } = calculateTotals(validCartItems, cart.couponDiscount || 0);

    //Wallet check
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < finalAmount) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // Create order 
    const orderedProducts = validCartItems.map(item => {
      const product = item.productId;
      const variant = product.variant[0];

      return {
        product: product._id,
        productNameSnapshot: product.productName,
        productImageSnapshot: product.productImage?.[0] || null,
        variantName: variant.unitType || "Default",
        quantity: item.quantity,
        price: variant.salePrice,
        status: "Pending",
      };
    });

    /*  Create order */
    const newOrder = new Order({
      userId,
      orderedProducts,

      totalPrice: subtotal,                 
      discount: productDiscount,            
      couponDiscount: cart.couponDiscount || 0, 
      shippingCost: shipping,                
      finalAmount,                           

      walletUsed: finalAmount,
      amountPaid: finalAmount,
      amountToPay: 0,

      paymentMethod: "Wallet",
      paymentStatus: "Completed",
      status: "Processing",

       address: {
  addressType: selectedAddress.addressType,

  name: `${selectedAddress.firstName} ${selectedAddress.lastName}`,
  mobile: Number(selectedAddress.phone),

  addressLine1: selectedAddress.address,
  addressLine2: "",

  city: selectedAddress.city,
  state: selectedAddress.state,
  country: selectedAddress.country,
  pincode: selectedAddress.pinCode
},


    });

    await newOrder.save();

   
    wallet.balance -= finalAmount;
    wallet.transactions.push({
      type: "debit",
      amount: finalAmount,
      reason: "Order Payment",
      description: `Order Payment (${newOrder.orderId})`,
    });
    await wallet.save();

    
    for (const item of validCartItems) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { "variant.0.stock": -item.quantity },
      });
    }

    
    cart.products = [];
    cart.couponApplied = false;
    cart.couponCode = null;
    cart.couponDiscount = 0;
    await cart.save();

   
    return res.status(Status.OK).json({
      success: true,
      message: "Order placed successfully",
      orderId: newOrder.orderId,
       walletUsed: finalAmount,         
  newWalletBalance: wallet.balance
    });

  } catch (error) {
    console.log("Wallet Payment Error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.SERVER_ERROR
    });
  }
};


export { loadWallet, walletPayment }