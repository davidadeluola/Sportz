import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches.js";
import MatchServices from "../services/matches.services.js";

const matchServices = new MatchServices();

class MatchController {
  listMatches = async (req, res) => {
    const parsedQuery = listMatchesQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        payload: {
          success: false,
          error: "Invalid query parameters",
          data: parsedQuery.error.issues,
        },
      });
    }

    const limit = Math.min(parsedQuery.data.limit || 50, 100);

    try {
      const matchListData = await matchServices.listMatches(limit);
      return res.status(200).json({
        payload: {
          success: true,
          error: null,
          data: matchListData,
        },
      });
    } catch (error) {
      return res.status(500).json({
        payload: {
          success: false,
          error: "Failed to list matches",
          data: error?.message || "Unknown error",
        },
      });
    }
  };

  createMatch = async (req, res) => {
    const parsedBody = createMatchSchema.safeParse(req.body);
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
      const event = await matchServices.createMatch(parsedBody.data);
      if (res.app.locals.broadcastMatchUpdate) {
        res.app.locals.broadcastMatchUpdate(event);
      }

      return res
        .status(201)
        .json({
          payload: {
            success: true,
            error: null,
            data: event,
          },
        });
    } catch (error) {
      return res.status(500).json({
        payload: {
          success: false,
          error: "Internal server error",
          data: error?.message || "Unknown error",
        },
      });
    }
  };
}

export default MatchController;
