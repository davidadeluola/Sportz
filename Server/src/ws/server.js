import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

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

  ws.on("connection", (socket) => {
    const clientId = randomUUID();
    socket.isAlive = true;

    console.log("New client connected to WebSocket: ", clientId);

    sendJSON(socket, {
      payload: {
        type: "WebSocket_server_created",
        id: clientId,
      },
    });

    broadcastJSON(ws, {
      payload: {
        type: "client_joined",
        id: clientId,
      },
    });

    socket.on("pong", () => {
      socket.isAlive = true;
      console.log(`Pong received from client ${clientId}`);
    });

    // socket.on("message", (message) => {
    //   console.log(`Received message from client ${clientId}:`, message.toString());
    //   // Handle incoming messages from clients if needed
    // });

    socket.on("error", console.error);

    socket.on("close", () => {
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
    broadcastJSON(ws, {
      payload: {
        type: "match_created_at",
        match: match,
      },
    });
  }
  return { broadcastMatchUpdate };
}
