import { Router } from "express";
import { deletePaymentMethod, createPaymentIntent, getPaymentMethods, updatePaymentMethod } from "../controllers/payment.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const paymentRouter = Router() ;

paymentRouter.get('/' , authMiddleware() ,getPaymentMethods)
paymentRouter.post('/add' , authMiddleware() ,createPaymentIntent) ;
paymentRouter.patch('/update/:id' , authMiddleware() , updatePaymentMethod) ;
paymentRouter.delete('/delete/:id' , authMiddleware() , deletePaymentMethod) ;

export default paymentRouter ;