import { Router } from "express";
const matchRouter = Router();
import MatchController from "../controllers/matches.controller.js";

const matchController = new MatchController();

matchRouter.get("/", matchController.listMatches);

matchRouter.post("/", matchController.createMatch);

export default matchRouter;
