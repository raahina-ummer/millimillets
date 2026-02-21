import User from "../models/userSchema.js";

 const userAuth = async (req, res, next) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) return fail(req, res);

    const user = await User.findOne({ _id: userId, isBlocked: false });
    if (!user) return fail(req, res);

    req.user = user;
    next();

  } catch (err) {
    console.error("userAuth error:", err);
    return fail(req, res);
  }
};

function fail(req, res) {
  const isFetch =
    req.headers["content-type"] === "application/json";

 
  if (isFetch) {
    return res.status(401).json({
      success: false,
      message: "Login required"
    });
  }


  return res.redirect("/login");
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
