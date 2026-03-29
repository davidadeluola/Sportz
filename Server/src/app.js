import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import matchRouter from "./routes/matches.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  // res.status(200).json({ message: "Server is running" });
  res.send("Server is running");
});

app.use("/api/v1/matches", matchRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
