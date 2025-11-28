
import User from "../../models/userSchema.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";


// Fetch customer info with search + pagination
 const customerInfo = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

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

    const count = await User.countDocuments(query);

    res.render("customers", {
      data: userData,
      currentPage: page,
      totalUsers: count,
      totalPages: Math.ceil(count / limit),
      search,
    });
  } catch (error) {
    console.error("Error loading customers:", error);
   res.status(Status.INTERNAL_SERVER_ERROR).send(message.SERVER_ERROR);
  }
};

// Block a customer
 const customerBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });

    if (req.session.user && req.session.user._id === id) {
      delete req.session.user;
    }

    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).send(message.SERVER_ERROR);
  }
};

// Unblock a customer
 const customerunBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });

    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error unblocking user:", error);
   res.status(Status.INTERNAL_SERVER_ERROR).send(message.SERVER_ERROR);
  }
};

// Export all functions at the end
export {
  customerInfo,
  customerBlocked,
  customerunBlocked
};

