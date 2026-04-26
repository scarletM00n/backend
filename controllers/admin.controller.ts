import { OrderStatus } from "@prisma/client";
import { Request, Response } from "express";
import { admin_services } from "../services/admin.service";

const adminService = new admin_services();

const isOrderStatus = (value: string): value is OrderStatus => {
  return ["pending", "paid", "shipped", "delivered", "cancelled"].includes(value);
};

export const getAdminDashboardSummary = async (_req: Request, res: Response) => {
  try {
    const data = await adminService.getDashboardSummaryService();
    res.status(200).json(data);
  } catch (error: any) {
    res.status(500).json({ msg: error.message });
  }
};

export const getAdminAnalyticsOverview = async (req: Request, res: Response) => {
  try {
    const periodRaw = String(req.query.period ?? "month").toLowerCase();
    const period = periodRaw === "week" || periodRaw === "year" ? periodRaw : "month";
    const data = await adminService.getAnalyticsOverviewService(period);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(500).json({ msg: error.message });
  }
};

export const getAdminOrders = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const data = await adminService.getAdminOrdersService({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20,
      status,
      search,
    });

    res.status(200).json(data);
  } catch (error: any) {
    res.status(500).json({ msg: error.message });
  }
};

export const patchAdminOrderStatus = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id ?? "");
    const statusRaw = String(req.body?.status ?? "").toLowerCase();

    if (!isOrderStatus(statusRaw)) {
      res.status(400).json({ msg: "Invalid order status" });
      return;
    }

    const updated = await adminService.updateOrderStatusService(orderId, statusRaw);
    res.status(200).json(updated);
  } catch (error: any) {
    const message = (error?.message ?? "").toString();
    if (message.toLowerCase().includes("not found")) {
      res.status(404).json({ msg: message });
      return;
    }
    res.status(500).json({ msg: message || "Failed to update order status" });
  }
};

export const getAdminInventory = async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const lowStockOnly = String(req.query.low_stock_only ?? "false").toLowerCase() === "true";

    const data = await adminService.getInventoryService({
      search,
      lowStockOnly,
    });

    res.status(200).json(data);
  } catch (error: any) {
    res.status(500).json({ msg: error.message });
  }
};

export const patchAdminInventoryStock = async (req: Request, res: Response) => {
  try {
    const productId = String(req.params.productId ?? "");
    const size = String(req.params.size ?? "");
    const stock = Number(req.body?.stock);

    if (!Number.isFinite(stock) || stock < 0) {
      res.status(400).json({ msg: "Stock must be a non-negative number" });
      return;
    }

    const updated = await adminService.updateInventoryStockService(productId, size, Math.floor(stock));
    res.status(200).json(updated);
  } catch (error: any) {
    const message = (error?.message ?? "").toString();
    if (message.toLowerCase().includes("not found")) {
      res.status(404).json({ msg: message });
      return;
    }
    res.status(500).json({ msg: message || "Failed to update stock" });
  }
};
