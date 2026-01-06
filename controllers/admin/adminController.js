import User from "../../models/userSchema.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import Order from "../../models/OrderSchema.js";
import logger from '../../utils/logger.js';


const pageerror = async (req, res) => {
  res.render("pagerror");
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("adminlogin", { message: null });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email: email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        console.log("Admin session set:", req.session.admin);
        return res.redirect("/admin/dashboard");
      } else {
        return res.render("adminlogin", { message: message.INVALID_CREDENTIALS });
      }
    } else {
      return res.render("adminlogin", { message: message.USER_NOT_FOUND });
    }
  } catch (error) {
    console.log("Login error:", error);
    return res.redirect("/pageerror");
  }
};


const logout = async (req, res) => {
  try {
    req.session.destroy((error) => {
      if (error) {
        console.log("Error destroying session:", error);
        return res.redirect("/pageError");
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log("Unexpected error during logout:", error);
    res.Status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR})
  }
};

export {
  loadLogin,
  login,
  pageerror,
  logout
};
