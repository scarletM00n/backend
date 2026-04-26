import { Router } from "express";
import { addToCart, clearCart, getCart, removeFromCart, updateCartItem } from "../controllers/cart.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const cartRouter = Router() ;

cartRouter.get("/" , authMiddleware() , getCart) ;
cartRouter.post("/add" , authMiddleware() , addToCart) ;
cartRouter.patch("/update/:id" , authMiddleware() , updateCartItem) ;
cartRouter.delete("/remove/:id" , authMiddleware() , removeFromCart) ;
cartRouter.delete("/clear" , authMiddleware() , clearCart) ;

export default cartRouter ;
