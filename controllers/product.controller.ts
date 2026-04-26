import { Prisma } from "@prisma/client";
import { Request , Response } from "express";
import multer from "multer";
import { ProductServiceError, product_services } from "../services/product.service";
import { toPublicUploadPath } from "../utils/uploadFile";

const productService = new product_services() ;

export const getProducts = async (req : Request , res : Response) => {

    try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const {brand_id, gender, fragrance_family, search, is_new_arrival, page, limit} = req.query ;

        let isNewArrival: boolean | undefined;
        if (typeof is_new_arrival === "string") {
            isNewArrival = is_new_arrival.toLowerCase() === "true";
        }

        const products = await productService.search_product({
            brand_id : brand_id as string ,
            gender : gender as string ,
            fragrance_family : fragrance_family as string ,
            is_new_arrival : isNewArrival,
            search : search as string ,
            page : parseInt(page as string) || 1 ,
            limit : parseInt(limit as string) || 10
        }, baseUrl);

       res.status(200).json(products) ;

    } 
    catch (error : any) {
        res.status(500).json({ error : error.message }) ;
    }
}

export const getProductById = async (req : any , res : Response) => {

    try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const  id : string = req.params.id ;

        const product = await productService.getProductByIdService(id , baseUrl) ;
        res.status(200).json(product) ;
    }
    catch (error : any) {
        res.status(500).json({ error : error.message }) ;
    }
}

// Admin only
export const createProduct = async (req : any , res : Response) => {

    try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const productData = req.body ;
        const product = await productService.createProductService(productData , baseUrl) ;
        res.status(201).json(product) ;
    }
    catch (error : any) {
        const message = (error?.message ?? "Failed to create product").toString();

        if (error instanceof ProductServiceError) {
            res.status(error.statusCode).json({ error: message });
            return;
        }

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
                res.status(409).json({ error: "A product with the same unique values already exists" });
                return;
            }

            if (error.code === "P2003") {
                res.status(400).json({ error: "Invalid relation reference in create payload" });
                return;
            }
        }

        if (error instanceof Prisma.PrismaClientValidationError) {
            res.status(400).json({ error: "Invalid create payload. Please check brand_id, gender, fragrance_family, and sizes." });
            return;
        }

        res.status(500).json({ error : message }) ;
    }
}

export const updateProduct = async (req : any , res : Response) => {

    try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const product_id = req.params.id ;
        const data = req.body ;
        const updatedProduct = await productService.updateProductService(product_id , data , baseUrl) ;
        res.status(200).json(updatedProduct) ;
    }
    catch (error : any) {
        res.status(500).json({ error : error.message }) ;
    }
}

export const uploadProductImageById = async (req: any, res: Response) => {
    try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const product_id = req.params.id;

        if (!req.file) {
            res.status(400).json({ error: "Product image is required" });
            return;
        }

        const image_url = toPublicUploadPath(req.file.path);
        const updatedProduct = await productService.updateProductImageService(product_id, image_url, baseUrl);
        res.status(200).json(updatedProduct);
    }
    catch (error: any) {
        if (error instanceof multer.MulterError) {
            const statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            res.status(statusCode).json({ error: error.message });
            return;
        }

        res.status(500).json({ error: error.message });
    }
}

export const addBrandLogoImage = async (req: any, res: Response) => {
    try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const brand_id = req.params.brand_id;

        if (!req.file) {
            res.status(400).json({ error: "Brand logo is required" });
            return;
        }

        const logo_url = toPublicUploadPath(req.file.path);
        const brand = await productService.updateBrandLogoService(brand_id, logo_url, baseUrl);
        res.status(200).json(brand);
    }
    catch (error: any) {
        if (error instanceof multer.MulterError) {
            const statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            res.status(statusCode).json({ error: error.message });
            return;
        }

        res.status(500).json({ error: error.message });
    }
}

export const deleteProduct = async (req : any , res : Response) => {

    try {
        const product_id = req.params.id ;
        await productService.deleteProductService(product_id) ;
        res.status(200).json({ message : "Product deleted successfully" }) ;
    }
    catch (error : any) {
        res.status(500).json({ error : error.message }) ;
    }
}

export const getProductReviews = async (req : any , res : Response) => {

    try {
        const product_id = req.params.id ;
        const reviews = await productService.getProductReviewsService(product_id) ;
        res.status(200).json(reviews) ;
    }
    catch (error : any) {
        res.status(500).json({ error : error.message }) ;
    }
}

export const addProductReview = async (req : any , res : Response) => {

    try {
        const product_id = req.params.id ;
        const user_id = req.user.userId ;
        const rating = Number(req.body.rating) ;
        const comment = typeof req.body.comment === "string" ? req.body.comment : undefined ;

        if(!Number.isInteger(rating) || rating < 1 || rating > 5){
            res.status(400).json({ error : "Rating must be between 1 and 5" }) ;
            return ;
        }

        const review = await productService.addProductReviewService(user_id , product_id , rating , comment) ;
        res.status(201).json(review) ;
    }
    catch (error : any) {
        const message = (error?.message ?? "").toString() ;
        const lower = message.toLowerCase() ;

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            res.status(409).json({ error : "You have already reviewed this product." }) ;
            return ;
        }

        if (lower.includes("purchased")) {
            res.status(403).json({ error : message }) ;
            return ;
        }

        if (lower.includes("rating")) {
            res.status(400).json({ error : message }) ;
            return ;
        }

        res.status(500).json({ error : message || "Failed to submit review" }) ;
    }
}