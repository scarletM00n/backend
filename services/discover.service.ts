import { prisma } from "../model/prisma";
import { toAbsoluteUploadUrl } from "../utils/uploadFile";

const normalizeDiscoverProduct = (baseUrl: string, product: any) => ({
  id: product?.id ?? "",
  name: product?.name ?? "",
  image: toAbsoluteUploadUrl(baseUrl, product?.image_url),
  brandId: product?.brand?.id,
  brand: product?.brand?.name ?? "",
  price: product?.sizes?.[0]?.price || 0,
  gender: product?.gender,
  family: product?.fragrance_family,
  isFeatured: product?.is_featured,
  isNewArrival: product?.is_new_arrival,
});

// Fragrance family images (can be moved to DB later)
const familyImages: Record<string, string> = {
  floral: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f",
  woody: "https://images.unsplash.com/photo-1523293182086-7651a899d37f",
  oriental: "https://images.unsplash.com/photo-1594035910387-fea47794261f",
  fresh: "https://images.unsplash.com/photo-1541643600914-78b084683601",
  citrus: "https://images.unsplash.com/photo-1615634260167-c8cdede054de",
  aquatic: "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75",
};

export class discover_services {
  constructor() {}

  async getDiscoverData(baseUrl = "") {
    const [familiesRaw, trendingRaw, featuredBrandsRaw] = await Promise.all([
      prisma.product.groupBy({
        by: ["fragrance_family"],
        _count: { _all: true },
        orderBy: {
          _count: { fragrance_family: "desc" },
        },
      }),

      // Trending (most sold)
      prisma.orderItem.groupBy({
        by: ["product_id"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      }),

      // Featured brands (with most products)
      prisma.brand.findMany({
        where: {
          products: { some: { is_featured: true } },
        },
        include: {
          products: {
            where: { is_featured: true },
            take: 1,
            select: { image_url: true },
          },
        },
        take: 5,
      }),
    ]);

    // Format families
    const families = familiesRaw.map((f: any) => ({
      name: f.fragrance_family,
      count: f._count._all,
      image: familyImages[f.fragrance_family] || "default.jpg",
    }));

    // Extract and get trending products
    const productIds = trendingRaw.map((t) => t.product_id);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        image_url: true,
        brand: {
          select: { id: true, name: true },
        },
        sizes: {
          select: { price: true },
          orderBy: { price: "asc" },
          take: 1,
        },
      },
    });

    const sortedProducts = productIds.map((id) =>
      products.find((p) => p.id === id)
    );

    const trending = sortedProducts.map((p) => normalizeDiscoverProduct(baseUrl, p));

    // Format featured brands
    const featuredBrands = featuredBrandsRaw.map((brand: any) => ({
      id: brand.id,
      name: brand.name,
      logo_url: toAbsoluteUploadUrl(baseUrl, brand.logo_url),
      image: toAbsoluteUploadUrl(baseUrl, brand.products[0]?.image_url || brand.logo_url),
    }));

    return {
      families,
      trending,
      featuredBrands,
    };
  }

  async searchBrands(query: string, baseUrl = "") {
    const brands = await prisma.brand.findMany({
      where: {
        name: {
          contains: query,
          mode: "insensitive",
        },
      },
      include: {
        products: {
          take: 1,
          select: { image_url: true },
        },
      },
      take: 10,
    });

    return brands.map((brand: any) => ({
      id: brand.id,
      name: brand.name,
      logo_url: toAbsoluteUploadUrl(baseUrl, brand.logo_url),
      image: toAbsoluteUploadUrl(baseUrl, brand.products[0]?.image_url || brand.logo_url),
    }));
  }

  async filterProducts(gender?: string, family?: string, baseUrl = "") {
    const where: any = {};

    if (gender && gender !== "all") {
      where.gender = gender;
    }

    if (family && family !== "all") {
      where.fragrance_family = family;
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        image_url: true,
        gender: true,
        fragrance_family: true,
        is_featured: true,
        is_new_arrival: true,
        brand: {
          select: { id: true, name: true },
        },
        sizes: {
          select: { price: true },
          orderBy: { price: "asc" },
          take: 1,
        },
      },
      take: 20,
    });

    return products.map((p: any) => normalizeDiscoverProduct(baseUrl, p));
  }

  async getBrandDetails(brandId: string, baseUrl = "") {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            image_url: true,
            gender: true,
            fragrance_family: true,
            is_featured: true,
            sizes: {
              select: { price: true },
              orderBy: { price: "asc" },
              take: 1,
            },
          },
          take: 12,
        },
      },
    });

    if (!brand) {
      throw new Error("Brand not found");
    }

    return {
      id: brand.id,
      name: brand.name,
      logo_url: toAbsoluteUploadUrl(baseUrl, brand.logo_url),
      productCount: brand.products.length,
      products: brand.products.map((p: any) => ({
        ...normalizeDiscoverProduct(baseUrl, {
          ...p,
          brand: { id: brand.id, name: brand.name },
        }),
      })),
    };
  }

  async getPopularHouses(baseUrl = "") {
    const brands = await prisma.brand.findMany({
      include: {
        _count: {
          select: { products: true },
        },
        products: {
          select: {
            id: true,
            name: true,
            image_url: true,
            is_featured: true,
            sizes: {
              select: { price: true },
              orderBy: { price: "asc" },
              take: 1,
            },
          },
          take: 4,
          orderBy: { is_featured: "desc" },
        },
      },
      orderBy: {
        products: { _count: "desc" },
      },
      take: 6,
    });

    return brands.map((brand: any) => ({
      id: brand.id,
      name: brand.name,
      logo_url: toAbsoluteUploadUrl(baseUrl, brand.logo_url),
      productCount: brand._count.products,
      products: brand.products.map((p: any) =>
        normalizeDiscoverProduct(baseUrl, {
          ...p,
          brand: { id: brand.id, name: brand.name },
        })
      ),
    }));
  }
}