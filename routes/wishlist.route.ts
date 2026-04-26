import { Router } from "express";
import {
    addToWishlist,
    clearWishlist,
    getWishlist,
    removeFromWishlist,
} from "../controllers/wishlist.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const wishlistRouter = Router();

wishlistRouter.get("/", authMiddleware(), getWishlist);
wishlistRouter.post("/add", authMiddleware(), addToWishlist);
wishlistRouter.delete("/remove/:id", authMiddleware(), removeFromWishlist);
wishlistRouter.delete("/clear", authMiddleware(), clearWishlist);

export default wishlistRouter;
