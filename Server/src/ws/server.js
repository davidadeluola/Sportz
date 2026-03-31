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

    // socket.on("message", (message) => {
    //   console.log(`Received message from client ${clientId}:`, message.toString());
    //   // Handle incoming messages from clients if needed
    // });

    socket.on("error", console.error);

    // socket.on("close", () => {
    //   console.log(`Client disconnected: ${clientId}`);
    // });
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
