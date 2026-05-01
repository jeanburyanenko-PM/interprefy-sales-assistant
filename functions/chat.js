async function loadKnowledge(context) {
  const baseUrl = "https://interprefy-sales-assistant.pages.dev";

  const files = [
    "integrations.txt",
    "interprefy-agent-qa.txt",
    "interprefy-agent.txt",
    "interprefy-now-faq.txt",
    "hybrid-onsite-setup-requirements.txt"
  ];

  let combinedText = "";

  for (const file of files) {
    const res = await fetch(`${baseUrl}/${file}`);

    if (!res.ok) continue;

    const text = await res.text();
    combinedText += `\n\n${text}`;
  }

  return combinedText;
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // BUG 2: Correctly format messages for Anthropic API.
    // content must be an array of content blocks, not a plain string.
    // This handles both string content (from user) and array content (defensive).
    const formattedMessages = body.messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === "string"
        ? [{ type: "text", text: msg.content }]
        : msg.content  // already formatted, pass through
    }));

    // BUG 1 FIX: Backend owns the system prompt. Do not use body.system.
    // The frontend's system field is ignored intentionally.
const knowledge = await loadKnowledge(context);
    
    const systemPrompt = `
You are an AI sales assistant for Interprefy.

IMPORTANT:
- You MUST ONLY use the knowledge base below to answer questions.
- If the answer is not in the knowledge base, say: "I don't have enough information based on the current knowledge base."
- Keep answers practical and useful for sales.
- Format answers with clear paragraphs. Use **bold** for key terms.
- When possible, include the source document at the end: [Source: document name]
- Tone: Professional but simple. Helpful and direct.

KNOWLEDGE BASE:
${knowledge}
    `.trim();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": context.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-5",  // BUG 7 FIX: fallback to valid model name
        max_tokens: body.max_tokens || 1000,
        system: systemPrompt,
        messages: formattedMessages
      })
    });

    const data = await response.json();

    if (!response.ok || !data.content) {
      console.error("Anthropic API error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({
          error: data.error?.message || "Unexpected error from Anthropic API",
          type: data.error?.type || "unknown"
        }),
        {
          status: response.ok ? 500 : response.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const answerText =
  data?.content?.[0]?.text || "";

const lastMessage = body?.messages?.[body.messages.length - 1];

const userText =
  typeof lastMessage?.content === "string"
    ? lastMessage.content
    : lastMessage?.content?.[0]?.text || "";
    
fetch("https://script.google.com/macros/s/AKfycbyIee_INYh3WnTwifKYK6k7mOOlX5RSZIvTeH-6Zz9soqfTeoJVmuCmpaWeBBFazuKq/exec", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    question: userText,
    answer: answerText,
    timestamp: new Date().toISOString()
  })
}).catch((err) => {
  console.error("Logging error:", err);
});
    

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Server error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
