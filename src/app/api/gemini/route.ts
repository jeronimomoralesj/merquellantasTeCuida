// /app/api/gemini/route.ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// 1) Define a strong type for your messages
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// 2) Type guard function to check if an object is a ChatMessage
function isChatMessage(obj: unknown): obj is ChatMessage {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "role" in obj &&
    "content" in obj &&
    ["user", "assistant", "system"].includes((obj as Record<string, unknown>).role as string) &&
    typeof (obj as Record<string, unknown>).content === "string"
  );
}

export async function POST(request: Request) {
  try {
    // 3) Cast the JSON body to your typed shape
    const { messages } = (await request.json()) as { messages: unknown };

    // 4) Validate that you actually got an array of ChatMessage objects
    if (!Array.isArray(messages)) {
      console.error("Invalid messages format:", messages);
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // 5) Narrow the array down to only those entries matching ChatMessage
    const chatHistory: ChatMessage[] = messages.filter(isChatMessage);

    // 6) Build the prompt out of only user+assistant messages
    const prompt = chatHistory
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`
      )
      .join("\n") + "\nAssistant:";

    // 7) Ensure your Gemini key is set
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY not configured");
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // 8) Invoke Gemini
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return NextResponse.json({ message: result.text });
  } catch (err: unknown) {
    // 9) Handle unknown errors safely
    const message =
      err instanceof Error ? err.message : "Failed to process request";
    console.error("Gemini API error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}