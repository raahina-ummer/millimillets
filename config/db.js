import mongoose from "mongoose";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        logger.info("MongoDB Connected Successfully");
    } catch (error) {
        logger.error("MongoDB Connection Error:", error);
        process.exit(1);
    }
};

export default connectDB;