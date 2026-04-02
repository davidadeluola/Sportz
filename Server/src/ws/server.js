import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { arcjetWsSecurityMiddleware } from "../middleware/arcjet-ws.middleware.js";

const matchSub = new Map(); // matchId -> Set of clientIds subscribed to updates for that match

function subscribeMatchId(matchId, socket) {
  if (!matchSub.has(matchId)) {
    matchSub.set(matchId, new Set());
  }

  matchSub.get(matchId).add(socket);
}

function unSubscribeMatchId(matchId, socket) {
  const subs = matchSub.get(matchId);
  if (!subs) {
    return;
  }

  subs.delete(socket);

  if (subs.size === 0) {
    matchSub.delete(matchId);
  }
}

function cleanUpSocket(socket) {
  if (!socket.subscribedMatchIds) {
    return;
  }

  for (const matchId of socket.subscribedMatchIds) {
    unSubscribeMatchId(matchId, socket);
  }

  socket.subscribedMatchIds.clear();
  socket.subscribedMatchIds = null;
}

function broadcastToMatch(matchId, payload) {
  const subs = matchSub.get(matchId);
  if (!subs || subs.size === 0) {
    return;
  }
  const message = JSON.stringify(payload);

  for (const socket of subs) {
    if (socket.readyState !== WebSocket.OPEN) {
      continue;
    }
    socket.send(message);
  }
}

function messageHandler(socket, data) {
  try {
    const message = JSON.parse(data.toString());
    const messageType = message?.type ?? message?.payload;
    const matchId = Number(message?.matchId);

    if (!Number.isInteger(matchId)) {
      sendJSON(socket, {
        payload: {
          success: false,
          error: "matchId must be an integer",
          data: null,
        },
      });
      return;
    }

    socket.subscribedMatchIds = socket.subscribedMatchIds || new Set();

    if (messageType === "subscribe" || messageType === "subscribe_match") {
      subscribeMatchId(matchId, socket);
      socket.subscribedMatchIds.add(matchId);

      sendJSON(socket, {
        payload: {
          success: true,
          error: null,
          data: {
            type: "subscribed_to_match",
            matchId,
          },
        },
      });
      return;
    }

    if (messageType === "unsubscribe" || messageType === "unsubscribe_match") {
      unSubscribeMatchId(matchId, socket);
      socket.subscribedMatchIds.delete(matchId);

      sendJSON(socket, {
        payload: {
          success: true,
          error: null,
          data: {
            type: "unsubscribed_from_match",
            matchId,
          },
        },
      });
      return;
    }

    sendJSON(socket, {
      payload: {
        success: false,
        error: "Unsupported message type",
        data: null,
      },
    });
  } catch (e) {
    sendJSON(socket, {
      payload: {
        success: false,
        error: e?.message || "Invalid message format",
        data: null,
      },
    });
  }
}

// Match
function sendJSON(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcastJSON(ws, payload) {
  for (const client of ws.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }
    client.send(JSON.stringify(payload));
  }
}

export function attachWebsocketHandlers(server) {
  const ws = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  ws.on("connection", async (socket) => {
    // Apply WebSocket Arcjet security middleware
    const isAllowed = await arcjetWsSecurityMiddleware(socket);
    if (!isAllowed) {
      console.warn("WebSocket connection denied by Arcjet security middleware");
      socket.close(1008, "Forbidden: Access Denied");
      return;
    }

    const clientId = randomUUID();
    socket.isAlive = true;
    socket.subscribedMatchIds = new Set();
    console.log("New client connected to WebSocket: ", clientId);

    sendJSON(socket, {
      payload: {
        success: true,
        error: null,
        data: {
          type: "WebSocket_server_created",
          id: clientId,
        },
      },
    });

    broadcastJSON(ws, {
      payload: {
        success: true,
        error: null,
        data: {
          type: "client_joined",
          id: clientId,
        },
      },
    });

    socket.on("pong", () => {
      socket.isAlive = true;
      console.log(`Pong received from client ${clientId}`);
    });

    socket.on("message", (message) => {
      messageHandler(socket, message);
    });

    socket.on("error", console.error);

    socket.on("close", () => {
      cleanUpSocket(socket);
      console.log(`Client disconnected: ${clientId}`);
    });
  });

  // Heartbeat ping interval: send ping every 30 seconds to all connected clients
  const heartbeatInterval = setInterval(() => {
    ws.clients.forEach((socket) => {
      if (socket.isAlive === false) {
        // Client did not respond to ping, terminate connection
        console.log("Terminating dead connection due to no pong response");
        return socket.terminate();
      }

      // Mark as not alive and send ping
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000); // 30 seconds

  ws.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  function broadcastMatchUpdate(match) {
    if (!match?.id) {
      return;
    }

    broadcastToMatch(match.id, {
      payload: {
        success: true,
        error: null,
        data: {
          type: "match_created_at",
          match: match,
        },
      },
    });
  }

  function broadcastCommentary(matchId, comment) {
    if (!matchId || !comment) {
      return;
    }

    broadcastToMatch(matchId, {
      payload: {
        success: true,
        error: null,
        data: {
          type: "commentary_update",
          commentary: comment,
        },
      },
    });
  }

  return { broadcastMatchUpdate, broadcastCommentary };
}
