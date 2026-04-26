import { prisma } from "../model/prisma";
import { toAbsoluteUploadUrl } from "../utils/uploadFile";

type ChatbotRecommendation = {
  id: string;
  name: string;
  brand_name: string;
  image_url: string;
  price: number;
  fragrance_family: string;
  gender: string;
};

type ChatbotGroqSuggestion = {
  reply: string;
  recommendation_ids: string[];
};

type ChatbotHistoryTurn = {
  role: "user" | "assistant";
  text: string;
};

type ChatMode = "shopping" | "general";

export class chatbot_services {
  constructor() {}

  private static readonly HISTORY_TURNS_LIMIT = 6;
  private static readonly HISTORY_TEXT_LIMIT = 220;
  private static readonly STREAM_DELAY_MS = 4;

  private isArabicLocale(locale: string): boolean {
    return locale.toLowerCase().startsWith("ar");
  }

  private readonly searchStopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "for",
    "from",
    "give",
    "have",
    "hello",
    "hey",
    "i",
    "im",
    "in",
    "is",
    "it",
    "like",
    "looking",
    "me",
    "need",
    "of",
    "on",
    "perfume",
    "please",
    "recommend",
    "some",
    "something",
    "scent",
    "that",
    "the",
    "to",
    "want",
    "with",
  ]);

  private wait(ms: number): Promise<void> {
    const boundedDelay = Math.min(ms, chatbot_services.STREAM_DELAY_MS);
    return new Promise((resolve) => setTimeout(resolve, boundedDelay));
  }

  private isOllamaEnabled(): boolean {
    return Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL);
  }

  private isHuggingFaceEnabled(): boolean {
    return Boolean(process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY);
  }

  private isGroqEnabled(): boolean {
    return Boolean(process.env.GROQ_API_KEY);
  }

  private getOllamaConfig() {
    return {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      model: process.env.OLLAMA_MODEL || "llama3.1:8b",
    };
  }

  private getHuggingFaceConfig() {
    return {
      apiKey: process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || "",
      model:
        process.env.HUGGINGFACE_MODEL ||
        process.env.HF_MODEL ||
        "mistralai/Mistral-7B-Instruct-v0.2",
    };
  }

  private getGroqConfig() {
    return {
      apiKey: process.env.GROQ_API_KEY || "",
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    };
  }

  private buildAssistantPrompt(params: {
    userMessage: string;
    conversationContext: string;
    recommendations: ChatbotRecommendation[];
    budget: number | null;
    locale: string;
  }): string {
    const isArabic = this.isArabicLocale(params.locale);
    const budgetLine = params.budget ? `Budget: $${params.budget.toFixed(0)} or less.` : "Budget: not specified.";
    const recommendationsText = params.recommendations
      .map(
        (item, index) =>
          `${index + 1}. id=${item.id} name=${item.name} brand=${item.brand_name} price=$${item.price.toFixed(2)} family=${item.fragrance_family} gender=${item.gender}`,
      )
      .join("\n");

    return [
      budgetLine,
      `Customer message: ${params.userMessage}`,
      params.conversationContext
        ? `Recent conversation context: ${params.conversationContext}`
        : "Recent conversation context: none",
      "Choose only from the recommendation ids below.",
      "Return JSON only in this exact shape: {\"reply\": string, \"recommendation_ids\": string[] }",
      isArabic
        ? "Reply in Modern Standard Arabic. Keep the JSON structure exactly the same, and keep recommendation ids unchanged."
        : "Reply in English. Keep the JSON structure exactly the same, and keep recommendation ids unchanged.",
      "Keep reply short, honest, and helpful.",
      "If none fit, set recommendation_ids to [] and explain the closest options.",
      "Recommendations:",
      recommendationsText,
    ].join("\n");
  }

  private parseGroqSuggestion(rawText: string): ChatbotGroqSuggestion | null {
    const trimmed = rawText.trim();
    const directCandidates = [trimmed, trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")];

    for (const candidate of directCandidates) {
      try {
        const parsed = JSON.parse(candidate) as Partial<ChatbotGroqSuggestion>;
        if (typeof parsed.reply === "string" && Array.isArray(parsed.recommendation_ids)) {
          return {
            reply: parsed.reply,
            recommendation_ids: parsed.recommendation_ids.filter((item) => typeof item === "string"),
          };
        }
      } catch (_) {
        continue;
      }
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Partial<ChatbotGroqSuggestion>;
      if (typeof parsed.reply === "string" && Array.isArray(parsed.recommendation_ids)) {
        return {
          reply: parsed.reply,
          recommendation_ids: parsed.recommendation_ids.filter((item) => typeof item === "string"),
        };
      }
    } catch (_) {
      return null;
    }

    return null;
  }

  private prioritizeRecommendations(
    recommendations: ChatbotRecommendation[],
    recommendationIds: string[],
  ): ChatbotRecommendation[] {
    if (recommendationIds.length === 0) {
      return recommendations;
    }

    const selected = new Map(recommendationIds.map((id, index) => [id, index]));
    return [...recommendations].sort((left, right) => {
      const leftIndex = selected.has(left.id) ? (selected.get(left.id) as number) : Number.POSITIVE_INFINITY;
      const rightIndex = selected.has(right.id) ? (selected.get(right.id) as number) : Number.POSITIVE_INFINITY;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return left.price - right.price;
    });
  }

  private sanitizeHistory(history: unknown): ChatbotHistoryTurn[] {
    if (!Array.isArray(history)) return [];

    return history
      .filter((item): item is { role?: unknown; text?: unknown } => Boolean(item && typeof item === "object"))
      .map((item): ChatbotHistoryTurn => {
        const role: ChatbotHistoryTurn["role"] = item.role === "assistant" ? "assistant" : "user";
        const text = typeof item.text === "string" ? item.text.trim() : "";
        return {
          role,
          text: text.slice(0, chatbot_services.HISTORY_TEXT_LIMIT),
        };
      })
      .filter((item) => item.text.length > 0)
      .slice(-chatbot_services.HISTORY_TURNS_LIMIT);
  }

  private buildConversationContext(history: ChatbotHistoryTurn[]): string {
    if (history.length === 0) return "";

    return history
      .map((turn) => {
        const compactText = turn.role === "assistant"
          ? turn.text.split("\n")[0].slice(0, 120)
          : turn.text;
        return `${turn.role === "user" ? "User" : "Assistant"}: ${compactText}`;
      })
      .join(" | ");
  }

  private buildIntentText(message: string, history: ChatbotHistoryTurn[]): string {
    const userTurns = history
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text)
      .filter((text) => text.length > 0)
      .slice(-4);

    return [...userTurns, message].join(" ").trim();
  }

  private detectChatMode(message: string, history: ChatbotHistoryTurn[]): ChatMode {
    const text = this.buildIntentText(message, history).toLowerCase();

    const shoppingSignals = [
      "perfume",
      "fragrance",
      "scent",
      "buy",
      "budget",
      "price",
      "brand",
      "family",
      "woody",
      "fresh",
      "floral",
      "oriental",
      "citrus",
      "musk",
      "cart",
      "order",
      "recommend",
      "gift",
      "عطر",
      "عطور",
      "ميزانية",
      "سعر",
      "شراء",
      "ترشيح",
      "هدية",
    ];

    for (const signal of shoppingSignals) {
      if (text.includes(signal)) return "shopping";
    }

    return "general";
  }

  private buildGeneralFallbackReply(locale: string): string {
    if (this.isArabicLocale(locale)) {
      return "أكيد. أقدر أساعدك مثل مساعد ذكي في النقاش، الشرح، وتنظيم أفكارك. قل لي ما الموضوع الذي تريد أن نبدأ به؟";
    }
    return "Absolutely. I can help like a smart assistant for discussion, explanations, and planning. Tell me what you want to talk about first.";
  }

  private buildGeneralHeuristicReply(params: {
    message: string;
    history: ChatbotHistoryTurn[];
    locale: string;
  }): string {
    const text = params.message.trim();
    const lower = text.toLowerCase();
    const recentUser = params.history
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text)
      .slice(-2)
      .join(" ");

    if (this.isArabicLocale(params.locale)) {
      if (/^(مرحبا|اهلا|السلام|هاي)/i.test(text)) {
        return "أهلًا! أنا معك. قل لي هدفك الآن، وسأعطيك خطوات واضحة وسريعة.";
      }

      if (/(مين انت|من انت|ماذا تستطيع|شو تسوي|what can you do)/i.test(lower)) {
        return "أنا مساعد ذكي للمحادثة والقرارات. أقدر أشرح لك أي فكرة، أرتب خطة خطوة بخطوة، وأعطيك مقارنة واضحة بين الخيارات.";
      }

      if (text.endsWith("?") || /(كيف|ليش|لماذا|وش|ما هو|ماهي)/i.test(text)) {
        return `سؤال ممتاز. بناءً على كلامك${recentUser.length > 0 ? ` (${recentUser.slice(0, 80)})` : ""}، أفضل طريقة هي:\n1) نحدد الهدف بدقة.\n2) نختار أسرع خطوة عملية اليوم.\n3) نراجع النتيجة ونحسنها.\n\nإذا تريد، أعطني تفاصيل أكثر وسأعطيك جواب أدق.`;
      }

      return "فهمت عليك. خلّينا نحول كلامك لخطة بسيطة: الهدف، أفضل خطوة الآن، وما الذي تريده مني بالضبط في الرد القادم.";
    }

    if (/^(hi|hello|hey|yo)\b/i.test(lower)) {
      return "Hey, I am here with you. Tell me your goal and I will give you a clear next-step answer.";
    }

    if (/(who are you|what can you do)/i.test(lower)) {
      return "I am your smart assistant for conversation and decisions. I can explain topics, break problems into steps, and help you choose between options.";
    }

    if (text.endsWith("?") || /(how|why|what|should|could|help)/i.test(lower)) {
      return `Great question. Based on what you said${recentUser.length > 0 ? ` (${recentUser.slice(0, 80)})` : ""}, the best approach is:\n1) Clarify the exact outcome.\n2) Take the fastest practical action now.\n3) Review and iterate.\n\nIf you share one more detail, I will give you a sharper answer.`;
    }

    return "I understand. Let us turn this into a simple plan: your goal, the best immediate step, and what outcome you want from my next reply.";
  }

  private rankRecommendations(params: {
    recommendations: ChatbotRecommendation[];
    budget: number | null;
    family: string | null;
    gender: string | null;
    terms: string[];
  }): ChatbotRecommendation[] {
    const scoreOf = (item: ChatbotRecommendation): number => {
      let score = 0;

      if (params.budget) {
        if (item.price <= params.budget) {
          const gap = params.budget - item.price;
          const closeness = Math.max(0, 1 - gap / Math.max(1, params.budget));
          score += 40 + closeness * 20;
        } else {
          const over = item.price - params.budget;
          score -= Math.min(28, over * 0.25);
        }
      }

      if (params.family && item.fragrance_family === params.family) {
        score += 18;
      }

      if (params.gender) {
        if (item.gender === params.gender) {
          score += 12;
        } else if (item.gender === "unisex") {
          score += 5;
        } else {
          score -= 6;
        }
      }

      const loweredName = item.name.toLowerCase();
      const loweredBrand = item.brand_name.toLowerCase();
      for (const term of params.terms) {
        if (loweredName.includes(term)) score += 9;
        if (loweredBrand.includes(term)) score += 6;
      }

      return score;
    };

    return [...params.recommendations].sort((left, right) => {
      const delta = scoreOf(right) - scoreOf(left);
      if (delta !== 0) return delta;
      return left.price - right.price;
    });
  }

  private async maybeGenerateGroqReply(params: {
    userMessage: string;
    conversationContext: string;
    recommendations: ChatbotRecommendation[];
    budget: number | null;
    fallbackReply: string;
    locale: string;
  }): Promise<string> {
    if (!this.isGroqEnabled()) {
      return params.fallbackReply;
    }

    const { apiKey, model } = this.getGroqConfig();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          messages: [
            {
              role: "system",
              content:
                this.isArabicLocale(params.locale)
                  ? "You are Scentra shopping assistant. Use only the provided recommendations. Return JSON only. Do not invent products. Pick the best matching recommendation ids and write a short, honest reply in Modern Standard Arabic. If the user asks for a budget that has no results, say that directly and recommend the closest in-stock options."
                  : "You are Scentra shopping assistant. Use only the provided recommendations. Return JSON only. Do not invent products. Pick the best matching recommendation ids and write a short, honest reply. If the user asks for a budget that has no results, say that directly and recommend the closest in-stock options.",
            },
            { role: "user", content: this.buildAssistantPrompt(params) },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return params.fallbackReply;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return params.fallbackReply;
      }

      const parsed = this.parseGroqSuggestion(content);
      if (!parsed) {
        return params.fallbackReply;
      }

      return parsed.reply && parsed.reply.length > 0 ? parsed.reply : params.fallbackReply;
    } catch (_) {
      return params.fallbackReply;
    }
  }

  private async maybeGenerateGroqGeneralReply(params: {
    userMessage: string;
    conversationContext: string;
    locale: string;
    fallbackReply: string;
  }): Promise<string> {
    if (!this.isGroqEnabled()) {
      return params.fallbackReply;
    }

    const { apiKey, model } = this.getGroqConfig();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content: this.isArabicLocale(params.locale)
                ? "أنت مساعد ذكي ودقيق وودود مثل ChatGPT/Gemini. أجب بشكل طبيعي ومفيد، واطرح سؤال متابعة واحدًا عند الحاجة."
                : "You are a smart, accurate, friendly assistant like ChatGPT/Gemini. Reply naturally and helpfully, and ask one concise follow-up question when useful.",
            },
            {
              role: "user",
              content: [
                params.conversationContext
                  ? `Recent conversation context: ${params.conversationContext}`
                  : "Recent conversation context: none",
                `User message: ${params.userMessage}`,
              ].join("\n"),
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return params.fallbackReply;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = payload.choices?.[0]?.message?.content?.trim();
      return content && content.length > 0 ? content : params.fallbackReply;
    } catch (_) {
      return params.fallbackReply;
    }
  }

  private async maybeGenerateGroqGeneralReplyStream(params: {
    userMessage: string;
    conversationContext: string;
    locale: string;
    fallbackReply: string;
    onToken: (token: string) => void;
  }): Promise<string> {
    const fullReply = await this.maybeGenerateGroqGeneralReply({
      userMessage: params.userMessage,
      conversationContext: params.conversationContext,
      locale: params.locale,
      fallbackReply: params.fallbackReply,
    });

    const words = fullReply.split(/(\s+)/).filter((part) => part.length > 0);
    for (const part of words) {
      params.onToken(part);
      await this.wait(4);
    }

    return fullReply;
  }

  private async maybeGenerateOpenAiReply(params: {
    userMessage: string;
    recommendations: ChatbotRecommendation[];
    fallbackReply: string;
    locale: string;
  }): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return params.fallbackReply;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.6,
          messages: [
            {
              role: "system",
              content:
                this.isArabicLocale(params.locale)
                  ? "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly, and write in Modern Standard Arabic. Use only the provided recommendation list and avoid making up unavailable products."
                  : "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly. Use only the provided recommendation list and avoid making up unavailable products.",
            },
            {
              role: "user",
              content: `Customer message: ${params.userMessage}\n\nAvailable recommendations:\n${JSON.stringify(
                params.recommendations,
              )}`,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return params.fallbackReply;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return params.fallbackReply;
      }

      return content;
    } catch (_) {
      return params.fallbackReply;
    }
  }

  private async maybeGenerateHuggingFaceReply(params: {
    userMessage: string;
    recommendations: ChatbotRecommendation[];
    fallbackReply: string;
    locale: string;
  }): Promise<string> {
    if (!this.isHuggingFaceEnabled()) {
      return params.fallbackReply;
    }

    const { apiKey, model } = this.getHuggingFaceConfig();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        "https://api-inference.huggingface.co/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.6,
            max_tokens: 280,
            messages: [
              {
                role: "system",
                content:
                  this.isArabicLocale(params.locale)
                    ? "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly, and write in Modern Standard Arabic. Use only provided recommendations and avoid inventing unavailable products."
                    : "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly. Use only provided recommendations and avoid inventing unavailable products.",
              },
              {
                role: "user",
                content: `Customer message: ${params.userMessage}\n\nAvailable recommendations:\n${JSON.stringify(
                  params.recommendations,
                )}`,
              },
            ],
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (!response.ok) {
        return params.fallbackReply;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = payload.choices?.[0]?.message?.content?.trim();
      return content && content.length > 0 ? content : params.fallbackReply;
    } catch (_) {
      return params.fallbackReply;
    }
  }

  private async maybeGenerateOllamaReply(params: {
    userMessage: string;
    recommendations: ChatbotRecommendation[];
    fallbackReply: string;
    locale: string;
  }): Promise<string> {
    if (!this.isOllamaEnabled()) {
      return params.fallbackReply;
    }

    const { baseUrl, model } = this.getOllamaConfig();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          stream: false,
          prompt:
            (this.isArabicLocale(params.locale)
              ? "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly, and write in Modern Standard Arabic. Use only the provided recommendation list and avoid making up unavailable products.\n\n"
              : "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly. Use only the provided recommendation list and avoid making up unavailable products.\n\n") +
            `Customer message: ${params.userMessage}\n\nAvailable recommendations:\n${JSON.stringify(
              params.recommendations,
            )}`,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return params.fallbackReply;
      }

      const payload = (await response.json()) as { response?: string };
      const content = payload.response?.trim();
      return content && content.length > 0 ? content : params.fallbackReply;
    } catch (_) {
      return params.fallbackReply;
    }
  }

  private async maybeGenerateOpenAiReplyStream(params: {
    userMessage: string;
    recommendations: ChatbotRecommendation[];
    fallbackReply: string;
    onToken: (token: string) => void;
    locale: string;
  }): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const words = params.fallbackReply.split(/(\s+)/).filter((part) => part.length > 0);
      for (const part of words) {
        params.onToken(part);
        await this.wait(16);
      }
      return params.fallbackReply;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.6,
          stream: true,
          messages: [
            {
              role: "system",
              content:
                this.isArabicLocale(params.locale)
                  ? "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly, and write in Modern Standard Arabic. Use only the provided recommendation list and avoid making up unavailable products."
                  : "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly. Use only the provided recommendation list and avoid making up unavailable products.",
            },
            {
              role: "user",
              content: `Customer message: ${params.userMessage}\n\nAvailable recommendations:\n${JSON.stringify(
                params.recommendations,
              )}`,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        clearTimeout(timeout);
        const words = params.fallbackReply
          .split(/(\s+)/)
          .filter((part) => part.length > 0);
        for (const part of words) {
          params.onToken(part);
          await this.wait(16);
        }
        return params.fallbackReply;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";
      let fullReply = "";

      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !done });

        let separatorIndex = buffer.indexOf("\n\n");
        while (separatorIndex !== -1) {
          const eventBlock = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);

          const lines = eventBlock
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("data:"));

          for (const line of lines) {
            const dataRaw = line.replace(/^data:\s*/, "");
            if (dataRaw === "[DONE]") {
              done = true;
              break;
            }

            try {
              const parsed = JSON.parse(dataRaw) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) {
                fullReply += token;
                params.onToken(token);
              }
            } catch (_) {
              continue;
            }
          }

          separatorIndex = buffer.indexOf("\n\n");
        }
      }

      clearTimeout(timeout);

      if (!fullReply.trim()) {
        return params.fallbackReply;
      }

      return fullReply;
    } catch (_) {
      const words = params.fallbackReply.split(/(\s+)/).filter((part) => part.length > 0);
      for (const part of words) {
        params.onToken(part);
        await this.wait(16);
      }
      return params.fallbackReply;
    }
  }

  private async maybeGenerateHuggingFaceReplyStream(params: {
    userMessage: string;
    recommendations: ChatbotRecommendation[];
    fallbackReply: string;
    onToken: (token: string) => void;
    locale: string;
  }): Promise<string> {
    const fullReply = await this.maybeGenerateHuggingFaceReply({
      userMessage: params.userMessage,
      recommendations: params.recommendations,
      fallbackReply: params.fallbackReply,
      locale: params.locale,
    });

    const words = fullReply.split(/(\s+)/).filter((part) => part.length > 0);
    for (const part of words) {
      params.onToken(part);
      await this.wait(16);
    }

    return fullReply;
  }

  private async maybeGenerateGroqReplyStream(params: {
    userMessage: string;
    conversationContext: string;
    recommendations: ChatbotRecommendation[];
    budget: number | null;
    fallbackReply: string;
    onToken: (token: string) => void;
    locale: string;
  }): Promise<string> {
    if (!this.isGroqEnabled()) {
      const words = params.fallbackReply.split(/(\s+)/).filter((part) => part.length > 0);
      for (const part of words) {
        params.onToken(part);
        await this.wait(16);
      }
      return params.fallbackReply;
    }

    const { apiKey, model } = this.getGroqConfig();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 22000);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          stream: false,
          messages: [
            {
              role: "system",
              content:
                this.isArabicLocale(params.locale)
                  ? "You are Scentra shopping assistant. Use only the provided recommendations. Return JSON only. Do not invent products. Pick the best matching recommendation ids and write a short, honest reply in Modern Standard Arabic. If the user asks for a budget that has no results, say that directly and recommend the closest in-stock options."
                  : "You are Scentra shopping assistant. Use only the provided recommendations. Return JSON only. Do not invent products. Pick the best matching recommendation ids and write a short, honest reply. If the user asks for a budget that has no results, say that directly and recommend the closest in-stock options.",
            },
            { role: "user", content: this.buildAssistantPrompt(params) },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeout);
        const words = params.fallbackReply
          .split(/(\s+)/)
          .filter((part) => part.length > 0);
        for (const part of words) {
          params.onToken(part);
          await this.wait(16);
        }
        return params.fallbackReply;
      }

      clearTimeout(timeout);

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return params.fallbackReply;
      }

      const parsed = this.parseGroqSuggestion(content);
      if (!parsed) {
        const words = params.fallbackReply.split(/(\s+)/).filter((part) => part.length > 0);
        for (const part of words) {
          params.onToken(part);
          await this.wait(16);
        }
        return params.fallbackReply;
      }

      const selectedRecommendations = this.prioritizeRecommendations(
        params.recommendations,
        parsed.recommendation_ids,
      );

      const enrichedReply = parsed.reply.trim();
      const finalReply = selectedRecommendations.length > 0
        ? `${enrichedReply}\n\n${this.isArabicLocale(params.locale) ? "أفضل الترشيحات" : "Top picks"}: ${selectedRecommendations
            .slice(0, 3)
            .map((item) => `${item.name} ($${item.price.toFixed(2)})`)
            .join(", ")}`
        : enrichedReply;

      const words = finalReply.split(/(\s+)/).filter((part) => part.length > 0);
      for (const part of words) {
        params.onToken(part);
        await this.wait(16);
      }

      return finalReply;
    } catch (_) {
      const words = params.fallbackReply.split(/(\s+)/).filter((part) => part.length > 0);
      for (const part of words) {
        params.onToken(part);
        await this.wait(16);
      }
      return params.fallbackReply;
    }
  }

  private async maybeGenerateOllamaReplyStream(params: {
    userMessage: string;
    recommendations: ChatbotRecommendation[];
    fallbackReply: string;
    onToken: (token: string) => void;
    locale: string;
  }): Promise<string> {
    if (!this.isOllamaEnabled()) {
      const words = params.fallbackReply.split(/(\s+)/).filter((part) => part.length > 0);
      for (const part of words) {
        params.onToken(part);
        await this.wait(16);
      }
      return params.fallbackReply;
    }

    const { baseUrl, model } = this.getOllamaConfig();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          stream: true,
          prompt:
            (this.isArabicLocale(params.locale)
              ? "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly, and write in Modern Standard Arabic. Use only the provided recommendation list and avoid making up unavailable products.\n\n"
              : "You are Scentra shopping assistant. Help customer choose perfume to buy now. Keep replies concise, practical, friendly. Use only the provided recommendation list and avoid making up unavailable products.\n\n") +
            `Customer message: ${params.userMessage}\n\nAvailable recommendations:\n${JSON.stringify(
              params.recommendations,
            )}`,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        clearTimeout(timeout);
        const words = params.fallbackReply
          .split(/(\s+)/)
          .filter((part) => part.length > 0);
        for (const part of words) {
          params.onToken(part);
          await this.wait(16);
        }
        return params.fallbackReply;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullReply = "";
      let done = false;

      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !done });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line.length > 0) {
            try {
              const parsed = JSON.parse(line) as {
                response?: string;
                done?: boolean;
              };
              const token = parsed.response;
              if (token) {
                fullReply += token;
                params.onToken(token);
              }
              if (parsed.done) {
                done = true;
              }
            } catch (_) {
              continue;
            }
          }

          newlineIndex = buffer.indexOf("\n");
        }
      }

      clearTimeout(timeout);

      if (!fullReply.trim()) {
        return params.fallbackReply;
      }
      return fullReply;
    } catch (_) {
      const words = params.fallbackReply.split(/(\s+)/).filter((part) => part.length > 0);
      for (const part of words) {
        params.onToken(part);
        await this.wait(16);
      }
      return params.fallbackReply;
    }
  }

  private extractBudget(message: string): number | null {
    const match = message.match(/(?:\$|under\s+|below\s+|budget\s+)(\d+(?:\.\d+)?)/i);
    if (!match) {
      const fallback = message.match(/\b(\d{2,4}(?:\.\d+)?)\b/);
      if (!fallback) return null;
      return Number(fallback[1]);
    }

    return Number(match[1]);
  }

  private extractFamily(message: string): string | null {
    const families = [
      "floral",
      "woody",
      "oriental",
      "fresh",
      "citrus",
      "aquatic",
      "amber",
      "spicy",
      "fruity",
      "vanilla",
      "musk",
    ];
    const lower = message.toLowerCase();
    return families.find((family) => lower.includes(family)) ?? null;
  }

  private extractGender(message: string): string | null {
    const lower = message.toLowerCase();
    if (lower.includes("women") || lower.includes("female") || lower.includes("lady")) {
      return "female";
    }
    if (lower.includes("men") || lower.includes("male") || lower.includes("man")) {
      return "male";
    }
    if (lower.includes("unisex")) {
      return "unisex";
    }
    return null;
  }

  private extractSearchTerms(message: string): string[] {
    const normalized = message
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return [];

    return normalized
      .split(" ")
      .filter((term) => term.length >= 3 && !this.searchStopWords.has(term))
      .slice(0, 5);
  }

  private async queryRecommendations(params: {
    where: any;
    baseUrl: string;
    budget?: number;
  }): Promise<ChatbotRecommendation[]> {
    const products = await prisma.product.findMany({
      where: params.where,
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        sizes: {
          where: {
            stock: {
              gt: 0,
            },
            ...(params.budget ? { price: { lte: params.budget } } : {}),
          },
          orderBy: {
            price: "asc",
          },
          take: 1,
        },
      },
      orderBy: [
        {
          is_featured: "desc",
        },
        {
          is_new_arrival: "desc",
        },
        {
          created_at: "desc",
        },
      ],
      take: 16,
    });

    return products
      .filter((product) => product.sizes.length > 0)
      .map((product) => ({
        id: product.id,
        name: product.name,
        brand_name: product.brand.name,
        image_url: toAbsoluteUploadUrl(params.baseUrl, product.image_url),
        price: Number(product.sizes[0].price),
        fragrance_family: product.fragrance_family,
        gender: product.gender,
      }));
  }

  private applyBudgetTruthGuard(params: {
    reply: string;
    budget: number | null;
    recommendations: ChatbotRecommendation[];
    locale: string;
  }): string {
    const { reply, budget, recommendations } = params;
    if (!budget || recommendations.length === 0) {
      return reply;
    }

    const hasWithinBudget = recommendations.some((item) => item.price <= budget);
    if (hasWithinBudget) {
      return reply;
    }

    const correction = this.isArabicLocale(params.locale)
      ? `\n\nملاحظة الميزانية: لم أجد خيارات متوفرة بسعر أقل من $${budget.toFixed(
          0,
        )}، لذلك هذه هي أقرب الخيارات المتاحة فوق ميزانيتك.`
      : `\n\nBudget note: I could not find in-stock options under $${budget.toFixed(
          0,
        )}, so these are the closest available options above your budget.`;

    return reply.includes("Budget note:") ? reply : `${reply.trim()}${correction}`;
  }

  private shouldBypassAiForBudget(params: {
    budget: number | null;
    recommendations: ChatbotRecommendation[];
  }): boolean {
    const { budget, recommendations } = params;
    if (!budget || recommendations.length === 0) {
      return false;
    }
    return !recommendations.some((item) => item.price <= budget);
  }

  private async buildRecommendationContext(
    message: string,
    baseUrl = "",
    locale = "en-US",
    history: ChatbotHistoryTurn[] = [],
  ) {
    const useArabic = this.isArabicLocale(locale);
    const intentText = this.buildIntentText(message, history);
    const budget = this.extractBudget(intentText);
    const family = this.extractFamily(intentText);
    const gender = this.extractGender(intentText);
    const terms = this.extractSearchTerms(intentText);

    const where: any = {
      sizes: {
        some: {
          stock: {
            gt: 0,
          },
        },
      },
    };

    if (family) {
      where.fragrance_family = family;
    }

    if (gender) {
      where.gender = gender;
    }

    const textAnd = terms.map((term) => ({
      OR: [
        {
          name: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          story: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          brand: {
            name: {
              contains: term,
              mode: "insensitive",
            },
          },
        },
      ],
    }));

    const whereCandidates: any[] = [];

    if (textAnd.length > 0) {
      whereCandidates.push({
        ...where,
        AND: textAnd,
      });
    }

    whereCandidates.push(where);

    if (family || gender) {
      whereCandidates.push({
        sizes: {
          some: {
            stock: {
              gt: 0,
            },
          },
        },
      });
    }

    let recommendations: ChatbotRecommendation[] = [];
    let ignoredBudget = false;

    for (const candidate of whereCandidates) {
      recommendations = await this.queryRecommendations({
        where: candidate,
        baseUrl,
        budget: budget || undefined,
      });
      if (recommendations.length > 0) {
        break;
      }
    }

    if (recommendations.length === 0 && budget) {
      for (const candidate of whereCandidates) {
        recommendations = await this.queryRecommendations({
          where: candidate,
          baseUrl,
        });
        if (recommendations.length > 0) {
          ignoredBudget = true;
          break;
        }
      }
    }

    recommendations = this.rankRecommendations({
      recommendations,
      budget,
      family,
      gender,
      terms,
    }).slice(0, 6);

    const filters = [
      budget && !ignoredBudget ? `budget <= $${budget.toFixed(0)}` : null,
      family ? `family: ${family}` : null,
      gender ? `gender: ${gender}` : null,
    ].filter((item): item is string => Boolean(item));

    if (recommendations.length === 0) {
      return {
        recommendations,
        budget,
        fallbackReply:
          useArabic
            ? "لم أجد تطابقات دقيقة الآن. جرّب تغيير ميزانيتك أو عائلة العطر، مثل: عطر منعش تحت 80."
            : "I couldn't find exact matches right now. Try changing your budget or fragrance family, for example: 'fresh perfume under 80'.",
      };
    }

    const intro = useArabic
      ? ignoredBudget
        ? `لم أجد منتجات متوفرة بسعر أقل من ميزانيتك، لذلك وجدت ${recommendations.length} خيارات قريبة.`
        : filters.length > 0
        ? `اختيار رائع. وجدت ${recommendations.length} خيارات لـ ${filters.join(", ")}.`
        : `اختيار رائع. وجدت ${recommendations.length} عطور يمكنك شراؤها الآن.`
      : ignoredBudget
      ? `I could not find in-stock products under your budget, so I found ${recommendations.length} close options.`
      : filters.length > 0
      ? `Great choice. I found ${recommendations.length} options for ${filters.join(", ")}.`
      : `Great choice. I found ${recommendations.length} perfumes you can buy now.`;

    const picks = recommendations
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} by ${item.brand_name} - $${item.price.toFixed(2)}`,
      )
      .join("\n");

    return {
      recommendations,
      budget,
      fallbackReply:
        useArabic
          ? `${intro}\n${picks}\nأخبرني بميزانيتك أو عائلة العطر (منعش / زهري / خشبي ...) أو لمن العطر وسأضيق الخيارات.`
          : `${intro}\n${picks}\nTell me your budget, family (fresh/floral/woody/etc.), or who the perfume is for and I will refine it.`,
    };
  }

  async chatForRecommendations(
    message: string,
    baseUrl = "",
    locale = "en-US",
    history: unknown = [],
  ) {
    const safeHistory = this.sanitizeHistory(history);
    const conversationContext = this.buildConversationContext(safeHistory);
    const mode = this.detectChatMode(message, safeHistory);

    if (mode === "general") {
      const fallbackReply = this.buildGeneralHeuristicReply({
        message,
        history: safeHistory,
        locale,
      });
      const reply = await this.maybeGenerateGroqGeneralReply({
        userMessage: message,
        conversationContext,
        locale,
        fallbackReply,
      });

      return {
        reply,
        recommendations: [],
      };
    }

    const { recommendations, fallbackReply, budget } = await this.buildRecommendationContext(
      message,
      baseUrl,
      locale,
      safeHistory,
    );

    const shouldBypassAi = this.shouldBypassAiForBudget({ budget, recommendations });

    const rawReply = shouldBypassAi
      ? fallbackReply
      : this.isGroqEnabled()
      ? await this.maybeGenerateGroqReply({
          userMessage: message,
          conversationContext,
          recommendations,
          budget,
          fallbackReply,
          locale,
        })
      : this.isHuggingFaceEnabled()
      ? await this.maybeGenerateHuggingFaceReply({
          userMessage: message,
          recommendations,
          fallbackReply,
          locale,
        })
      : this.isOllamaEnabled()
      ? await this.maybeGenerateOllamaReply({
          userMessage: message,
          recommendations,
          fallbackReply,
          locale,
        })
      : await this.maybeGenerateOpenAiReply({
          userMessage: message,
          recommendations,
          fallbackReply,
          locale,
        });

    const reply = this.applyBudgetTruthGuard({
      reply: rawReply,
      budget,
      recommendations,
      locale,
    });

    return {
      reply,
      recommendations,
    };
  }

  async streamChatForRecommendations(
    message: string,
    baseUrl: string,
    locale: string,
    history: unknown,
    onToken: (token: string) => void,
  ) {
    const safeHistory = this.sanitizeHistory(history);
    const conversationContext = this.buildConversationContext(safeHistory);
    const mode = this.detectChatMode(message, safeHistory);

    if (mode === "general") {
      const fallbackReply = this.buildGeneralHeuristicReply({
        message,
        history: safeHistory,
        locale,
      });
      const reply = await this.maybeGenerateGroqGeneralReplyStream({
        userMessage: message,
        conversationContext,
        locale,
        fallbackReply,
        onToken,
      });

      return {
        reply,
        recommendations: [],
      };
    }

    const { recommendations, fallbackReply, budget } = await this.buildRecommendationContext(
      message,
      baseUrl,
      locale,
      safeHistory,
    );

    const shouldBypassAi = this.shouldBypassAiForBudget({ budget, recommendations });

    const rawReply = shouldBypassAi
      ? (() => {
          return fallbackReply;
        })()
      : this.isGroqEnabled()
      ? await this.maybeGenerateGroqReplyStream({
          userMessage: message,
          conversationContext,
          recommendations,
          budget,
          fallbackReply,
          onToken,
          locale,
        })
      : this.isHuggingFaceEnabled()
      ? await this.maybeGenerateHuggingFaceReplyStream({
          userMessage: message,
          recommendations,
          fallbackReply,
          onToken,
          locale,
        })
      : this.isOllamaEnabled()
      ? await this.maybeGenerateOllamaReplyStream({
          userMessage: message,
          recommendations,
          fallbackReply,
          onToken,
          locale,
        })
      : await this.maybeGenerateOpenAiReplyStream({
          userMessage: message,
          recommendations,
          fallbackReply,
          onToken,
          locale,
        });

    if (shouldBypassAi) {
      const chunks = fallbackReply.split(/(\s+)/).filter((part) => part.length > 0);
      for (const chunk of chunks) {
        onToken(chunk);
        await this.wait(16);
      }
    }

    const reply = this.applyBudgetTruthGuard({
      reply: rawReply,
      budget,
      recommendations,
      locale,
    });

    if (reply !== rawReply) {
      const suffix = reply.slice(rawReply.length);
      const chunks = suffix.split(/(\s+)/).filter((part) => part.length > 0);
      for (const chunk of chunks) {
        onToken(chunk);
        await this.wait(16);
      }
    }

    return {
      reply,
      recommendations,
    };
  }
}
