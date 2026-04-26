import { Request , Response } from "express";
import { order_services } from "../services/order.service";
import { emitDeliveryMessage, emitDeliveryRead } from "../realtime/socket";

const orderService = new order_services() ;

export const placeOrder = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const { addressId , delivery_method , payment_method } = req.body ;

        if(!addressId || !delivery_method || !payment_method){
            res.status(400).json({
                msg : "All fields are required"
            });
            return;
        }

        const order = await orderService.placeOrderService(userId , addressId , delivery_method , payment_method) ;

        res.status(201).json(order) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const getOrderHistory  = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;

        const orders = await orderService.getOrderHistoryService(userId) ;
        res.status(200).json(orders) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const getOrderById = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const orderId = req.params.id ;

        const order = await orderService.getOrderByIdService(userId , orderId) ;
        res.status(200).json(order) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const getTrackerPayload = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const orderId = req.params.orderId ;

        const payload = await orderService.getTrackerPayloadService(userId , orderId) ;
        res.status(200).json(payload) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const postDeliveryMessage = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const orderId = req.params.orderId ;
        const { message } = req.body ;

        if(!message || message.trim().length === 0){
            res.status(400).json({
                msg : "Message cannot be empty"
            });
            return;
        }

        const newMessage = await orderService.postDeliveryMessageService(userId , orderId , message) ;
        emitDeliveryMessage(orderId, newMessage);
        res.status(201).json(newMessage) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const markOrderReceived = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const orderId = req.params.orderId ;

        const updatedOrder = await orderService.markOrderReceivedService(userId , orderId) ;
        res.status(200).json(updatedOrder) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const markOrderCancelled = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const orderId = req.params.orderId ;

        const updatedOrder = await orderService.markOrderCancelledService(userId , orderId) ;
        res.status(200).json(updatedOrder) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const markDeliveryMessagesSeen = async (req: any, res: Response) => {

    try {
        const userId = req.user.userId;
        const orderId = req.params.orderId;
        const messageIdsInput = Array.isArray(req.body?.messageIds) ? req.body.messageIds : [];
        const messageIds = messageIdsInput
            .map((id: unknown) => (typeof id === 'string' ? id.trim() : ''))
            .filter((id: string) => id.length > 0);

        const result = await orderService.markDeliveryMessagesSeenAsCustomerService(
            userId,
            orderId,
            messageIds,
        );

        for (const message of result.messages) {
            if (!message.read_at) continue;
            emitDeliveryRead(orderId, {
                orderId,
                reader: 'customer',
                messageId: message.id,
                readAt: message.read_at,
            });
        }

        res.status(200).json(result);
    }
    catch (err: any) {
        res.status(500).json({
            msg: err.message,
        });
    }
}