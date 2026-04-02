import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to declare variables that will be accessible inside vi.mock factories
const { mockClients, capturedHandlers } = vi.hoisted(() => {
  const mockClients = new Set();
  const capturedHandlers = { connection: [], close: [] };
  return { mockClients, capturedHandlers };
});

// Mock arcjet security to avoid ARCJET_KEY requirement
vi.mock("../../security/arcjet.js", () => ({
  httpArk: {},
  wsArk: {},
}));

// Mock arcjet-ws middleware to allow all connections by default
vi.mock("../../middleware/arcjet-ws.middleware.js", () => ({
  arcjetWsSecurityMiddleware: vi.fn().mockResolvedValue(true),
}));

// Mock crypto for deterministic UUID
vi.mock("node:crypto", () => ({
  randomUUID: vi.fn().mockReturnValue("test-uuid-1234"),
}));

// Mock the ws module using hoisted variables
vi.mock("ws", () => {
  const WS_OPEN = 1;

  class MockWebSocketServer {
    constructor() {
      this.clients = mockClients;
      capturedHandlers.connection = [];
      capturedHandlers.close = [];
    }

    on(event, handler) {
      if (event === "connection") capturedHandlers.connection.push(handler);
      if (event === "close") capturedHandlers.close.push(handler);
    }
  }

  return {
    WebSocket: { OPEN: WS_OPEN },
    WebSocketServer: MockWebSocketServer,
  };
});

import { attachWebsocketHandlers } from "../../ws/server.js";
import { arcjetWsSecurityMiddleware } from "../../middleware/arcjet-ws.middleware.js";

function createMockSocket(overrides = {}) {
  const listeners = {};
  const socket = {
    readyState: 1, // OPEN
    isAlive: false,
    subscribedMatchIds: null,
    send: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    close: vi.fn(),
    on: vi.fn((event, handler) => {
      listeners[event] = handler;
    }),
    _listeners: listeners,
    ...overrides,
  };
  return socket;
}

function triggerMessage(socket, data) {
  const handler = socket._listeners["message"];
  if (handler) handler(Buffer.from(JSON.stringify(data)));
}

function triggerClose(socket) {
  const handler = socket._listeners["close"];
  if (handler) handler();
}

function triggerPong(socket) {
  const handler = socket._listeners["pong"];
  if (handler) handler();
}

describe("attachWebsocketHandlers", () => {
  let broadcastMatchUpdate;
  let broadcastCommentary;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClients.clear();
    capturedHandlers.connection = [];
    capturedHandlers.close = [];
    arcjetWsSecurityMiddleware.mockResolvedValue(true);

    const mockServer = { on: vi.fn() };
    const result = attachWebsocketHandlers(mockServer);
    broadcastMatchUpdate = result.broadcastMatchUpdate;
    broadcastCommentary = result.broadcastCommentary;
  });

  it("returns broadcastMatchUpdate and broadcastCommentary functions", () => {
    expect(typeof broadcastMatchUpdate).toBe("function");
    expect(typeof broadcastCommentary).toBe("function");
  });

  describe("connection handling", () => {
    it("sends WebSocket_server_created message to new client", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      const serverCreatedMsg = socket.send.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.payload?.data?.type === "WebSocket_server_created";
      });

      expect(serverCreatedMsg).toBeDefined();
      const msg = JSON.parse(serverCreatedMsg[0]);
      expect(msg.payload.success).toBe(true);
      expect(msg.payload.data.id).toBe("test-uuid-1234");
    });

    it("broadcasts client_joined to all connected clients", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      const clientJoinedCall = socket.send.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.payload?.data?.type === "client_joined";
      });

      expect(clientJoinedCall).toBeDefined();
    });

    it("sets socket.isAlive to true on new connection", async () => {
      const socket = createMockSocket({ isAlive: false });
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      expect(socket.isAlive).toBe(true);
    });

    it("initializes socket.subscribedMatchIds as a Set", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      expect(socket.subscribedMatchIds).toBeInstanceOf(Set);
    });

    it("closes connection when Arcjet denies it", async () => {
      arcjetWsSecurityMiddleware.mockResolvedValueOnce(false);

      const socket = createMockSocket();
      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      expect(socket.close).toHaveBeenCalledWith(1008, "Forbidden: Access Denied");
    });

    it("does not register message handler when Arcjet denies connection", async () => {
      arcjetWsSecurityMiddleware.mockResolvedValueOnce(false);

      const socket = createMockSocket();
      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      // socket.on should NOT have been called for 'message' on denied connections
      const messageCalls = socket.on.mock.calls.filter((c) => c[0] === "message");
      expect(messageCalls).toHaveLength(0);
    });
  });

  describe("message handling - subscribe", () => {
    it("acknowledges subscription with subscribed_to_match response", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      socket.send.mockClear();
      triggerMessage(socket, { type: "subscribe", matchId: 42 });

      expect(socket.send).toHaveBeenCalledOnce();
      const msg = JSON.parse(socket.send.mock.calls[0][0]);
      expect(msg.payload.success).toBe(true);
      expect(msg.payload.data.type).toBe("subscribed_to_match");
      expect(msg.payload.data.matchId).toBe(42);
    });

    it("handles subscribe_match message type", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      socket.send.mockClear();
      triggerMessage(socket, { type: "subscribe_match", matchId: 10 });

      const msg = JSON.parse(socket.send.mock.calls[0][0]);
      expect(msg.payload.data.type).toBe("subscribed_to_match");
      expect(msg.payload.data.matchId).toBe(10);
    });

    it("adds matchId to socket.subscribedMatchIds on subscribe", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 99 });

      expect(socket.subscribedMatchIds.has(99)).toBe(true);
    });
  });

  describe("message handling - unsubscribe", () => {
    it("acknowledges unsubscription with unsubscribed_from_match response", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 7 });
      socket.send.mockClear();

      triggerMessage(socket, { type: "unsubscribe", matchId: 7 });

      expect(socket.send).toHaveBeenCalledOnce();
      const msg = JSON.parse(socket.send.mock.calls[0][0]);
      expect(msg.payload.success).toBe(true);
      expect(msg.payload.data.type).toBe("unsubscribed_from_match");
      expect(msg.payload.data.matchId).toBe(7);
    });

    it("handles unsubscribe_match message type", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 5 });
      socket.send.mockClear();
      triggerMessage(socket, { type: "unsubscribe_match", matchId: 5 });

      const msg = JSON.parse(socket.send.mock.calls[0][0]);
      expect(msg.payload.data.type).toBe("unsubscribed_from_match");
    });

    it("removes matchId from socket.subscribedMatchIds on unsubscribe", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 12 });
      triggerMessage(socket, { type: "unsubscribe", matchId: 12 });

      expect(socket.subscribedMatchIds.has(12)).toBe(false);
    });
  });

  describe("message handling - errors", () => {
    it("returns error when matchId is not an integer", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      socket.send.mockClear();
      triggerMessage(socket, { type: "subscribe", matchId: "not-a-number" });

      const msg = JSON.parse(socket.send.mock.calls[0][0]);
      expect(msg.payload.success).toBe(false);
      expect(msg.payload.error).toBe("matchId must be an integer");
    });

    it("returns error for unsupported message type", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      socket.send.mockClear();
      triggerMessage(socket, { type: "ping", matchId: 1 });

      const msg = JSON.parse(socket.send.mock.calls[0][0]);
      expect(msg.payload.success).toBe(false);
      expect(msg.payload.error).toBe("Unsupported message type");
    });

    it("returns error when message is not valid JSON", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      socket.send.mockClear();

      const handler = socket._listeners["message"];
      handler(Buffer.from("this is not json"));

      expect(socket.send).toHaveBeenCalledOnce();
      const msg = JSON.parse(socket.send.mock.calls[0][0]);
      expect(msg.payload.success).toBe(false);
    });

    it("does not send to socket that is not OPEN", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      socket.send.mockClear();
      socket.readyState = 3; // CLOSED
      triggerMessage(socket, { type: "subscribe", matchId: 1 });

      expect(socket.send).not.toHaveBeenCalled();
    });
  });

  describe("broadcastMatchUpdate", () => {
    it("does not throw when called with null match", () => {
      expect(() => broadcastMatchUpdate(null)).not.toThrow();
    });

    it("does not throw when called with undefined match", () => {
      expect(() => broadcastMatchUpdate(undefined)).not.toThrow();
    });

    it("does not broadcast when match has no id", () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      broadcastMatchUpdate({ sport: "football" });

      expect(socket.send).not.toHaveBeenCalled();
    });

    it("broadcasts match update to subscribed clients", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 55 });
      socket.send.mockClear();

      broadcastMatchUpdate({ id: 55, sport: "football", homeTeam: "A" });

      expect(socket.send).toHaveBeenCalledOnce();
      const msg = JSON.parse(socket.send.mock.calls[0][0]);
      expect(msg.payload.success).toBe(true);
      expect(msg.payload.data.type).toBe("match_created_at");
      expect(msg.payload.data.match.id).toBe(55);
    });

    it("does not broadcast to clients subscribed to a different matchId", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 10 });
      socket.send.mockClear();

      broadcastMatchUpdate({ id: 20, sport: "football" });

      expect(socket.send).not.toHaveBeenCalled();
    });

    it("skips sockets that are not OPEN during broadcast", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 77 });
      socket.send.mockClear();
      socket.readyState = 3; // CLOSED

      broadcastMatchUpdate({ id: 77, sport: "football" });

      expect(socket.send).not.toHaveBeenCalled();
    });
  });

  describe("broadcastCommentary", () => {
    it("does not throw when called with null matchId", () => {
      expect(() => broadcastCommentary(null, { id: 1 })).not.toThrow();
    });

    it("does not throw when called with null comment", () => {
      expect(() => broadcastCommentary(1, null)).not.toThrow();
    });

    it("does not broadcast when both matchId and comment are null", () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      broadcastCommentary(null, null);

      expect(socket.send).not.toHaveBeenCalled();
    });

    it("broadcasts commentary to subscribed clients", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 33 });
      socket.send.mockClear();

      const comment = { id: 9, matchId: 33, message: "Goal!", minute: 87 };
      broadcastCommentary(33, comment);

      expect(socket.send).toHaveBeenCalledOnce();
      const msg = JSON.parse(socket.send.mock.calls[0][0]);
      expect(msg.payload.success).toBe(true);
      expect(msg.payload.data.type).toBe("commentary_update");
      expect(msg.payload.data.commentary).toEqual(comment);
    });

    it("does not broadcast commentary to clients subscribed to different match", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 10 });
      socket.send.mockClear();

      broadcastCommentary(20, { id: 1, message: "Goal!" });

      expect(socket.send).not.toHaveBeenCalled();
    });

    it("broadcasts to all clients subscribed to the same match", async () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();
      mockClients.add(socket1);
      mockClients.add(socket2);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket1);
      await connectionHandler(socket2);

      triggerMessage(socket1, { type: "subscribe", matchId: 44 });
      triggerMessage(socket2, { type: "subscribe", matchId: 44 });
      socket1.send.mockClear();
      socket2.send.mockClear();

      const comment = { id: 5, message: "Yellow card" };
      broadcastCommentary(44, comment);

      expect(socket1.send).toHaveBeenCalledOnce();
      expect(socket2.send).toHaveBeenCalledOnce();
    });
  });

  describe("pong handling", () => {
    it("sets isAlive to true on pong", async () => {
      const socket = createMockSocket({ isAlive: false });
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      socket.isAlive = false;
      triggerPong(socket);

      expect(socket.isAlive).toBe(true);
    });
  });

  describe("close handling and cleanup", () => {
    it("cleans up subscriptions when socket closes", async () => {
      const socket = createMockSocket();
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      triggerMessage(socket, { type: "subscribe", matchId: 88 });
      expect(socket.subscribedMatchIds.has(88)).toBe(true);

      triggerClose(socket);

      expect(socket.subscribedMatchIds).toBeNull();
    });

    it("does not throw on close when subscribedMatchIds is null", async () => {
      const socket = createMockSocket({ subscribedMatchIds: null });
      mockClients.add(socket);

      const [connectionHandler] = capturedHandlers.connection;
      await connectionHandler(socket);

      socket.subscribedMatchIds = null;

      expect(() => triggerClose(socket)).not.toThrow();
    });
  });
});