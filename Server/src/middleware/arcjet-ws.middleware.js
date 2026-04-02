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
    const socketIp =
      socket?._socket?.remoteAddress || socket?.remoteAddress || "127.0.0.1";

    // Create a minimal request-like object for Arcjet validation
    const req = {
      url: "/ws",
      method: "GET",
      ip: socketIp,
      headers: {
        "user-agent": "SportzWebSocketClient/1.0",
        ...(socket.protocol ? { protocol: socket.protocol } : {}),
      },
    };

    const wsResponse = await wsArk.protect(req);
    if (wsResponse.isDenied()) {
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
