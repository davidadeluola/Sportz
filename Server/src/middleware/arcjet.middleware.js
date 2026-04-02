import { httpArk } from "../security/arcjet.js";


export function arcjetSecurityMiddleware() {
  return async (req, res, next) => {
    if (!httpArk) {
      return res
        .status(401)
        .json({
          payload: {
            message: "Unauthorized: Invalid Arcjet Key",
            data: null,
          },
        });
    }

    try {
      const response = await httpArk.protect(req);
      if (response.isDenied()) {
        if (response.reason.isRateLimit()) {
          return res.status(429).json({
            payload: {
              message: "Too many requests",
              data: null,
            },
          });
        }

        return res.status(403).json({
          payload: {
            message: "Forbidden: Access Denied",
            data: null,
          },
        });
      }
    } catch (err) {
      return res
        .status(503)
        .json({
          payload: {
            message: "Service unavailable",
            data: err?.message || "Unknown error",
          },
        });
    }

    next();
  };
}
