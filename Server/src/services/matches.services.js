import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../util/match-status.js";
import { desc } from "drizzle-orm";

class MatchServices {
  async listMatches(limit = 50) {
    return db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);
  }

  async createMatch(payload) {
    const { startTime, endTime, homeScore, awayScore } = payload;

    const [event] = await db
      .insert(matches)
      .values({
        ...payload,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime),
      })
      .returning();

    return event;
  }
}

export default MatchServices;
