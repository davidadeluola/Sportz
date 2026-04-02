import { describe, it, expect, vi, beforeEach } from "vitest";

const mockWsArk = { protect: vi.fn() };
let mockWsArkValue = mockWsArk;

vi.mock("../../security/arcjet.js", () => ({
  httpArk: null,
  get wsArk() {
    return mockWsArkValue;
  },
}));

import { arcjetWsSecurityMiddleware } from "../../middleware/arcjet-ws.middleware.js";

function createMockSocket(overrides = {}) {
  return {
    protocol: null,
    remoteAddress: null,
    _socket: null,
    ...overrides,
  };
}

describe("arcjetWsSecurityMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWsArkValue = mockWsArk;
  });

  it("returns true when wsArk is null/falsy (fail open)", async () => {
    mockWsArkValue = null;

    const socket = createMockSocket();
    const result = await arcjetWsSecurityMiddleware(socket);

    expect(result).toBe(true);
  });

  it("returns true when connection is allowed by Arcjet", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket();
    const result = await arcjetWsSecurityMiddleware(socket);

    expect(result).toBe(true);
  });

  it("returns false when connection is denied by Arcjet", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(true),
      reason: {
        isRateLimit: vi.fn().mockReturnValue(false),
      },
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket();
    const result = await arcjetWsSecurityMiddleware(socket);

    expect(result).toBe(false);
  });

  it("returns false when connection is rate limited", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(true),
      reason: {
        isRateLimit: vi.fn().mockReturnValue(true),
      },
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket();
    const result = await arcjetWsSecurityMiddleware(socket);

    expect(result).toBe(false);
  });

  it("returns true when arcjet.protect throws an error (fail open)", async () => {
    mockWsArk.protect.mockRejectedValue(new Error("Service down"));

    const socket = createMockSocket();
    const result = await arcjetWsSecurityMiddleware(socket);

    expect(result).toBe(true);
  });

  it("uses socket._socket.remoteAddress as IP when available", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket({
      _socket: { remoteAddress: "192.168.1.100" },
    });

    await arcjetWsSecurityMiddleware(socket);

    expect(mockWsArk.protect).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "192.168.1.100" })
    );
  });

  it("uses socket.remoteAddress as fallback IP when _socket is null", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket({
      remoteAddress: "10.0.0.1",
      _socket: null,
    });

    await arcjetWsSecurityMiddleware(socket);

    expect(mockWsArk.protect).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "10.0.0.1" })
    );
  });

  it("falls back to 127.0.0.1 when no IP available", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket();

    await arcjetWsSecurityMiddleware(socket);

    expect(mockWsArk.protect).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "127.0.0.1" })
    );
  });

  it("constructs request with /ws url and GET method", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket();
    await arcjetWsSecurityMiddleware(socket);

    expect(mockWsArk.protect).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/ws", method: "GET" })
    );
  });

  it("includes user-agent header in the request", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket();
    await arcjetWsSecurityMiddleware(socket);

    expect(mockWsArk.protect).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": "SportzWebSocketClient/1.0",
        }),
      })
    );
  });

  it("includes socket protocol in request headers when available", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket({ protocol: "chat" });
    await arcjetWsSecurityMiddleware(socket);

    expect(mockWsArk.protect).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ protocol: "chat" }),
      })
    );
  });

  it("prefers _socket.remoteAddress over socket.remoteAddress", async () => {
    const mockResponse = {
      isDenied: vi.fn().mockReturnValue(false),
    };
    mockWsArk.protect.mockResolvedValue(mockResponse);

    const socket = createMockSocket({
      remoteAddress: "10.0.0.1",
      _socket: { remoteAddress: "192.168.1.200" },
    });

    await arcjetWsSecurityMiddleware(socket);

    expect(mockWsArk.protect).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "192.168.1.200" })
    );
  });
});