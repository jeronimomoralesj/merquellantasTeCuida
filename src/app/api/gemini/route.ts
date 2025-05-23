// /app/api/gemini/route.ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// 1) Define a strong type for your messages
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(request: Request) {
  try {
    // 2) Cast the JSON body to your typed shape
    const { messages } = (await request.json()) as { messages: unknown };

    // 3) Validate that you actually got an array of ChatMessage objects
    if (!Array.isArray(messages)) {
      console.error("Invalid messages format:", messages);
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // 4) Narrow the array down to only those entries matching ChatMessage
    const chatHistory: ChatMessage[] = messages.filter(
      (m): m is ChatMessage =>
        typeof m === "object" &&
        m !== null &&
        ["user", "assistant", "system"].includes((m as any).role) &&
        typeof (m as any).content === "string"
    );

    // 5) Build the prompt out of only user+assistant messages
    const prompt = chatHistory
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`
      )
      .join("\n") + "\nAssistant:";

    // 6) Ensure your Gemini key is set
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY not configured");
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // 7) Invoke Gemini
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return NextResponse.json({ message: result.text });
  } catch (err: unknown) {
    // 8) Handle unknown errors safely
    const message =
      err instanceof Error ? err.message : "Failed to process request";
    console.error("Gemini API error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
