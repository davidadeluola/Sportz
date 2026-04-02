import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll control httpArk via this mock - start with null
const mockHttpArk = { protect: vi.fn() };

vi.mock("../../security/arcjet.js", () => ({
  get httpArk() {
    return mockHttpArkValue;
  },
  wsArk: null,
}));

// We need a mutable variable to switch between null and the mock
let mockHttpArkValue = mockHttpArk;

import { arcjetSecurityMiddleware } from "../../middleware/arcjet.middleware.js";

function mockReq() {
  return { url: "/test", method: "GET", headers: {}, ip: "127.0.0.1" };
}

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("arcjetSecurityMiddleware", () => {
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    mockHttpArkValue = mockHttpArk;
  });

  it("returns 401 when httpArk is null/falsy", async () => {
    mockHttpArkValue = null;

    const middleware = arcjetSecurityMiddleware();
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        message: "Unauthorized: Invalid Arcjet Key",
        data: null,
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when request is allowed", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockHttpArk.protect.mockResolvedValue(mockResponse);

    const middleware = arcjetSecurityMiddleware();
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 429 when request is rate-limited", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(true),
      reason: { isRateLimit: vi.fn().mockReturnValue(true) },
    };
    mockHttpArk.protect.mockResolvedValue(mockResponse);

    const middleware = arcjetSecurityMiddleware();
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        message: "Too many requests",
        data: null,
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when request is denied but not rate-limited", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(true),
      reason: { isRateLimit: vi.fn().mockReturnValue(false) },
    };
    mockHttpArk.protect.mockResolvedValue(mockResponse);

    const middleware = arcjetSecurityMiddleware();
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        message: "Forbidden: Access Denied",
        data: null,
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 503 when arcjet.protect throws an error", async () => {
    const err = new Error("Arcjet service unreachable");
    mockHttpArk.protect.mockRejectedValue(err);

    const middleware = arcjetSecurityMiddleware();
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        message: "Service unavailable",
        data: "Arcjet service unreachable",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 503 with 'Unknown error' when thrown error has no message", async () => {
    mockHttpArk.protect.mockRejectedValue({});

    const middleware = arcjetSecurityMiddleware();
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      payload: {
        message: "Service unavailable",
        data: "Unknown error",
      },
    });
  });

  it("calls httpArk.protect with the incoming request", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockHttpArk.protect.mockResolvedValue(mockResponse);

    const middleware = arcjetSecurityMiddleware();
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, next);

    expect(mockHttpArk.protect).toHaveBeenCalledWith(req);
  });

  it("returns a function (higher-order middleware factory)", () => {
    const middleware = arcjetSecurityMiddleware();
    expect(typeof middleware).toBe("function");
  });
});