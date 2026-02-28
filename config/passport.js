
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20"
import User from "../models/userSchema.js";
import dotenv from "dotenv";
dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exist
        let user = await User.findOne({ $or: [{ googleId: profile.id }, { email: profile.emails[0].value }] });

        if (user) {
          return done(null, user);
        } else {
          // Create new user
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          });

          await user.save();
          return done(null, user);

        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => done(null, user))
    .catch((error) => done(error, null));
});

export default passport;
