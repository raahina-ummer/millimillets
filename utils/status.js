const StatusCodes = {
  // success
  OK: 200, // Standard success
  CREATED: 201, // Resource created (e.g., user registered, order placed)
  ACCEPTED: 202, // Request accepted for processing (async jobs)
  NO_CONTENT: 204, // Successful, but no content to return (e.g., delete)

  // Client Errors (4xx)
  BAD_REQUEST: 400, // Invalid input (e.g., missing fields, bad data)
  UNAUTHORIZED: 401, // User not authenticated (e.g., not logged in)
  FORBIDDEN: 403, // Authenticated but not allowed (e.g., access to admin route)
  NOT_FOUND: 404, // Resource not found (e.g., user, product, order)
  METHOD_NOT_ALLOWED: 405, // HTTP method not supported
  CONFLICT: 409, // Duplicate resource (e.g., user already exists)
  UNPROCESSABLE_ENTITY: 422, // Validation failed (Mongoose/Joi)
  TOO_MANY_REQUESTS: 429, // Rate limiting

  // Server Errors (5xx)
  INTERNAL_SERVER_ERROR: 500, // General server error
  NOT_IMPLEMENTED: 501, // Endpoint not implemented
  BAD_GATEWAY: 502, // Invalid response from upstream server
  SERVICE_UNAVAILABLE: 503, // Server down or overloaded
  GATEWAY_TIMEOUT: 504, // Upstream service timed out
};

export default StatusCodes;
