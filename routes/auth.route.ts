import { Router } from "express";
import { changePassword, getMe, getMyStats, Login, logout, register, removeAvatarImage, resendVerification, updateProfile, uploadAvatarImage, verifyEmail } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { uploadAvatar } from "../middlewares/uploadMiddleware";

const authRouter = Router() ;

authRouter.post('/register' , register);
authRouter.post('/login' , Login) ;
authRouter.post('/verify-email', verifyEmail);
authRouter.post('/resend-verification', resendVerification);
authRouter.post('/logout', authMiddleware(), logout);
authRouter.get('/me' , authMiddleware() ,getMe) ;
authRouter.get('/me/stats' , authMiddleware() ,getMyStats) ;
authRouter.patch('/update' , authMiddleware() , updateProfile);
authRouter.patch('/avatar' , authMiddleware() , uploadAvatar.single('avatar') , uploadAvatarImage);
authRouter.delete('/avatar' , authMiddleware() , removeAvatarImage);
authRouter.patch('/me/password' , authMiddleware() , changePassword);
authRouter.patch('/me/passward' , authMiddleware() , changePassword);

export default authRouter ;