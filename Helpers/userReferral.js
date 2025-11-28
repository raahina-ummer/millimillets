import crypto from "crypto";
import User from "../models/userSchema.js";

export const generateUniqueReferralCode = async (base = "") => {
  let code;
  let exists = true;

  while (exists) {
    // Example format: "USER-7C5LQ"
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 random chars
    code = `${base.toUpperCase().slice(0, 5)}-${suffix}`;

    // Check if this code already exists
    exists = await User.findOne({ referralCode: code });
  }

  return code;
};
