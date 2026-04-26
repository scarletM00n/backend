import { prisma } from "../model/prisma";

export class wishlist_services {
    constructor() {}

    async getWishlistService(userId: string) {
        const wishlist = await prisma.wishlist.findUnique({
            where: {
                user_id: userId,
            },
            include: {
                wishlist_items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                image_url: true,
                                gender: true,
                                fragrance_family: true,
                                brand: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                                sizes: {
                                    select: {
                                        size: true,
                                        price: true,
                                    },
                                    orderBy: {
                                        size: "asc",
                                    },
                                },
                            },
                        },
                    },
                    orderBy: {
                        id: "desc",
                    },
                },
            },
        });

        return {
            wishlist_items: wishlist?.wishlist_items ?? [],
        };
    }

    async addToWishlistService(userId: string, productId: string) {
        const wishlist = await prisma.wishlist.findUnique({
            where: {
                user_id: userId,
            },
        });

        if (!wishlist) {
            throw new Error("Wishlist not found for user");
        }

        const product = await prisma.product.findUnique({
            where: {
                id: productId,
            },
            select: {
                id: true,
            },
        });

        if (!product) {
            throw new Error("Product not found");
        }

        const existingItem = await prisma.wishlistItem.findUnique({
            where: {
                wishlist_id_product_id: {
                    wishlist_id: wishlist.id,
                    product_id: productId,
                },
            },
        });

        if (existingItem) {
            return {
                item: existingItem,
                created: false,
            };
        }

        const createdItem = await prisma.wishlistItem.create({
            data: {
                wishlist_id: wishlist.id,
                product_id: productId,
            },
        });

        return {
            item: createdItem,
            created: true,
        };
    }

    async removeFromWishlistService(userId: string, productId: string) {
        const wishlist = await prisma.wishlist.findUnique({
            where: {
                user_id: userId,
            },
        });

        if (!wishlist) {
            throw new Error("Wishlist not found for user");
        }

        const existingItem = await prisma.wishlistItem.findUnique({
            where: {
                wishlist_id_product_id: {
                    wishlist_id: wishlist.id,
                    product_id: productId,
                },
            },
        });

        if (!existingItem) {
            throw new Error("Wishlist item not found");
        }

        await prisma.wishlistItem.delete({
            where: {
                id: existingItem.id,
            },
        });

        return {
            msg: "Item removed from wishlist",
        };
    }

    async clearWishlistService(userId: string) {
        const wishlist = await prisma.wishlist.findUnique({
            where: {
                user_id: userId,
            },
        });

        if (!wishlist) {
            throw new Error("Wishlist not found for user");
        }

        await prisma.wishlistItem.deleteMany({
            where: {
                wishlist_id: wishlist.id,
            },
        });

        return {
            msg: "Wishlist cleared",
        };
    }
}
