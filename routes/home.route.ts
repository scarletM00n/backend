import { Router } from "express";
import { home } from "../controllers/home.controller";

const homeRouter = Router() ;

homeRouter.get('/' , home);

export default homeRouter ;