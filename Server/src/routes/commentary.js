import { Router } from "express";
import CommentaryController from "../controllers/commentary.controller.js";

const commentaryRouter = Router({ mergeParams: true });
const commentaryController = new CommentaryController();

commentaryRouter.get("/", commentaryController.listCommentary);
commentaryRouter.post("/", commentaryController.createCommentary);

export default commentaryRouter;
