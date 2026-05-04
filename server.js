import http from "http";
import { Anthropic } from "@anthropic-ai/sdk";

const PORT = process.env.PORT || 3000;
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DOMAIN_PROMPTS = {
  college:
    "You are an expert college advisor. You help students with admissions, course selection, campus life, scholarships, and academic planning. Detect the user's intent and respond helpfully. Always start your response with an intent tag like [INTENT:admissions], [INTENT:courses], [INTENT:scholarships], [INTENT:campus_life], or [INTENT:general_college].",
  health:
    "You are a knowledgeable health assistant. You provide general health information about nutrition, exercise, common ailments, mental wellness, and preventive care. You are not a doctor. Be careful, avoid definitive diagnoses, and recommend consulting a qualified healthcare professional when appropriate. Detect intent and start with [INTENT:nutrition], [INTENT:exercise], [INTENT:mental_health], [INTENT:symptoms], or [INTENT:general_health].",
  crops:
    "You are an agricultural expert assistant. You help farmers and gardeners with crop selection, pest management, soil health, irrigation, seasonal planning, and market trends. Detect intent and start with [INTENT:pest_management], [INTENT:soil_health], [INTENT:irrigation], [INTENT:crop_selection], or [INTENT:general_agriculture].",
  general:
    "You are a helpful AI assistant with broad knowledge. Answer clearly, stay practical, and detect the user's intent. Start with [INTENT:question], [INTENT:explanation], [INTENT:recommendation], [INTENT:creative], or [INTENT:general].",
};

async function streamResponse(res, messages, domain) {
  const systemPrompt = DOMAIN_PROMPTS[domain] || DOMAIN_PROMPTS.general;

  try {
    const stream = await client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const sseMessage = {
          choices: [{ delta: { content: event.delta.text } }],
        };
        res.write(`data: ${JSON.stringify(sseMessage)}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Stream error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/functions/v1/chat") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const { messages, domain } = JSON.parse(body);
        streamResponse(res, messages, domain);
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request" }));
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`Chat backend running at http://localhost:${PORT}`);
  console.log(`Chat endpoint: http://localhost:${PORT}/functions/v1/chat`);
  console.log(`Using model: claude-opus-4-6`);
});
