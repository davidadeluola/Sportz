import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { matchIdParamSchema } from "../validation/matches.js";
import CommentaryServices from "../services/commentary.services.js";

const commentaryServices = new CommentaryServices();
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 100;

class CommentaryController {
  listCommentary = async (req, res) => {
    const parsedParams = matchIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        payload: {
          success: false,
          error: "Invalid route parameters",
          data: parsedParams.error.issues,
        },
      });
    }

    const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        payload: {
          success: false,
          error: "Invalid query parameters",
          data: parsedQuery.error.issues,
        },
      });
    }

    try {
      const limit = Math.min(parsedQuery.data.limit || DEFAULT_LIMIT, MAX_LIMIT);
      const commentaryList = await commentaryServices.listCommentary(
        parsedParams.data.id,
        limit
      );

      return res.status(200).json({
        payload: {
          success: true,
          error: null,
          data: commentaryList,
        },
      });
    } catch (error) {
      return res.status(500).json({
        payload: {
          success: false,
          error: "Failed to list commentary",
          data: error?.message || "Unknown error",
        },
      });
    }
  };

  createCommentary = async (req, res) => {
    const parsedParams = matchIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        payload: {
          success: false,
          error: "Invalid route parameters",
          data: parsedParams.error.issues,
        },
      });
    }

    const parsedBody = createCommentarySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        payload: {
          success: false,
          error: "Invalid payload",
          data: parsedBody.error.issues,
        },
      });
    }

    try {
      const createdCommentary = await commentaryServices.createCommentary(
        parsedParams.data.id,
        parsedBody.data
      );

      if (res.app.locals.broadcastCommentary) {
        res.app.locals.broadcastCommentary(parsedParams.data.id, createdCommentary);
      }

      return res
        .status(201)
        .json({
          payload: {
            success: true,
            error: null,
            data: createdCommentary,
          },
        });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({
          payload: {
            success: false,
            error: error.message,
            data: null,
          },
        });
      }

      return res.status(500).json({
        payload: {
          success: false,
          error: "Failed to create commentary",
          data: error?.message || "Unknown error",
        },
      });
    }
  };
}

export default CommentaryController;
