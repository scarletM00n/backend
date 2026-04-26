import { Router } from "express";
import { addBrandLogoImage, addProductReview, createProduct, deleteProduct, getProductById, getProductReviews, getProducts, updateProduct, uploadProductImageById } from "../controllers/product.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { uploadBrandLogo, uploadProductImage } from "../middlewares/uploadMiddleware";

const productRouter = Router() ;

productRouter.get("/" , getProducts) ;
productRouter.get("/:id" , getProductById) ;
productRouter.get('/:id/reviews', getProductReviews);

productRouter.post('/:id/reviews' , authMiddleware() , addProductReview) ;

productRouter.post('/' , authMiddleware(["admin"]) , createProduct) ;
productRouter.patch('/brands/:brand_id/logo' , authMiddleware(["admin"]) , uploadBrandLogo.single('logo') , addBrandLogoImage) ;
productRouter.patch('/:id/image' , authMiddleware(["admin"]) , uploadProductImage.single('image') , uploadProductImageById) ;
productRouter.patch('/:id' , authMiddleware(["admin"]) , updateProduct) ;
productRouter.delete('/:id' , authMiddleware(["admin"]) , deleteProduct) ;

export default productRouter ;