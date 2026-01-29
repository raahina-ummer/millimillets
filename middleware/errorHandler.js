const errorHandler = (err, req, res, next) => {
  console.error(" Error:", err.stack || err);

  const statusCode = err.statusCode || 500;

  const isApiRequest =
    req.headers["content-type"]?.includes("application/json") ||
    req.headers.accept?.includes("application/json");

  if (isApiRequest) {
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Something went wrong",
    });
  }

  return res.status(statusCode).render("error", {
    status: statusCode,
    message: err.message || "Internal Server Error",
  });
};

export default errorHandler;


