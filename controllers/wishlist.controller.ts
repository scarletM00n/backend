import { Response } from "express";
import { wishlist_services } from "../services/wishlist.service";

const wishlistService = new wishlist_services();

export const getWishlist = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;

        const wishlist = await wishlistService.getWishlistService(userId);
        res.status(200).json(wishlist);
    } catch (err: any) {
        res.status(500).json({
            msg: err.message,
        });
    }
};

export const addToWishlist = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;
        const { product_id } = req.body;

        if (!product_id) {
            res.status(400).json({
                msg: "product_id is required",
            });
            return;
        }

        const result = await wishlistService.addToWishlistService(userId, product_id);

        if (result.created) {
            res.status(201).json(result.item);
            return;
        }

        res.status(200).json(result.item);
    } catch (err: any) {
        if (err.message === "Product not found") {
            res.status(404).json({
                msg: err.message,
            });
            return;
        }

        res.status(500).json({
            msg: err.message,
        });
    }
};

export const removeFromWishlist = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;
        const productId = req.params.id;

        if (!productId) {
            res.status(400).json({
                msg: "Product ID is required",
            });
            return;
        }

        const result = await wishlistService.removeFromWishlistService(userId, productId);
        res.status(200).json(result);
    } catch (err: any) {
        if (err.message === "Wishlist item not found") {
            res.status(404).json({
                msg: err.message,
            });
            return;
        }

        res.status(500).json({
            msg: err.message,
        });
    }
};

export const clearWishlist = async (req: any, res: Response) => {
    try {
        const userId = req.user.userId;
        const result = await wishlistService.clearWishlistService(userId);
        res.status(200).json(result);
    } catch (err: any) {
        res.status(500).json({
            msg: err.message,
        });
    }
};
