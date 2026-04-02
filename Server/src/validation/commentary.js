import { z } from "zod";

/**
 * Query schema for listing commentary
 * Validates optional limit parameter for pagination
 */
export const listCommentaryQuerySchema = z.object({
  limit: z
    .string()
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num)) throw new Error("limit must be a number");
      return num;
    })
    .pipe(z.number().int().positive().max(100))
    .optional(),
});

/**
 * Schema for creating commentary
 * Captures match events with detailed metadata
 */
export const createCommentarySchema = z.object({
  minute: z
    .coerce
    .number()
    .int()
    .nonnegative()
    .describe("Match minute when event occurred"),

  sequence: z
    .coerce
    .number()
    .int()
    .positive()
    .describe("Sequence number for ordering multiple events in same minute"),

  period: z
    .string()
    .trim()
    .min(1, "Period cannot be empty")
    .describe("Match period (e.g., 'H1', 'H2', 'ET', 'Penalties')"),

  eventType: z
    .string()
    .trim()
    .min(1, "Event type is required")
    .describe(
      "Type of event (e.g., 'goal', 'yellow_card', 'injury', 'substitution')"
    ),

  actor: z
    .string()
    .trim()
    .min(1, "Actor name is required")
    .describe("Player or person involved in the event"),

  team: z
    .string()
    .trim()
    .min(1, "Team is required")
    .describe("Team code or name"),

  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .describe("Commentary message describing the event"),

  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .default({})
    .describe("Additional event data (assists, player numbers, etc.)"),

  tags: z
    .array(z.string().trim())
    .optional()
    .default([])
    .describe(
      "Tags for categorizing commentary (e.g., 'critical', 'controversial')"
    ),
});

/**
 * Schema for updating commentary
 * Allows partial updates (all fields optional except id)
 */
export const updateCommentarySchema = createCommentarySchema.partial();

/**
 * Schema for commentary ID parameter
 */
export const commentaryIdParamSchema = z.object({
  id: z.coerce.number().int().positive().describe("Numeric ID of commentary"),
});

/**
 * Commentary event types constant
 */
export const COMMENTARY_EVENT_TYPES = {
  GOAL: "goal",
  YELLOW_CARD: "yellow_card",
  RED_CARD: "red_card",
  SUBSTITUTION: "substitution",
  INJURY: "injury",
  CORNER: "corner",
  FREE_KICK: "free_kick",
  PENALTY: "penalty",
  VAR_REVIEW: "var_review",
  MATCH_START: "match_start",
  HALF_TIME: "half_time",
  FULL_TIME: "full_time",
  EXTRA_TIME: "extra_time",
  PENALTIES: "penalties",
};

// /**
//  * Match periods constant
//  */
export const COMMENTARY_PERIODS = {
  FIRST_HALF: "H1",
  SECOND_HALF: "H2",
  EXTRA_TIME_1: "ET1",
  EXTRA_TIME_2: "ET2",
  PENALTIES: "PEN",
};
