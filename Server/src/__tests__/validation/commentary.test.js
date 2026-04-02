import { describe, it, expect } from "vitest";
import {
  listCommentaryQuerySchema,
  createCommentarySchema,
  updateCommentarySchema,
  commentaryIdParamSchema,
  COMMENTARY_EVENT_TYPES,
  COMMENTARY_PERIODS,
} from "../../validation/commentary.js";

describe("listCommentaryQuerySchema", () => {
  it("accepts undefined limit (optional)", () => {
    const result = listCommentaryQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.limit).toBeUndefined();
  });

  it("accepts valid numeric string limit", () => {
    const result = listCommentaryQuerySchema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(50);
  });

  it("accepts limit at max boundary (100)", () => {
    const result = listCommentaryQuerySchema.safeParse({ limit: "100" });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(100);
  });

  it("rejects limit above max (101)", () => {
    const result = listCommentaryQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects limit of zero (must be positive)", () => {
    const result = listCommentaryQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects negative limit", () => {
    const result = listCommentaryQuerySchema.safeParse({ limit: "-1" });
    expect(result.success).toBe(false);
  });

  it("throws for non-numeric string limit (Zod v4 transform behavior)", () => {
    // In Zod v4, throwing inside .transform() propagates outside safeParse
    expect(() => listCommentaryQuerySchema.safeParse({ limit: "abc" })).toThrow(
      "limit must be a number"
    );
  });

  it("truncates float string to integer (parseInt semantics)", () => {
    // parseInt("1.5") === 1, which is a valid positive integer
    const result = listCommentaryQuerySchema.safeParse({ limit: "1.5" });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(1);
  });

  it("accepts limit of 1 (minimum positive)", () => {
    const result = listCommentaryQuerySchema.safeParse({ limit: "1" });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(1);
  });
});

const validCommentaryPayload = {
  minute: 45,
  sequence: 1,
  period: "H1",
  eventType: "goal",
  actor: "Ronaldo",
  team: "TeamA",
  message: "Ronaldo scores!",
};

describe("createCommentarySchema", () => {
  it("accepts a fully valid payload", () => {
    const result = createCommentarySchema.safeParse(validCommentaryPayload);
    expect(result.success).toBe(true);
    expect(result.data.minute).toBe(45);
    expect(result.data.metadata).toEqual({});
    expect(result.data.tags).toEqual([]);
  });

  it("defaults metadata to empty object when omitted", () => {
    const result = createCommentarySchema.safeParse(validCommentaryPayload);
    expect(result.success).toBe(true);
    expect(result.data.metadata).toEqual({});
  });

  it("defaults tags to empty array when omitted", () => {
    const result = createCommentarySchema.safeParse(validCommentaryPayload);
    expect(result.success).toBe(true);
    expect(result.data.tags).toEqual([]);
  });

  it("accepts custom metadata object", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      metadata: { assistedBy: "Messi", xG: 0.87 },
    });
    expect(result.success).toBe(true);
    expect(result.data.metadata).toEqual({ assistedBy: "Messi", xG: 0.87 });
  });

  it("accepts custom tags array", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      tags: ["critical", "controversial"],
    });
    expect(result.success).toBe(true);
    expect(result.data.tags).toEqual(["critical", "controversial"]);
  });

  it("coerces string minute to number", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      minute: "23",
    });
    expect(result.success).toBe(true);
    expect(result.data.minute).toBe(23);
  });

  it("coerces string sequence to number", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      sequence: "3",
    });
    expect(result.success).toBe(true);
    expect(result.data.sequence).toBe(3);
  });

  it("accepts minute of 0 (nonnegative)", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      minute: 0,
    });
    expect(result.success).toBe(true);
    expect(result.data.minute).toBe(0);
  });

  it("rejects negative minute", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      minute: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects sequence of 0 (must be positive)", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      sequence: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty period string", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      period: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty eventType string", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      eventType: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty actor string", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      actor: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty team string", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      team: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty message string", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from period", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      period: "  H1  ",
    });
    expect(result.success).toBe(true);
    expect(result.data.period).toBe("H1");
  });

  it("rejects missing required field (minute)", () => {
    const { minute, ...rest } = validCommentaryPayload;
    const result = createCommentarySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing required field (eventType)", () => {
    const { eventType, ...rest } = validCommentaryPayload;
    const result = createCommentarySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing required field (message)", () => {
    const { message, ...rest } = validCommentaryPayload;
    const result = createCommentarySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only period (trims to empty string)", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      period: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects float minute value (must be integer)", () => {
    const result = createCommentarySchema.safeParse({
      ...validCommentaryPayload,
      minute: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCommentarySchema", () => {
  it("accepts empty object (all fields are optional)", () => {
    const result = updateCommentarySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only minute", () => {
    const result = updateCommentarySchema.safeParse({ minute: 90 });
    expect(result.success).toBe(true);
    expect(result.data.minute).toBe(90);
  });

  it("rejects invalid field values even in partial update", () => {
    const result = updateCommentarySchema.safeParse({ minute: -5 });
    expect(result.success).toBe(false);
  });
});

describe("commentaryIdParamSchema", () => {
  it("accepts valid positive integer id", () => {
    const result = commentaryIdParamSchema.safeParse({ id: 1 });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
  });

  it("coerces string id to number", () => {
    const result = commentaryIdParamSchema.safeParse({ id: "42" });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(42);
  });

  it("rejects zero id", () => {
    const result = commentaryIdParamSchema.safeParse({ id: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative id", () => {
    const result = commentaryIdParamSchema.safeParse({ id: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric string id", () => {
    const result = commentaryIdParamSchema.safeParse({ id: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects float id", () => {
    const result = commentaryIdParamSchema.safeParse({ id: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe("COMMENTARY_EVENT_TYPES", () => {
  it("has expected event type keys", () => {
    expect(COMMENTARY_EVENT_TYPES.GOAL).toBe("goal");
    expect(COMMENTARY_EVENT_TYPES.YELLOW_CARD).toBe("yellow_card");
    expect(COMMENTARY_EVENT_TYPES.RED_CARD).toBe("red_card");
    expect(COMMENTARY_EVENT_TYPES.SUBSTITUTION).toBe("substitution");
    expect(COMMENTARY_EVENT_TYPES.INJURY).toBe("injury");
    expect(COMMENTARY_EVENT_TYPES.HALF_TIME).toBe("half_time");
    expect(COMMENTARY_EVENT_TYPES.FULL_TIME).toBe("full_time");
  });
});

describe("COMMENTARY_PERIODS", () => {
  it("has expected period codes", () => {
    expect(COMMENTARY_PERIODS.FIRST_HALF).toBe("H1");
    expect(COMMENTARY_PERIODS.SECOND_HALF).toBe("H2");
    expect(COMMENTARY_PERIODS.EXTRA_TIME_1).toBe("ET1");
    expect(COMMENTARY_PERIODS.EXTRA_TIME_2).toBe("ET2");
    expect(COMMENTARY_PERIODS.PENALTIES).toBe("PEN");
  });
});