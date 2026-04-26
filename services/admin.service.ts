import { prisma } from "../model/prisma";

type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

type Period = "week" | "month" | "year";

const asNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number((value as { toString: () => string }).toString());
  }
  return 0;
};

const startOfPeriod = (period: Period): Date => {
  const now = new Date();
  if (period === "year") {
    return new Date(now.getFullYear(), 0, 1);
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
};

const formatBucket = (date: Date, period: Period): string => {
  if (period === "year") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const isOrderStatus = (value: string): value is OrderStatus => {
  return ["pending", "paid", "shipped", "delivered", "cancelled"].includes(value);
};

export class admin_services {
  async getDashboardSummaryService() {
    const [
      orders,
      totalCustomers,
      pendingOrders,
      lowStockCount,
      topProducts,
    ] = await Promise.all([
      prisma.order.findMany({
        select: {
          id: true,
          total_price: true,
          created_at: true,
          status: true,
        },
      }),
      prisma.user.count({ where: { role: "customer" } }),
      prisma.order.count({ where: { status: "pending" } }),
      prisma.productSize.count({ where: { stock: { lte: 10 } } }),
      prisma.orderItem.groupBy({
        by: ["product_id"],
        _sum: {
          quantity: true,
          price: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 5,
      }),
    ]);

    const totalRevenue = orders.reduce((sum, order) => sum + asNumber(order.total_price), 0);

    const topProductIds = topProducts.map((item) => item.product_id);
    const products = topProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: {
            id: true,
            name: true,
            image_url: true,
            brand: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];

    const productMap = new Map(products.map((product) => [product.id, product]));

    return {
      kpis: {
        total_revenue: Number(totalRevenue.toFixed(2)),
        total_orders: orders.length,
        total_customers: totalCustomers,
        pending_orders: pendingOrders,
        low_stock_items: lowStockCount,
      },
      leaderboard: topProducts.map((item, index) => {
        const product = productMap.get(item.product_id);
        return {
          rank: index + 1,
          product_id: item.product_id,
          product_name: product?.name ?? "Unknown product",
          brand_name: product?.brand?.name ?? "",
          image_url: product?.image_url ?? "",
          sold_units: item._sum.quantity ?? 0,
          revenue: Number(asNumber(item._sum.price).toFixed(2)),
        };
      }),
    };
  }

  async getAnalyticsOverviewService(period: Period = "month") {
    const fromDate = startOfPeriod(period);

    const [orders, allStatuses] = await Promise.all([
      prisma.order.findMany({
        where: { created_at: { gte: fromDate } },
        select: {
          created_at: true,
          total_price: true,
          status: true,
        },
        orderBy: { created_at: "asc" },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
    ]);

    const revenueBuckets = new Map<string, number>();
    for (const order of orders) {
      const bucket = formatBucket(order.created_at, period);
      const current = revenueBuckets.get(bucket) ?? 0;
      revenueBuckets.set(bucket, current + asNumber(order.total_price));
    }

    const statusDistribution: Record<OrderStatus, number> = {
      pending: 0,
      paid: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const row of allStatuses) {
      statusDistribution[row.status] = row._count._all;
    }

    return {
      period,
      revenue_series: Array.from(revenueBuckets.entries()).map(([bucket, revenue]) => ({
        bucket,
        revenue: Number(revenue.toFixed(2)),
      })),
      order_status_distribution: statusDistribution,
    };
  }

  async getAdminOrdersService(params: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { status, search, page = 1, limit = 20 } = params;

    const where: any = {};
    if (status && isOrderStatus(status)) {
      where.status = status;
    }

    if (search && search.trim().length > 0) {
      where.OR = [
        {
          id: {
            contains: search.trim(),
            mode: "insensitive",
          },
        },
        {
          user: {
            email: {
              contains: search.trim(),
              mode: "insensitive",
            },
          },
        },
        {
          user: {
            full_name: {
              contains: search.trim(),
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
          address: true,
          order_items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  image_url: true,
                },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => ({
        ...order,
        total_price: Number(asNumber(order.total_price).toFixed(2)),
        order_items: order.order_items.map((item) => ({
          ...item,
          price: Number(asNumber(item.price).toFixed(2)),
        })),
      })),
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async updateOrderStatusService(orderId: string, status: OrderStatus) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new Error("Order not found");
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    return {
      ...updated,
      total_price: Number(asNumber(updated.total_price).toFixed(2)),
    };
  }

  async getInventoryService(params: { search?: string; lowStockOnly?: boolean }) {
    const where: any = {};
    if (params.search && params.search.trim().length > 0) {
      where.OR = [
        {
          name: {
            contains: params.search.trim(),
            mode: "insensitive",
          },
        },
        {
          brand: {
            name: {
              contains: params.search.trim(),
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        sizes: {
          orderBy: {
            size: "asc",
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const mapped = products
      .map((product) => {
        const totalStock = product.sizes.reduce((sum, sizeRow) => sum + sizeRow.stock, 0);
        return {
          product_id: product.id,
          product_name: product.name,
          brand_name: product.brand.name,
          image_url: product.image_url,
          total_stock: totalStock,
          sizes: product.sizes.map((sizeRow) => ({
            id: sizeRow.id,
            size: sizeRow.size,
            stock: sizeRow.stock,
            price: Number(asNumber(sizeRow.price).toFixed(2)),
          })),
        };
      })
      .filter((product) => {
        if (!params.lowStockOnly) return true;
        return product.sizes.some((sizeRow) => sizeRow.stock <= 10);
      });

    return {
      data: mapped,
      low_stock_count: mapped.reduce(
        (sum, product) => sum + product.sizes.filter((sizeRow) => sizeRow.stock <= 10).length,
        0,
      ),
    };
  }

  async updateInventoryStockService(productId: string, size: string, stock: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    const existingSize = await prisma.productSize.findUnique({
      where: {
        product_id_size: {
          product_id: productId,
          size,
        },
      },
    });

    if (!existingSize) {
      throw new Error("Product size not found");
    }

    const updated = await prisma.productSize.update({
      where: {
        id: existingSize.id,
      },
      data: {
        stock,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      size_id: updated.id,
      product_id: updated.product_id,
      product_name: updated.product.name,
      size: updated.size,
      stock: updated.stock,
      price: Number(asNumber(updated.price).toFixed(2)),
    };
  }
}
