import { Request , Response } from "express";
import { payment_services } from "../services/payment.service";

const paymentService = new payment_services() ;

export const createPaymentIntent = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const { type, provider, last4 } = req.body;

        if(!type){
            res.status(400).json({
                msg : "Payment type is required"
            });
            return;
        }

        const paymentIntent = await paymentService.addPaymentMethodService(userId , {
            type, provider, last4
        }) ;

        res.status(201).json(paymentIntent) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const getPaymentMethods = async (req : any , res : Response) => {

    try { 
        const userId = req.user.userId ;

        const paymentMethods = await paymentService.getPaymentMethodsService(userId) ;

        res.status(200).json(paymentMethods) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}

export const updatePaymentMethod = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const paymentMethodId = req.params.id ;
        const { type, provider, last4 } = req.body;

        if(type === undefined && provider === undefined && last4 === undefined){
            res.status(400).json({
                msg : "At least one field is required"
            });
            return;
        }

        const updatedPaymentMethod = await paymentService.updatePaymentMethodService(
            userId,
            paymentMethodId,
            { type, provider, last4 }
        );

        res.status(200).json(updatedPaymentMethod) ;
    }
    catch(err : any){
        if(err.message === "Payment method not found"){
            res.status(404).json({
                msg : err.message
            });
            return;
        }

        res.status(500).json({
            msg : err.message
        });
    }
}

export const deletePaymentMethod = async (req : any , res : Response) => {

    try {

        const userId = req.user.userId ;
        const paymentMethodId = req.params.id ;

        await paymentService.deletePaymentMethodService(userId , paymentMethodId) ;

        res.status(200).json({
            msg : "Payment method deleted successfully"
        }) ;
    }
    catch(err : any){
        res.status(500).json({
            msg : err.message
        });
    }
}