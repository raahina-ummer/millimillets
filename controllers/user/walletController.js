import User from "../../models/userSchema.js";
import Wallet from "../../models/WalletSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import Address from "../../models/AddressSchema.js";
import Cart from "../../models/CartSchema.js";
import Product from "../../models/ProductSchema.js";
import Order from "../../models/OrderSchema.js";
import { getPendingReturns } from "./orderController.js";
import { calculateOrderTotals } from "../../Helpers/orderTotal.js";
import logger from "../../utils/logger.js";
import { isValidCartItem, resolveVariant } from "../../Helpers/cartHelper.js";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();


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
    logger.error("Error fetching wallet page:", error.message);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json("error", { message: message.GENERAL.SERVER_ERROR });
  }
};
const walletPayment = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { addressId } = req.body;

    if (!userId) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.AUTH.USER_NOT_LOGGED_IN,
      });
    }


    const userAddress = await Address.findOne({ userId });
    if (!userAddress) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.ADDRESS.NOT_FOUND,
      });
    }

    const selectedAddress = userAddress.addresses.find(
      addr => addr._id.toString() === addressId
    );
    if (!selectedAddress) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.ADDRESS.NOT_FOUND,
      });
    }


    const cart = await Cart.findOne({ userId }).populate({
      path: "products.productId",
      populate: "category",
    });

    if (!cart || cart.products.length === 0) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.CART.EMPTY,
      });
    }

    const validItems = cart.products.filter(isValidCartItem);
    if (validItems.length === 0) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.CART.ITEM_NOT_IN_CART,
      });
    }


    const {
      saleTotal,
      couponDiscount,
      shipping,
      finalAmount,
    } = calculateOrderTotals(
      validItems,
      cart.couponApplied ? cart.couponDiscount : 0
    );

    // WALLET CHECK 
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < finalAmount) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }


    let remainingCoupon = couponDiscount;

    const orderedProducts = validItems.map((item, index) => {
      const itemTotal = item.price * item.quantity;
      let couponShare = 0;

      if (couponDiscount > 0 && saleTotal > 0) {
        if (index === validItems.length - 1) {
          couponShare = remainingCoupon;
        } else {
          couponShare = Math.round(
            (itemTotal / saleTotal) * couponDiscount
          );
          remainingCoupon -= couponShare;
        }
      }

      return {
        product: item.productId._id,
        productNameSnapshot: item.productId.productName,
        productImageSnapshot: item.productId.productImage?.[0],
        variantId: item.variantId,
        variantName: resolveVariant(item.productId, item.variantId)?.unitType,
        price: item.price,
        quantity: item.quantity,
        couponShare,
        status: "Processing",
      };
    });

    const order = new Order({
      orderId: "ORD" + Date.now() + uuidv4().slice(0, 6),
      userId,

      orderedProducts,

      totalPrice: saleTotal,
      couponDiscount,
      shippingCost: shipping,
      finalAmount,

      walletUsed: finalAmount,
      amountPaid: finalAmount,
      amountToPay: 0,

      paymentMethod: "Wallet",
      paymentStatus: "Completed",
      status: "Processing",

      couponApplied: cart.couponApplied || false,
      couponCode: cart.couponCode || null,

      address: {
        addressType: selectedAddress.addressType,
        name: `${selectedAddress.firstName} ${selectedAddress.lastName}`,
        mobile: Number(selectedAddress.phone),
        addressLine1: selectedAddress.address,
        addressLine2: "",
        city: selectedAddress.city,
        state: selectedAddress.state,
        country: selectedAddress.country,
        pincode: selectedAddress.pinCode,
      },
    });


    order.invoiceSnapshot = {
      items: validItems.map(item => ({
        name: item.productId.productName,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
      })),
      subtotal: saleTotal,
      couponDiscount,
      shipping,
      finalAmount,
    };

    order.invoiceNumber = order.orderId;

    await order.save();


    wallet.balance -= finalAmount;
    wallet.transactions.push({
      type: "debit",
      amount: finalAmount,
      reason: "Order Payment",
      orderId: order.orderId,
      date: new Date(),
    });
    await wallet.save();


    for (const item of validItems) {
      await Product.updateOne(
        {
          _id: item.productId._id,
          "variant._id": item.variantId,
          "variant.stock": { $gte: item.quantity },
        },
        { $inc: { "variant.$.stock": -item.quantity } }
      );
    }


    await Cart.findOneAndUpdate(
      { userId },
      {
        products: [],
        couponApplied: false,
        couponCode: null,
        couponDiscount: 0,
      }
    );

    return res.status(Status.OK).json({
      success: true,
      message: message.ORDER.PLACED_SUCCESS,
      orderId: order.orderId,
      walletUsed: finalAmount,
      newWalletBalance: wallet.balance,
    });

  } catch (error) {
    logger.error("Wallet Payment Error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message.GENERAL.SERVER_ERROR,
    });
  }
};

export { loadWallet, walletPayment };
