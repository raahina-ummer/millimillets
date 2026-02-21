import crypto from "crypto";
import User from "../models/userSchema.js";

export const generateUniqueReferralCode = async (base = "") => {
  let code;
  let exists = true;

  while (exists) {
    // Example: USERA-7C5LQF
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    code = `${base.toUpperCase().slice(0, 5)}-${suffix}`;

    exists = await User.exists({ referralCode: code });
  }

  return code;
};
