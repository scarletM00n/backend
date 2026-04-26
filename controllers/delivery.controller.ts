import { Response } from "express";
import { order_services } from "../services/order.service";
import { emitDeliveryMessage, emitDeliveryRead } from "../realtime/socket";

const orderService = new order_services();

export const getDeliveryAvailableOrders = async (_req: any, res: Response) => {
    try {
        const orders = await orderService.getDeliveryAvailableOrdersService();
        res.status(200).json({ orders });
    }
    catch (err: any) {
        res.status(500).json({ msg: err.message });
    }
};

export const getDeliveryAssignedOrders = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;
        const orders = await orderService.getDeliveryAssignedOrdersService(userId);
        res.status(200).json({ orders });
    }
    catch (err: any) {
        res.status(500).json({ msg: err.message });
    }
};

export const claimDeliveryOrder = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;
        const orderId = req.params.orderId;

        const order = await orderService.claimDeliveryOrderService(userId, orderId);
        res.status(200).json({ order });
    }
    catch (err: any) {
        res.status(400).json({ msg: err.message });
    }
};

export const updateDeliveryLocation = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;
        const orderId = req.params.orderId;
        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            res.status(400).json({ msg: "Latitude and longitude are required" });
            return;
        }

        const order = await orderService.updateDeliveryLocationService(
            userId,
            orderId,
            Number(latitude),
            Number(longitude),
        );

        res.status(200).json({ order });
    }
    catch (err: any) {
        res.status(400).json({ msg: err.message });
    }
};

export const getDeliveryTrackerPayload = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;
        const orderId = req.params.orderId;

        const payload = await orderService.getDeliveryTrackerPayloadService(userId, orderId);
        res.status(200).json(payload);
    }
    catch (err: any) {
        res.status(400).json({ msg: err.message });
    }
};

export const postDeliveryMessageAsDelivery = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;
        const orderId = req.params.orderId;
        const { message } = req.body;

        if (!message || message.trim().length === 0) {
            res.status(400).json({ msg: "Message cannot be empty" });
            return;
        }

        const newMessage = await orderService.postDeliveryMessageAsDeliveryService(
            userId,
            orderId,
            message,
        );

        emitDeliveryMessage(orderId, newMessage);

        res.status(201).json(newMessage);
    }
    catch (err: any) {
        res.status(400).json({ msg: err.message });
    }
};

export const markDeliveryMessagesSeenAsDelivery = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;
        const orderId = req.params.orderId;
        const messageIdsInput = Array.isArray(req.body?.messageIds) ? req.body.messageIds : [];
        const messageIds = messageIdsInput
            .map((id: unknown) => (typeof id === 'string' ? id.trim() : ''))
            .filter((id: string) => id.length > 0);

        const result = await orderService.markDeliveryMessagesSeenAsDeliveryService(
            userId,
            orderId,
            messageIds,
        );

        for (const message of result.messages) {
            if (!message.read_at) continue;
            emitDeliveryRead(orderId, {
                orderId,
                reader: 'delivery',
                messageId: message.id,
                readAt: message.read_at,
            });
        }

        res.status(200).json(result);
    }
    catch (err: any) {
        res.status(400).json({ msg: err.message });
    }
};