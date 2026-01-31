import User from "../../models/userSchema.js";
import bcrypt from "bcrypt";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from "../../utils/logger.js";

const pageerror = (req, res) => {
  res.status(500).render("500", {
    currentRoute: null
  });
};


const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/dashboard");
  }
  res.render("adminlogin", { message: null });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.AUTH.USER_NOT_FOUND
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.AUTH.INVALID_CREDENTIALS
      });
    }

    req.session.admin = true;
    return res.status(Status.OK).json({
       success: true ,message:message.AUTH.LOGIN_SUCCESS
      });

  } catch (error) {
    console.log("Login error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:message.GENERAL.SERVER_ERROR
    });
  }
};


const logout = async (req, res) => {
  try {
    req.session.destroy((error) => {
      if (error) {
        console.log("Error destroying session:", error);
        return res.redirect("/pageerror");
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log("Unexpected error during logout:", error);
   return res.status(Status.INTERNAL_SERVER_ERROR).json({
     success: false, message: message.GENERAL.SERVER_ERROR
     });
  }
};

export { loadLogin, login, pageerror, logout, };
