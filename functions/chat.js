async function loadKnowledge() {
  const baseUrl = "https://interprepy-sales-assistant.pages.dev/";

  const files = [
    "integrations.txt",
    "setups.txt"
  ];

  let combinedText = "";
  let failedFiles = [];

  for (const file of files) {
    try {
      const res = await fetch(baseUrl + file);

      if (!res.ok) {
        failedFiles.push(file);
        continue;
      }

      const text = await res.text();
      combinedText += `\n\n### ${file}\n${text}`;

    } catch (err) {
      console.error("Error loading knowledge file:", file, err);
      failedFiles.push(file);
    }
  }

  // BUG 6 FIX: Surface knowledge load failures so the model knows its context is incomplete
  if (failedFiles.length > 0) {
    combinedText += `\n\n### SYSTEM NOTE\nThe following knowledge files failed to load: ${failedFiles.join(", ")}. If asked about topics covered by these files, acknowledge that your knowledge base may be incomplete.`;
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
    const knowledge = await loadKnowledge();

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
