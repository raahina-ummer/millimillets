const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;

  const isAjax =
    req.xhr ||
    req.headers["content-type"] === "application/json" ||
    req.headers.accept?.includes("application/json");

  if (isAjax) {
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
