import ReferralOffer from "../models/referralSchema.js";
import { generateReferralCode, generateReferralToken, generateCouponCode } from "../utils/offerCalculator.js";

export const getReferralOffers = async () => {
  return await ReferralOffer.find()
    .populate("referrer", "name email")
    .populate("referredUsers.userId", "name email");
};

export const createReferralOffer = async (referrerId, offerData) => {
  const referralCode = generateReferralCode(referrerId);
  const referralToken = generateReferralToken();

  const referralOffer = new ReferralOffer({
    referrer: referrerId,
    referralCode,
    referralToken,
    referralSettings: {
      discountPercentage: parseFloat(offerData.discountPercentage),
      referrerRewardPercentage: parseFloat(offerData.referrerRewardPercentage),
      maxRewardsPerReferrer: offerData.maxRewardsPerReferrer || null,
    },
    isActive: true,
  });

  await referralOffer.save();
  return referralOffer;
};

export const generateReferralCoupon = async (referralOfferId, expiryDays = 30) => {
  const referralOffer = await ReferralOffer.findById(referralOfferId);
  if (!referralOffer) throw new Error("Referral offer not found");

  const couponCode = generateCouponCode();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);

  const coupon = {
    couponCode,
    discount: referralOffer.referralSettings.referrerRewardPercentage,
    maxUses: 1,
    currentUses: 0,
    expiryDate,
    isActive: true,
    generatedFor: referralOffer.referrer,
  };

  referralOffer.couponGenerated.push(coupon);
  await referralOffer.save();

  return coupon;
};

export const toggleReferralOfferStatus = async (offerId, isActive) => {
  const referralOffer = await ReferralOffer.findByIdAndUpdate(
    offerId,
    {
      $set: {
        isActive: isActive
      }
    },
    { new: true }
  );

  if (!referralOffer) throw new Error("Referral offer not found");
  return referralOffer;
};

export const removeReferralOffer = async (offerId) => {
  const result = await ReferralOffer.findByIdAndDelete(offerId);
  if (!result) throw new Error("Referral offer not found");
  return result;
};

export const validateReferralCode = async (referralCode) => {
  const referralOffer = await ReferralOffer.findOne({
    referralCode,
    isActive: true,
  }).populate("referrer", "name email");

  if (!referralOffer) throw new Error("Invalid or expired referral code");
  return referralOffer;
};

export const validateReferralToken = async (token) => {
  const referralOffer = await ReferralOffer.findOne({
    referralToken: token,
    isActive: true,
  }).populate("referrer", "name email");

  if (!referralOffer) throw new Error("Invalid or expired referral token");
  return referralOffer;
};