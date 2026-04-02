import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing the service
vi.mock("../../db/db.js", () => ({
  db: {},
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  desc: vi.fn((col) => ({ __desc: col })),
  eq: vi.fn((col, val) => ({ __eq: { col, val } })),
}));

// Mock the schema
vi.mock("../../db/schema.js", () => ({
  commentary: { matchId: "matchId", createdAt: "createdAt" },
  matches: { id: "id" },
}));

import { db } from "../../db/db.js";
import CommentaryServices from "../../services/commentary.services.js";

function buildQueryChain(returnValue) {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockResolvedValue(returnValue);
  chain.insert.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue(returnValue);

  return chain;
}

describe("CommentaryServices.listCommentary", () => {
  let service;

  beforeEach(() => {
    service = new CommentaryServices();
    vi.clearAllMocks();
  });

  it("returns commentary list from the database", async () => {
    const mockCommentary = [
      { id: 1, matchId: 10, message: "Goal!", minute: 45 },
      { id: 2, matchId: 10, message: "Yellow card", minute: 30 },
    ];

    const chain = buildQueryChain(mockCommentary);
    db.select = chain.select;

    const result = await service.listCommentary(10, 100);

    expect(result).toEqual(mockCommentary);
    expect(chain.select).toHaveBeenCalled();
    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it("uses default limit of 100 when not provided", async () => {
    const chain = buildQueryChain([]);
    db.select = chain.select;

    await service.listCommentary(10);

    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it("passes the matchId filter to the query", async () => {
    const chain = buildQueryChain([]);
    db.select = chain.select;

    await service.listCommentary(42, 10);

    expect(chain.where).toHaveBeenCalled();
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it("returns empty array when no commentary found", async () => {
    const chain = buildQueryChain([]);
    db.select = chain.select;

    const result = await service.listCommentary(999, 100);
    expect(result).toEqual([]);
  });
});

describe("CommentaryServices.createCommentary", () => {
  let service;

  beforeEach(() => {
    service = new CommentaryServices();
    vi.clearAllMocks();
  });

  const validPayload = {
    minute: 45,
    sequence: 1,
    period: "H1",
    eventType: "goal",
    actor: "Ronaldo",
    team: "TeamA",
    message: "Ronaldo scores!",
    metadata: {},
    tags: [],
  };

  it("creates and returns commentary when match exists", async () => {
    const mockMatch = { id: 10 };
    const mockCreated = { id: 1, matchId: 10, ...validPayload };

    const matchChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMatch]),
    };
    db.select = vi.fn().mockReturnValue(matchChain);

    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockCreated]),
    };
    db.insert = vi.fn().mockReturnValue(insertChain);

    const result = await service.createCommentary(10, validPayload);

    expect(result).toEqual(mockCreated);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("throws 404 error when match does not exist", async () => {
    const matchChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // Empty means no match
    };
    db.select = vi.fn().mockReturnValue(matchChain);

    await expect(service.createCommentary(999, validPayload)).rejects.toThrow(
      "Match with id 999 was not found"
    );
  });

  it("attaches statusCode 404 to the error when match not found", async () => {
    const matchChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    db.select = vi.fn().mockReturnValue(matchChain);

    let thrownError;
    try {
      await service.createCommentary(999, validPayload);
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.statusCode).toBe(404);
  });

  it("inserts all payload fields when creating commentary", async () => {
    const mockMatch = { id: 10 };
    const mockCreated = { id: 1, matchId: 10, ...validPayload };

    const matchChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMatch]),
    };
    db.select = vi.fn().mockReturnValue(matchChain);

    const mockValues = vi.fn().mockReturnThis();
    const mockReturning = vi.fn().mockResolvedValue([mockCreated]);
    const insertChain = {
      values: mockValues,
      returning: mockReturning,
    };
    db.insert = vi.fn().mockReturnValue(insertChain);

    await service.createCommentary(10, validPayload);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: 10,
        minute: validPayload.minute,
        sequence: validPayload.sequence,
        period: validPayload.period,
        eventType: validPayload.eventType,
        actor: validPayload.actor,
        team: validPayload.team,
        message: validPayload.message,
        metadata: validPayload.metadata,
        tags: validPayload.tags,
      })
    );
  });

  it("propagates database errors for insert failures", async () => {
    const mockMatch = { id: 10 };

    const matchChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMatch]),
    };
    db.select = vi.fn().mockReturnValue(matchChain);

    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(new Error("DB connection lost")),
    };
    db.insert = vi.fn().mockReturnValue(insertChain);

    await expect(service.createCommentary(10, validPayload)).rejects.toThrow(
      "DB connection lost"
    );
  });
});