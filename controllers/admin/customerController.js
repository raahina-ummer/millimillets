import User from "../../models/userSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from "../../utils/logger.js";

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
      .exec();

    const totalCustomers = await User.countDocuments({ isAdmin: false });
    const activeCustomers = await User.countDocuments({
      isAdmin: false,
      isBlocked: false,
    });
    const blockedCustomers = await User.countDocuments({
      isAdmin: false,
      isBlocked: true,
    });

    const count = await User.countDocuments(query);

    res.render("customers", {
      data: userData,
      currentPage: page,
      totalCustomers: count,
      totalPages: Math.ceil(count / limit),
      totalCustomers,
      activeCustomers,
      blockedCustomers,
      search,
    });
  } catch (error) {
    console.error("Error loading customers:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const customerBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });

    if (req.session.user && req.session.user._id === id) {
      delete req.session.user;
    }

    res
      .status(Status.OK)
      .json({ success: true, message: message.CUSTOMER.BLOCKED_SUCCESS });
  } catch (error) {
    console.error("Error blocking user:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

const customerunBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });

    res
      .status(Status.OK)
      .json({ success: true, message: message.CUSTOMER.UNBLOCKED_SUCCESS });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res
      .status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export { customerInfo, customerBlocked, customerunBlocked };
