import User from "../models/userSchema.js";

 const userAuth = async (req, res, next) => {
  try {
    const userId = req.session?.user?._id || req.session?.user?.id;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findOne({ _id: userId, isBlocked: false });
    if (!user) {
      return res.redirect("/login");
    }

    next();
  } catch (error) {
    console.log(error);
  }
};

const adminAuth = (req, res, next) => {
  try {
    if (!req.session?.admin) {
      return res.redirect("/admin/login");
    }
    next();
  } catch (error) {
    console.log(error);
  }
};

export{adminAuth,userAuth}
