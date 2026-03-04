import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/userSchema.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://rahina.online/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          logger.warn("Google login failed: No email found in profile");
          return done(null, false);
        }

        let user = await User.findOne({
          $or: [{ googleId: profile.id }, { email }],
        });

        if (user) {
          logger.info(`Google login success: ${email}`);
          return done(null, user);
        }

        // Create new user
        user = new User({
          name: profile.displayName,
          email,
          googleId: profile.id,
        });

        await user.save();

        logger.info(`New Google user created: ${email}`);

        return done(null, user);
      } catch (error) {
        logger.error("Google authentication error:", error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    logger.error("Deserialize user error:", error);
    done(error, null);
  }
});

export default passport;