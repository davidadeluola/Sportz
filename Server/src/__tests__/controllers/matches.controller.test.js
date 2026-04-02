import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the security module to prevent ARCJET_KEY requirement
vi.mock("../../security/arcjet.js", () => ({
  httpArk: null,
  wsArk: null,
}));

// Mock MatchServices
vi.mock("../../services/matches.services.js", () => {
  const MatchServices = vi.fn();
  MatchServices.prototype.listMatches = vi.fn();
  MatchServices.prototype.createMatch = vi.fn();
  return { default: MatchServices };
});

import MatchServices from "../../services/matches.services.js";
import MatchController from "../../controllers/matches.controller.js";

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
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

const validMatchBody = {
  sport: "football",
  homeTeam: "Team A",
  awayTeam: "Team B",
  startTime: "2026-05-01T15:00:00Z",
  endTime: "2026-05-01T17:00:00Z",
};

describe("MatchController.listMatches", () => {
  let controller;
  let listMatchesMock;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MatchController();
    listMatchesMock = MatchServices.prototype.listMatches;
  });

  it("returns 200 with payload envelope on success", async () => {
    const mockMatches = [{ id: 1, sport: "football" }];
    listMatchesMock.mockResolvedValue(mockMatches);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await controller.listMatches(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: true,
        error: null,
        data: mockMatches,
      },
    });
  });

  it("returns 400 with payload envelope when query is invalid", async () => {
    const req = mockReq({ query: { limit: "abc" } });
    const res = mockRes();

    await controller.listMatches(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: false,
        error: "Invalid query parameters",
        data: expect.any(Array),
      },
    });
  });

  it("returns 400 when limit exceeds 100", async () => {
    const req = mockReq({ query: { limit: "200" } });
    const res = mockRes();

    await controller.listMatches(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 500 with payload envelope on service error", async () => {
    listMatchesMock.mockRejectedValue(new Error("Connection refused"));

    const req = mockReq({ query: {} });
    const res = mockRes();

    await controller.listMatches(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: false,
        error: "Failed to list matches",
        data: "Connection refused",
      },
    });
  });

  it("returns 500 with 'Unknown error' when error has no message", async () => {
    listMatchesMock.mockRejectedValue({});

    const req = mockReq({ query: {} });
    const res = mockRes();

    await controller.listMatches(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          data: "Unknown error",
        }),
      })
    );
  });

  it("returns empty array when no matches exist", async () => {
    listMatchesMock.mockResolvedValue([]);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await controller.listMatches(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: true,
        error: null,
        data: [],
      },
    });
  });

  it("passes limit to the service layer", async () => {
    listMatchesMock.mockResolvedValue([]);

    const req = mockReq({ query: { limit: "10" } });
    const res = mockRes();

    await controller.listMatches(req, res);

    expect(listMatchesMock).toHaveBeenCalledWith(10);
  });
});

describe("MatchController.createMatch", () => {
  let controller;
  let createMatchMock;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MatchController();
    createMatchMock = MatchServices.prototype.createMatch;
  });

  it("returns 201 with payload envelope on success", async () => {
    const mockEvent = { id: 1, ...validMatchBody };
    createMatchMock.mockResolvedValue(mockEvent);

    const req = mockReq({ body: validMatchBody });
    const res = mockRes();

    await controller.createMatch(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: true,
        error: null,
        data: mockEvent,
      },
    });
  });

  it("returns 400 with payload envelope when body is invalid", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await controller.createMatch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: false,
        error: "Invalid payload",
        data: expect.any(Array),
      },
    });
  });

  it("returns 400 when endTime is before startTime", async () => {
    const req = mockReq({
      body: {
        ...validMatchBody,
        startTime: "2026-05-01T17:00:00Z",
        endTime: "2026-05-01T15:00:00Z",
      },
    });
    const res = mockRes();

    await controller.createMatch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 500 with payload envelope on service error", async () => {
    createMatchMock.mockRejectedValue(new Error("Insert failed"));

    const req = mockReq({ body: validMatchBody });
    const res = mockRes();

    await controller.createMatch(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        success: false,
        error: "Internal server error",
        data: "Insert failed",
      },
    });
  });

  it("returns 500 with 'Unknown error' when service error has no message", async () => {
    createMatchMock.mockRejectedValue({});

    const req = mockReq({ body: validMatchBody });
    const res = mockRes();

    await controller.createMatch(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          data: "Unknown error",
        }),
      })
    );
  });

  it("calls broadcastMatchUpdate when it is set in app locals", async () => {
    const mockEvent = { id: 1, ...validMatchBody };
    createMatchMock.mockResolvedValue(mockEvent);

    const broadcast = vi.fn();
    const req = mockReq({ body: validMatchBody });
    const res = mockRes();
    res.app.locals.broadcastMatchUpdate = broadcast;

    await controller.createMatch(req, res);

    expect(broadcast).toHaveBeenCalledWith(mockEvent);
  });

  it("does not throw when broadcastMatchUpdate is not set in locals", async () => {
    const mockEvent = { id: 1, ...validMatchBody };
    createMatchMock.mockResolvedValue(mockEvent);

    const req = mockReq({ body: validMatchBody });
    const res = mockRes();
    // No broadcastMatchUpdate in locals

    await expect(controller.createMatch(req, res)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns 400 when required field sport is missing", async () => {
    const { sport, ...rest } = validMatchBody;
    const req = mockReq({ body: rest });
    const res = mockRes();

    await controller.createMatch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when startTime is not a valid ISO date string", async () => {
    const req = mockReq({
      body: { ...validMatchBody, startTime: "not-a-date" },
    });
    const res = mockRes();

    await controller.createMatch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});