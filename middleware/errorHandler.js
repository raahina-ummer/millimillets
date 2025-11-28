// Global Error Handling Middleware

const errorHandler = (err, req, res, next) => {
  console.error("🔥 Error:", err.stack || err);

  // Set default status if not already set
  const statusCode = err.statusCode || 500;

  // If request is AJAX or API call -> return JSON
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Something went wrong!",
    });
  }

  // For normal webpage request -> render error page
  res.status(statusCode).render("error", {
    status: statusCode,
    message: err.message || "Internal Server Error",
  });
};

export default errorHandler;
