import { Router } from "express";
import {
  claimDeliveryOrder,
  getDeliveryAssignedOrders,
  getDeliveryAvailableOrders,
  getDeliveryTrackerPayload,
  markDeliveryMessagesSeenAsDelivery,
  postDeliveryMessageAsDelivery,
  updateDeliveryLocation,
} from "../controllers/delivery.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const deliveryRouter = Router();

deliveryRouter.use(authMiddleware(["delivery_person"]));

deliveryRouter.get("/orders/available", getDeliveryAvailableOrders);
deliveryRouter.get("/orders/assigned", getDeliveryAssignedOrders);
deliveryRouter.post("/orders/:orderId/claim", claimDeliveryOrder);
deliveryRouter.patch("/orders/:orderId/location", updateDeliveryLocation);
deliveryRouter.get("/orders/:orderId/tracker", getDeliveryTrackerPayload);
deliveryRouter.post("/orders/:orderId/messages", postDeliveryMessageAsDelivery);
deliveryRouter.patch("/orders/:orderId/messages/seen", markDeliveryMessagesSeenAsDelivery);

export default deliveryRouter;