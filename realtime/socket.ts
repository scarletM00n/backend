import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { order_services } from "../services/order.service";

let io: Server | null = null;
const orderService = new order_services();

const roomName = (orderId: string) => `order:${orderId}`;

type TypingPayload = {
  orderId: string;
  sender: string;
  isTyping: boolean;
};

type ReadPayload = {
  orderId: string;
  reader: string;
  messageId?: string;
};

const isValidTypingPayload = (payload: unknown): payload is TypingPayload => {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as Partial<TypingPayload>;
  return (
    typeof data.orderId === "string" &&
    data.orderId.trim().length > 0 &&
    typeof data.sender === "string" &&
    data.sender.trim().length > 0 &&
    typeof data.isTyping === "boolean"
  );
};

const isValidReadPayload = (payload: unknown): payload is ReadPayload => {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as Partial<ReadPayload>;
  return (
    typeof data.orderId === "string" &&
    data.orderId.trim().length > 0 &&
    typeof data.reader === "string" &&
    data.reader.trim().length > 0
  );
};

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("delivery:join-order", (orderId: unknown) => {
      if (typeof orderId !== "string" || orderId.trim().length === 0) {
        return;
      }
      socket.join(roomName(orderId));
    });

    socket.on("delivery:leave-order", (orderId: unknown) => {
      if (typeof orderId !== "string" || orderId.trim().length === 0) {
        return;
      }
      socket.leave(roomName(orderId));
    });

    socket.on("delivery:typing", (payload: unknown) => {
      if (!isValidTypingPayload(payload)) {
        return;
      }
      socket.to(roomName(payload.orderId)).emit("delivery:typing", payload);
    });

    socket.on("delivery:read", (payload: unknown) => {
      if (!isValidReadPayload(payload)) {
        return;
      }

      const messageId = payload.messageId?.trim();
      if (!messageId) {
        return;
      }

      void orderService
        .markDeliveryMessageSeenFromSocketService(
          payload.orderId,
          payload.reader,
          messageId,
        )
        .then((updated) => {
          if (!updated) return;
          io?.to(roomName(payload.orderId)).emit("delivery:read", {
            orderId: payload.orderId,
            reader: payload.reader,
            messageId: updated.id,
            readAt: updated.read_at,
          });
        })
        .catch(() => {
          // Ignore socket persistence failures to keep channel alive.
        });
    });
  });

  return io;
}

export function emitDeliveryMessage(orderId: string, message: unknown): void {
  if (!io) return;
  io.to(roomName(orderId)).emit("delivery:message-created", {
    orderId,
    message,
  });
}

export function emitDeliveryRead(orderId: string, payload: unknown): void {
  if (!io) return;
  io.to(roomName(orderId)).emit("delivery:read", payload);
}
