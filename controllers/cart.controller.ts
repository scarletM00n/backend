import { Request , Response } from "express";
import { cart_services } from "../services/cart.service";

const cartService = new cart_services() ;

export const getCart = async (req : any , res : Response) => {

    try{
        const userId = req.user.userId ;
        console.log("User ID from token:", userId); // Debugging log

        const cart = await cartService.getCartService(userId) ;

        res.status(200).json(cart) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const addToCart = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const {productId , size , quantity} = req.body ;

        if(!productId || !size){
            res.status(400).json({
                msg : "Product ID and size are required"
            });
            return;
        }

        const item = await cartService.addToCartService(userId , productId , size , quantity) ;
        res.status(200).json(item) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const updateCartItem = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const { size , quantity} = req.body ;
        const productId = req.params.id ;

        if(!productId || !size){
            res.status(400).json({
                msg : "Product ID and size are required"
            });
            return;
        }

        if(quantity === undefined){
            res.status(400).json({
                msg : "Quantity is required"
            });
            return;
        }

        const updatedCart = await cartService.updateCartItemService(userId , productId , size , quantity) ;
        res.status(200).json(updatedCart) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const removeFromCart = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const {size} = req.body ;
        const productId = req.params.id ;

        const updatedCart = await cartService.removeFromCartService(userId , productId , size) ;
        res.status(200).json(updatedCart) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const clearCart = async (req : any , res : Response) => {

    try{
        const userId = req.user.userId ;
        const clearedCart = await cartService.clearCartService(userId) ;
        res.status(200).json(clearedCart) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}