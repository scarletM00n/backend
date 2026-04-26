import { Router } from "express";
import {
  getDiscoverData,
  searchBrands,
  filterProducts,
  getBrandDetails,
  getPopularHouses,
} from "../controllers/discover.controller";

const discoverRouter = Router();

discoverRouter.get("/", getDiscoverData);
discoverRouter.get("/search", searchBrands);
discoverRouter.get("/filter", filterProducts);
discoverRouter.get("/popular-houses", getPopularHouses);
discoverRouter.get("/brand/:brandId", getBrandDetails);

export default discoverRouter;