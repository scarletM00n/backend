import { Router } from "express";
import { getOrderById, getOrderHistory, placeOrder, getTrackerPayload, postDeliveryMessage, markOrderReceived, markOrderCancelled, markDeliveryMessagesSeen } from "../controllers/order.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const orderRouter = Router() ;

orderRouter.post('/' ,  authMiddleware() ,placeOrder);
orderRouter.get('/' , authMiddleware() ,getOrderHistory);
orderRouter.get('/:id' , authMiddleware() ,getOrderById);
orderRouter.get('/:orderId/tracker' , authMiddleware() ,getTrackerPayload);
orderRouter.post('/:orderId/messages' , authMiddleware() ,postDeliveryMessage);
orderRouter.patch('/:orderId/messages/seen' , authMiddleware() ,markDeliveryMessagesSeen);
orderRouter.patch('/:orderId/received' , authMiddleware() ,markOrderReceived);
orderRouter.patch('/:orderId/cancelled' , authMiddleware() ,markOrderCancelled);

export default orderRouter ;