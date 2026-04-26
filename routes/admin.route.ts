import { Router } from "express";
import {
  getAdminAnalyticsOverview,
  getAdminDashboardSummary,
  getAdminInventory,
  getAdminOrders,
  patchAdminInventoryStock,
  patchAdminOrderStatus,
} from "../controllers/admin.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const adminRouter = Router();

adminRouter.use(authMiddleware(["admin"]));

adminRouter.get("/dashboard/summary", getAdminDashboardSummary);
adminRouter.get("/analytics/overview", getAdminAnalyticsOverview);
adminRouter.get("/orders", getAdminOrders);
adminRouter.patch("/orders/:id/status", patchAdminOrderStatus);
adminRouter.get("/inventory", getAdminInventory);
adminRouter.patch("/inventory/:productId/sizes/:size/stock", patchAdminInventoryStock);

export default adminRouter;
