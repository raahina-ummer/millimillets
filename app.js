

import express from "express";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import "./config/passport.js";
import passport from "passport";
import connectDB from "./config/db.js";
import logger from './utils/logger.js';
import { router as adminRouter } from "./Routes/adminRouter.js";
import { router as userRouter } from "./Routes/userRouter.js";

import { fileURLToPath } from "url";




// Equivalent of __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

app.set("trust proxy", 1);

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log("---- Incoming Request ----");
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  console.log("--------------------------");
  next();
});


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000, // 72 hours
    },
  })
);



app.use(passport.initialize());
app.use(passport.session());

// Prevent cache storage
app.use((req, res, next) => {
  res.set("cache-control", "no-store");
  next();
});

// EJS setup
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/admin", adminRouter);
app.use("/", userRouter);



// Start server
app.listen(process.env.PORT, () => {
  logger.info(`Server started on port ${process.env.PORT}`);
});

export default app;
