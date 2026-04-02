import AgentAPI from "apminsight";
AgentAPI.config();

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "node:http";
import matchRouter from "./routes/matches.js";
import commentaryRouter from "./routes/commentary.js";
import { attachWebsocketHandlers } from "./ws/server.js";
import { arcjetSecurityMiddleware } from "./middleware/arcjet.middleware.js";

dotenv.config();

const app = express();

// TODO: Move these to config file
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = (process.env.NODE_ENV || "development").toLowerCase();
const configuredBaseUrl = (process.env.BASE_URL || process.env.BASE_URL_PROD || "")
  .trim()
  .replace(/\/+$/, "");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡️ Security interface: protect all incoming HTTP requests with Arcjet.
app.use(arcjetSecurityMiddleware());

// 🌐 Health interface: quick server status endpoint.
app.get("/", (_req, res) => {
  return res.status(200).send("Welcome to Sportz real-time server");
});

// 🧩 API interface: feature routes.
app.use("/api/v1/matches", matchRouter);
app.use("/api/v1/matches/:id/commentary", commentaryRouter);

// ⚙️ Transport interface: shared HTTP server for REST + WebSocket.
const server = createServer(app);

// 📡 Realtime interface: attach WebSocket handlers and expose broadcaster.
const { broadcastMatchUpdate, broadcastCommentary } =
  attachWebsocketHandlers(server);
app.locals.broadcastMatchUpdate = broadcastMatchUpdate;
app.locals.broadcastCommentary = broadcastCommentary;

const localBaseUrl =
  HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
const baseUrl =
  NODE_ENV === "development" ? localBaseUrl : configuredBaseUrl || localBaseUrl;
const wsBaseUrl = baseUrl.startsWith("https://")
  ? baseUrl.replace("https://", "wss://")
  : baseUrl.replace("http://", "ws://");

if (!process.env.VERCEL) {
  server.listen(PORT, HOST, () => {
    console.log(`Server running on ${baseUrl}`);
    console.log(`WebSocket server running on ${wsBaseUrl}/ws`);
  });
}

export default app;
