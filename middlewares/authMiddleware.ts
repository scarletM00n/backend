import { Request , Response , NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
    userId?: string;
    id?: string;
    role?: string;
}
export const authMiddleware = (roles :string[] = []) =>{
    return (req : Request & {user ?:JwtPayload} , res : Response , next : NextFunction) =>{
        const authHeader = req.headers.authorization ;
        if(!authHeader){
            res.status(401).json({
                msg : "No token provided"
            });
            return;
        }
        const [scheme, token] = authHeader.split(" ");
        if (scheme?.toLowerCase() !== "bearer" || !token) {
            res.status(401).json({
                msg : "Invalid authorization header"
            });
            return;
        }

        try{
            const payload = jwt.verify(token , process.env.JWT_SECRET!) as JwtPayload ;
            const resolvedUserId = payload.userId ?? payload.id;

            if (!resolvedUserId) {
                res.status(401).json({
                    msg : "Invalid token payload"
                });
                return;
            }

            req.user = {
                ...payload,
                userId: resolvedUserId,
            };

            // check role..
            if(roles.length && (!payload.role || !roles.includes(payload.role))){
                res.status(403).json({
                    msg : "Forbidden"
                });
                return;
            }
            next();
        }
        catch(err){
            res.status(401).json({
                msg : "Invalid token"
            });
        }
    }
}