import { wsArk } from "../security/arcjet.js";

/**
 * WebSocket Arcjet security middleware
 * Validates incoming WebSocket connections against Arcjet protection rules
 * @param {WebSocket} socket - The WebSocket connection
 * @returns {Promise<boolean>} - true if connection is allowed, false if denied
 */
export async function arcjetWsSecurityMiddleware(socket) {
  if (!wsArk) {
    console.warn(
      "WebSocket Arkjet protection is not configured. WS connections will not be protected."
    );
    return true;
  }

  try {
    // Create a minimal request-like object for Arcjet validation
    const req = {
      url: "/ws",
      method: "GET",
      headers: socket.protocol ? { protocol: socket.protocol } : {},
    };

    const wsResponse = await wsArk.protect(req);
    if (wsResponse.isDenied()) {
      const reason = wsResponse.reason.isRateLimit() ? 1013 : 1008; // 1013: Try Again Later, 1008: Policy Violation
      const code = wsResponse.reason.isRateLimit()
        ? "rate limit exceeded"
        : "access denied";

      const reasonMsg = wsResponse.reason.isRateLimit()
        ? "WebSocket connection rate limited"
        : "WebSocket connection denied: Access Denied";
      console.warn(reasonMsg);
      return false;
    }
  } catch (error) {
    console.error("WebSocket Arkjet protection error:", error);
    // Fail open: allow connection on error
  }

  return true;
}
