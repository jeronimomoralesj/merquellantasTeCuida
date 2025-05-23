// /app/api/gemini/route.ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    // 1. Validate
    if (!Array.isArray(messages)) {
      console.error("Invalid messages format:", messages);
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // 2. API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY not configured");
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // 3. Initialize client
    const ai = new GoogleGenAI({ apiKey });

    // 4. Build a single prompt text from your chat history
    //    (you can customize how you label roles or inject a system prompt here)
    const prompt = messages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) =>
        `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
      )
      .join("\n")
      + "\nAssistant:";

    // 5. Call generateContent on the Gemini model
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",    // or whatever version you’ve got access to
      contents: prompt,
    });

    // 6. Send back the text
    return NextResponse.json({ message: result.text });
  } catch (err: any) {
    console.error("Gemini API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
