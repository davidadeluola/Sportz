import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "node:http";
import matchRouter from "./routes/matches.js";
import { attachWebsocketHandlers } from "./ws/server.js";
import { arcjetSecurityMiddleware } from "./middleware/arcjet.middleware.js";

dotenv.config();

const app = express();

// TODO: Move these to config file
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(arcjetSecurityMiddleware());

app.get("/", (_req, res) => {
  // res.status(200).json({ message: "Server is running" });
  res.send("Server is running");
});
app.use("/api/v1/matches", matchRouter);

const server = createServer(app);

const { broadcastMatchUpdate } = attachWebsocketHandlers(server);
app.locals.broadcastMatchUpdate = broadcastMatchUpdate;

server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server running on ${baseUrl}`);
  console.log(`WebSocket server running on ws://${HOST}:${PORT}/ws`);
});
