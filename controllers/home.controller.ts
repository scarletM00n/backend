import { Request , Response } from "express";
import { home_services } from "../services/home.service";

const homeServices = new home_services() ;

export const home = async(req : Request , res : Response) => {
    try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;

        const result = await homeServices.getHomeData(baseUrl) ;

        res.status(200).json({
            data : result
        });
    }
    catch(err : any){
        res.status(400).json({
            msg : err.message
        });
    }
}