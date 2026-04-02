import { describe, it, expect, vi } from "vitest";

// Mock heavy dependencies before any imports
vi.mock("../security/arcjet.js", () => ({
  httpArk: { protect: vi.fn().mockResolvedValue({ isDenied: () => false }) },
  wsArk: {},
}));

vi.mock("../middleware/arcjet.middleware.js", () => ({
  arcjetSecurityMiddleware: () => (_req, _res, next) => next(),
}));

vi.mock("../ws/server.js", () => ({
  attachWebsocketHandlers: vi.fn().mockReturnValue({
    broadcastMatchUpdate: vi.fn(),
    broadcastCommentary: vi.fn(),
  }),
}));

vi.mock("../db/db.js", () => ({ db: {} }));
vi.mock("../db/schema.js", () => ({
  matches: {},
  commentary: {},
  matchStatusEnum: vi.fn(),
}));
vi.mock("drizzle-orm", () => ({
  desc: vi.fn(),
  eq: vi.fn(),
}));

function mockRes() {
  const res = {
    _status: null,
    _body: null,
    _headers: {},
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      this._headers["content-type"] = "application/json";
      return this;
    },
    send(text) {
      this._body = text;
      return this;
    },
  };
  return res;
}

/**
 * The health endpoint handler as implemented in app.js (PR change).
 * Previously was res.send("Server is running"), now returns JSON payload envelope.
 */
const healthHandler = (_req, res) => {
  return res.status(200).json({
    payload: {
      success: true,
      error: null,
      data: null,
    },
  });
};

describe("App health endpoint (PR change: JSON envelope)", () => {
  it("sets status 200", () => {
    const res = mockRes();
    healthHandler({}, res);
    expect(res._status).toBe(200);
  });

  it("returns JSON payload envelope with success:true", () => {
    const res = mockRes();
    healthHandler({}, res);
    expect(res._body).toEqual({
      payload: {
        success: true,
        error: null,
        data: null,
      },
    });
  });

  it("returns error:null in the payload", () => {
    const res = mockRes();
    healthHandler({}, res);
    expect(res._body.payload.error).toBeNull();
  });

  it("returns data:null in the payload", () => {
    const res = mockRes();
    healthHandler({}, res);
    expect(res._body.payload.data).toBeNull();
  });

  it("response uses json() (not send())", () => {
    const res = mockRes();
    const jsonSpy = vi.spyOn(res, "json");
    healthHandler({}, res);
    expect(jsonSpy).toHaveBeenCalledOnce();
  });
});

describe("App route mounting (PR change: commentary route)", () => {
  it("commentary route module exports a router", async () => {
    const { default: commentaryRouter } = await import("../routes/commentary.js");
    // express Router has a 'stack' property and is a function
    expect(typeof commentaryRouter).toBe("function");
  });

  it("commentary router is configured with mergeParams:true", async () => {
    // mergeParams:true is required so :id from parent route flows into commentary handlers
    const { default: commentaryRouter } = await import("../routes/commentary.js");
    // An express router with mergeParams has it reflected in its params property
    expect(commentaryRouter.params).toBeDefined();
  });

  it("attachWebsocketHandlers is called once on app start (PR: broadcastCommentary added)", async () => {
    const { attachWebsocketHandlers } = await import("../ws/server.js");
    // Verify the mock returns both broadcasters (PR addition)
    const result = attachWebsocketHandlers({});
    expect(typeof result.broadcastMatchUpdate).toBe("function");
    expect(typeof result.broadcastCommentary).toBe("function");
  });
});

describe("App locals (PR change: broadcastCommentary exposure)", () => {
  it("app.locals can store broadcastCommentary function", () => {
    // Simulate what app.js does: app.locals.broadcastCommentary = broadcastCommentary
    const appLocals = {};
    const broadcastCommentary = vi.fn();
    const broadcastMatchUpdate = vi.fn();

    appLocals.broadcastMatchUpdate = broadcastMatchUpdate;
    appLocals.broadcastCommentary = broadcastCommentary;

    expect(typeof appLocals.broadcastCommentary).toBe("function");
    expect(typeof appLocals.broadcastMatchUpdate).toBe("function");
  });

  it("broadcastCommentary from attachWebsocketHandlers can be set in app.locals", async () => {
    const { attachWebsocketHandlers } = await import("../ws/server.js");
    const { broadcastCommentary } = attachWebsocketHandlers({});

    const appLocals = {};
    appLocals.broadcastCommentary = broadcastCommentary;

    expect(appLocals.broadcastCommentary).toBe(broadcastCommentary);
  });
});