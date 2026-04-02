import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the security module to prevent ARCJET_KEY requirement
vi.mock("../../security/arcjet.js", () => ({
  httpArk: null,
  wsArk: null,
}));

// Mock CommentaryServices so we control service behavior
vi.mock("../../services/commentary.services.js", () => {
  const CommentaryServices = vi.fn();
  CommentaryServices.prototype.listCommentary = vi.fn();
  CommentaryServices.prototype.createCommentary = vi.fn();
  return { default: CommentaryServices };
});

import CommentaryServices from "../../services/commentary.services.js";
import CommentaryController from "../../controllers/commentary.controller.js";

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    app: { locals: {} },
  };
  return res;
}

function mockReq(overrides = {}) {
  return {
    params: { id: "1" },
    query: {},
    body: {},
    ...overrides,
  };
}

const validBody = {
  minute: 45,
  sequence: 1,
  period: "H1",
  eventType: "goal",
  actor: "Ronaldo",
  team: "TeamA",
  message: "Ronaldo scores!",
};

describe("CommentaryController.listCommentary", () => {
  let controller;
  let listCommentaryMock;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new CommentaryController();
    listCommentaryMock = CommentaryServices.prototype.listCommentary;
  });

  it("returns 400 when route param id is missing/invalid", async () => {
    const req = mockReq({ params: { id: "abc" } });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          success: false,
          error: "Invalid route parameters",
        }),
      })
    );
  });

  it("returns 400 when route param id is zero", async () => {
    const req = mockReq({ params: { id: "0" } });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when query limit is zero (fails positive integer constraint)", async () => {
    const req = mockReq({ query: { limit: "0" } });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          success: false,
          error: "Invalid query parameters",
        }),
      })
    );
  });

  it("returns 400 when query limit exceeds max (101)", async () => {
    const req = mockReq({ query: { limit: "101" } });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with commentary list on success", async () => {
    const mockCommentaryList = [{ id: 1, message: "Goal!" }];
    listCommentaryMock.mockResolvedValue(mockCommentaryList);

    const req = mockReq({ params: { id: "10" }, query: {} });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: true,
        error: null,
        data: mockCommentaryList,
      },
    });
  });

  it("passes the correct matchId to the service", async () => {
    listCommentaryMock.mockResolvedValue([]);

    const req = mockReq({ params: { id: "42" }, query: {} });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(listCommentaryMock).toHaveBeenCalledWith(42, expect.any(Number));
  });

  it("uses custom limit when provided", async () => {
    listCommentaryMock.mockResolvedValue([]);

    const req = mockReq({ params: { id: "1" }, query: { limit: "25" } });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(listCommentaryMock).toHaveBeenCalledWith(1, 25);
  });

  it("caps limit at MAX_LIMIT (100)", async () => {
    listCommentaryMock.mockResolvedValue([]);

    const req = mockReq({ params: { id: "1" }, query: { limit: "100" } });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(listCommentaryMock).toHaveBeenCalledWith(1, 100);
  });

  it("returns 500 on service error", async () => {
    listCommentaryMock.mockRejectedValue(new Error("Database down"));

    const req = mockReq({ params: { id: "1" }, query: {} });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          success: false,
          error: "Failed to list commentary",
          data: "Database down",
        }),
      })
    );
  });

  it("returns 500 with 'Unknown error' when error has no message", async () => {
    listCommentaryMock.mockRejectedValue({});

    const req = mockReq({ params: { id: "1" }, query: {} });
    const res = mockRes();

    await controller.listCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          data: "Unknown error",
        }),
      })
    );
  });
});

describe("CommentaryController.createCommentary", () => {
  let controller;
  let createCommentaryMock;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new CommentaryController();
    createCommentaryMock = CommentaryServices.prototype.createCommentary;
  });

  it("returns 400 when route param id is invalid", async () => {
    const req = mockReq({ params: { id: "bad" }, body: validBody });
    const res = mockRes();

    await controller.createCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          success: false,
          error: "Invalid route parameters",
        }),
      })
    );
  });

  it("returns 400 when body is invalid (missing required fields)", async () => {
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();

    await controller.createCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          success: false,
          error: "Invalid payload",
        }),
      })
    );
  });

  it("returns 400 when minute is negative", async () => {
    const req = mockReq({
      params: { id: "1" },
      body: { ...validBody, minute: -1 },
    });
    const res = mockRes();

    await controller.createCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 201 with created commentary on success", async () => {
    const mockCreated = { id: 1, matchId: 10, ...validBody };
    createCommentaryMock.mockResolvedValue(mockCreated);

    const req = mockReq({ params: { id: "10" }, body: validBody });
    const res = mockRes();

    await controller.createCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: true,
        error: null,
        data: mockCreated,
      },
    });
  });

  it("calls broadcastCommentary with matchId and created commentary", async () => {
    const mockCreated = { id: 1, matchId: 10, ...validBody };
    createCommentaryMock.mockResolvedValue(mockCreated);

    const broadcast = vi.fn();
    const req = mockReq({ params: { id: "10" }, body: validBody });
    const res = mockRes();
    res.app.locals.broadcastCommentary = broadcast;

    await controller.createCommentary(req, res);

    expect(broadcast).toHaveBeenCalledWith(10, mockCreated);
  });

  it("does not throw when broadcastCommentary is not set in locals", async () => {
    const mockCreated = { id: 1, matchId: 10, ...validBody };
    createCommentaryMock.mockResolvedValue(mockCreated);

    const req = mockReq({ params: { id: "10" }, body: validBody });
    const res = mockRes();
    // No broadcastCommentary in locals

    await expect(controller.createCommentary(req, res)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns error statusCode from service (e.g., 404 for match not found)", async () => {
    const notFoundError = new Error("Match with id 999 was not found");
    notFoundError.statusCode = 404;
    createCommentaryMock.mockRejectedValue(notFoundError);

    const req = mockReq({ params: { id: "999" }, body: validBody });
    const res = mockRes();

    await controller.createCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: false,
        error: "Match with id 999 was not found",
        data: null,
      },
    });
  });

  it("returns 500 on generic service error (no statusCode)", async () => {
    createCommentaryMock.mockRejectedValue(new Error("DB connection error"));

    const req = mockReq({ params: { id: "1" }, body: validBody });
    const res = mockRes();

    await controller.createCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          success: false,
          error: "Failed to create commentary",
          data: "DB connection error",
        }),
      })
    );
  });

  it("returns 500 with 'Unknown error' when error has no message", async () => {
    createCommentaryMock.mockRejectedValue({});

    const req = mockReq({ params: { id: "1" }, body: validBody });
    const res = mockRes();

    await controller.createCommentary(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          data: "Unknown error",
        }),
      })
    );
  });

  it("passes parsed matchId and body data to the service", async () => {
    const mockCreated = { id: 1, matchId: 5, ...validBody };
    createCommentaryMock.mockResolvedValue(mockCreated);

    const req = mockReq({ params: { id: "5" }, body: validBody });
    const res = mockRes();

    await controller.createCommentary(req, res);

    expect(createCommentaryMock).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ minute: 45, eventType: "goal" })
    );
  });
});