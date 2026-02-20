import User from "../../models/userSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from "../../utils/logger.js";
import mongoose from "mongoose";

const customerInfo = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const query = {
      isAdmin: false,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };

    const userData = await User.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

      
    const filteredCustomers = await User.countDocuments(query);
    const totalPages = Math.ceil(filteredCustomers / limit);


    if (req.headers.accept?.includes("application/json")) {
      return res.status(Status.OK).json({
        success: true,
        userData,
        totalPages,
      });
    }



    const totalCustomers = await User.countDocuments({ isAdmin: false });
    
    const activeCustomers = await User.countDocuments({
      isAdmin: false,
      isBlocked: false,
    });
    const blockedCustomers = await User.countDocuments({
      isAdmin: false,
      isBlocked: true,
    });

    res.render("customers", {
      title: "Customers",
      currentRoute: "users",
      data: userData,
      currentPage: page,
      totalCustomers,
      filteredCustomers,
      totalPages: Math.ceil(filteredCustomers/limit),
      totalCustomers,
      activeCustomers,
      blockedCustomers,
      search,
    });
  } catch (error) {
    logger.error("Error loading customers", error);
      if (req.headers.accept?.includes("application/json")) {
      return res.status(500).json({
        success: false,
        message: "Failed to load customers",
      });
    }
    return res.redirect("/pageerror");
  }
};

const customerBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
  return res.status(Status.BAD_REQUEST).json({
    success: false,
    message: message.AUTH.INVALID_CREDENTIALS
  });
}

    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });

    if (req.session.user && req.session.user._id === id) {
      delete req.session.user;
    }

    res
      .status(Status.OK)
      .json({ success: true, message: message.CUSTOMER.BLOCKED_SUCCESS });
  } catch (error) {
    logger.error("Error blocking user", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const customerunBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
  return res.status(Status.BAD_REQUEST).json({
    success: false,
    message: message.AUTH.INVALID_CREDENTIALS
  });
}

    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });

    res
      .status(Status.OK)
      .json({ success: true, message: message.CUSTOMER.UNBLOCKED_SUCCESS });
  } catch (error) {
    logger.error("Error unblocking user", error);

    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export { customerInfo, customerBlocked, customerunBlocked };
