import { Router } from "express";
import { addAddress, deleteAddress, getaddresses, updateAddress } from "../controllers/address.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const addressRouter = Router() ;

addressRouter.get('/' , authMiddleware() ,getaddresses) ;
addressRouter.post('/add' , authMiddleware() ,addAddress) ;
addressRouter.patch('/update/:id' , authMiddleware() ,updateAddress) ;
addressRouter.delete('/delete/:id' , authMiddleware() ,deleteAddress) ;
export default addressRouter ;