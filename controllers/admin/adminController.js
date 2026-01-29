import User from "../../models/userSchema.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import Order from "../../models/OrderSchema.js";
import logger from "../../utils/logger.js";

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

    if (!email || !email.trim()) {
      return res.render("adminlogin", {
        message: message.EMAIL_REQUIRED,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return res.render("adminlogin", {
        message: message.EMAIL_INVALID,
      });
    }

    if (!password) {
      return res.render("adminlogin", {
        message: message.PASSWORD_REQUIRED,
      });
    }

    const admin = await User.findOne({
      email: email.trim(),
      isAdmin: true,
    });

    if (!admin) {
      return res.render("adminlogin", {
        message: message.INVALID_CREDENTIALS,
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.render("adminlogin", {
        message: message.INVALID_CREDENTIALS,
      });
    }

    req.session.admin = true;
    req.session.adminId = admin._id;

    return res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Admin login error:", error);
    return res.render("adminlogin", {
      message: message.GENERAL.SERVER_ERROR,
    });
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
    res
      .Status(Status.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export { loadLogin, login, pageerror, logout };
