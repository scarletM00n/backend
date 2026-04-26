import { Request , Response } from "express";
import { address_services } from "../services/address.service";

const addressService = new address_services() ;

export const getaddresses = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;  
        const addresses = await addressService.getAddressService(userId) ;
        res.json(addresses);
    } 
    catch (error : any ) {
        res.status(500).json({ error: error.message });
    }
}

export const addAddress = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const {
            label,
            street,
            city,
            state,
            zip_code,
            country,
            is_default,
            latitude,
            longitude,
        } = req.body;

        const parsedLatitude = latitude === undefined ? undefined : Number(latitude);
        const parsedLongitude = longitude === undefined ? undefined : Number(longitude);

        if(!label || !street || !city || !state || !zip_code || !country){
            res.status(400).json({
                msg : "All fields are required"
            });
            return;
        }

        if(
            (parsedLatitude !== undefined && Number.isNaN(parsedLatitude)) ||
            (parsedLongitude !== undefined && Number.isNaN(parsedLongitude))
        ){
            res.status(400).json({
                msg : "Latitude and longitude must be valid numbers"
            });
            return;
        }

        const newAddress = await addressService.addAddressService(userId , {
            label,
            street,
            city,
            state,
            zip_code,
            country,
            is_default,
            latitude: parsedLatitude,
            longitude: parsedLongitude,
        }); ;
        res.status(201).json(newAddress);
    } 
    catch (error : any ) {
        res.status(500).json({ error: error.message });
    }
}

export const updateAddress = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const  addressId = req.params.id ;
        const data = { ...req.body } ;

        if(data.latitude !== undefined){
            data.latitude = Number(data.latitude);
        }

        if(data.longitude !== undefined){
            data.longitude = Number(data.longitude);
        }

        if(
            (data.latitude !== undefined && Number.isNaN(data.latitude)) ||
            (data.longitude !== undefined && Number.isNaN(data.longitude))
        ){
            res.status(400).json({
                msg : "Latitude and longitude must be valid numbers"
            });
            return;
        }

        const updatedAddress = await addressService.updateAddressService(userId , addressId , data) ;
        res.status(200).json(updatedAddress);
    }
    catch (error : any ) {
        res.status(500).json({ error: error.message });
    }
}

export const deleteAddress = async (req : any , res : Response) => {

    try {
        const userId = req.user.userId ;
        const addressId = req.params.id ;

        await addressService.deleteAddressService(userId , addressId) ;
        res.status(200).json({
            msg : "Address deleted successfully"
        });
    }
    catch (error : any ) {
        if(error.message === "Address not found"){
            res.status(404).json({ error: error.message });
            return;
        }

        res.status(500).json({ error: error.message });
    }
}