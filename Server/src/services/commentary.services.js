import { db } from "../db/db.js";
import { commentary, matches } from "../db/schema.js";
import { desc, eq } from "drizzle-orm";

class CommentaryServices {
  async listCommentary(matchId, limit = 100) {
    return db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);
  }

  async createCommentary(matchId, payload) {
    const [existingMatch] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (!existingMatch) {
      const error = new Error(`Match with id ${matchId} was not found`);
      error.statusCode = 404;
      throw error;
    }

    const [createdCommentary] = await db
      .insert(commentary)
      .values({
        matchId,
        minute: payload.minute,
        sequence: payload.sequence,
        period: payload.period,
        eventType: payload.eventType,
        actor: payload.actor,
        team: payload.team,
        message: payload.message,
        metadata: payload.metadata,
        tags: payload.tags,
      })
      .returning();

      

    return createdCommentary;
  }
}

export default CommentaryServices;
