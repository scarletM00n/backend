import { Response } from "express";
import { chatbot_services } from "../services/chatbot.service";

const chatbotService = new chatbot_services();

export const postChatbotMessage = async (req: any, res: Response) => {
  try {
    const { message, language, history } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({
        msg: "Message cannot be empty",
      });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await chatbotService.chatForRecommendations(
      message,
      baseUrl,
      typeof language === "string" ? language : "en-US",
      history,
    );

    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({
      msg: err.message,
    });
  }
};

export const postChatbotMessageStream = async (req: any, res: Response) => {
  try {
    const { message, language, history } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({
        msg: "Message cannot be empty",
      });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    const sendEvent = (event: string, payload: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await chatbotService.streamChatForRecommendations(
      message,
      baseUrl,
      typeof language === "string" ? language : "en-US",
      history,
      (token) => {
        sendEvent("token", { token });
      },
    );

    sendEvent("meta", {
      recommendations: result.recommendations,
      reply: result.reply,
    });
    sendEvent("done", {});
    res.end();
  } catch (err: any) {
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ msg: err.message || "Stream failed" })}\n\n`);
    res.end();
  }
};
