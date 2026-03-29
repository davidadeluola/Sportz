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
        errors: "Invalid query parameters",
        details: JSON.stringify(parsedQuery.error),
      });
    }

    const limit = Math.min(parsedQuery.data.limit || 50, 100);

    try {
      const matchListData = await matchServices.listMatches(limit);
      return res.status(200).json({
        message: "Matches List Retrieved Successfully",
        data: matchListData,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to list matches",
        details: JSON.stringify(error),
      });
    }
  };

  createMatch = async (req, res) => {
    const parsedBody = createMatchSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        errors: "Invalid payload",
        details: JSON.stringify(parsedBody.error),
      });
    }

    try {
      const event = await matchServices.createMatch(parsedBody.data);
          return res
        .status(201)
        .json({ message: "Match created successfully", matchData: event });
    } catch (error) {
      return res.status(500).json({
        error: "Internal Server Error",
        details: JSON.stringify(error),
      });
    }
  };
}

export default MatchController;
