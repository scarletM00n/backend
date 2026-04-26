import { Router } from "express";
import {
	postChatbotMessage,
	postChatbotMessageStream,
} from "../controllers/chatbot.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const chatbotRouter = Router();

chatbotRouter.post("/message", authMiddleware(), postChatbotMessage);
chatbotRouter.post("/message/stream", authMiddleware(), postChatbotMessageStream);

export default chatbotRouter;
