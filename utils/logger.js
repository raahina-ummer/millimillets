import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf, colorize, errors } = format;

// Define custom log format
const customFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create the logger instance
const logger = createLogger({
  level: 'info', // default level (change to 'debug' for more verbose logs)
  format: combine(
    colorize(), // colorize logs in console
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // log stack trace for errors
    customFormat,
  ),
  transports: [
    new transports.Console(), // log to console
    new transports.File({ filename: 'logs/error.log', level: 'error' }), // log errors to file
    new transports.File({ filename: 'logs/combined.log' }), // all logs
  ],
  exitOnError: false,
});

export default logger;