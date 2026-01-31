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

    req.user = user;

    return next();
  } catch (error) {
  console.error("User auth error:", error);
  return res.redirect("/pageerror");
}
 }

const adminAuth = (req, res, next) => {
  try {
    if (!req.session?.admin) {
      return res.redirect("/admin/login");
    }
    return next();
  } catch (error) {
  console.error("Admin auth error:", error);
  return res.redirect("/pageerror");
  }
};

export{adminAuth,userAuth}
