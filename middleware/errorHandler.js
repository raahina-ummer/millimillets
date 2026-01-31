const errorHandler = (err, req, res, next) => {
  console.error(" Error:", err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;

  const isApiRequest =
    req.xhr ||
    req.accepts("json") ||
    req.originalUrl.startsWith("/api");

  if (isApiRequest) {
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Something went wrong",
    });
  }

  return res.status(statusCode).render("error", {
    status: statusCode,
    message: err.message || "Internal Server Error",
    currentRoute: null,
  });
};

export default errorHandler;
