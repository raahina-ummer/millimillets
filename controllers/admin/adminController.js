import User from "../../models/userSchema.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";


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

    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.USER_NOT_FOUND,
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.INVALID_CREDENTIALS,
      });
    }

    req.session.admin = true;
    return res.status(Status.OK).json({ success: true ,});

  } catch (error) {
    console.log("Login error:", error);
    return res.status(Status.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:message.SERVER_ERROR
    });
  }
};


const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.render("dashboard");
    } catch (error) {
      res.redirect("/admin/pageNotFound");
    }
  } else {
    return res.redirect("/admin/login");
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
    res.redirect("/pageError");
  }
};

export { loadLogin, login, loadDashboard, pageerror, logout };
