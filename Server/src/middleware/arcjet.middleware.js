import { httpArk } from "../security/arcjet.js";


export function arcjetSecurityMiddleware() {
  return async (req, res, next) => {
    if (!httpArk) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Invalid Arcjet Key" });
    }

    try {
      const response = await httpArk.protect(req);
      if (response.isDenied()) {
        if (response.reason.isRateLimit()) {
          return res.status(429).json({ error: "Too Many Requests" });
        }

        return res.status(403).json({ error: "Forbidden: Access Denied" });
      }
    } catch (err) {
      return res
        .status(503)
        .json({ error: `Service Unavailable due to ${err.message}` });
    }

    next();
  };
}
