async function loadKnowledge() {
  const baseUrl = "https://interprepy-sales-assistant.pages.dev/";

  const files = [
    "integrations.txt",
    "setups.txt"
  ];

  let combinedText = "";

  for (const file of files) {
    try {
      const res = await fetch(baseUrl + file);

      if (!res.ok) continue;

      const text = await res.text();
      combinedText += `\n\n### ${file}\n${text}`;

    } catch (err) {
      console.log("Error loading file:", file, err);
    }
  }

  return combinedText;
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // ✅ FIX CLAVE: formatear mensajes correctamente para Anthropic
    const formattedMessages = body.messages.map(msg => ({
      role: msg.role,
      content: [
        {
          type: "text",
          text: msg.content
        }
      ]
    }));

    // ✅ cargar knowledge real
    const knowledge = await loadKnowledge();
    console.log("KNOWLEDGE LENGTH:", knowledge.length);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": context.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: body.model,
        max_tokens: body.max_tokens,
        system: `
You are an AI sales assistant for Interprefy.

IMPORTANT:
- You MUST ONLY use the knowledge base below
- If the answer is not in the knowledge base, say so clearly
- Keep answers practical and useful for sales

KNOWLEDGE BASE:
${knowledge}
        `,
        messages: formattedMessages
      })
    });

    const data = await response.json();

    // ✅ manejo de errores claro
    if (!data.content) {
      console.error("Claude error:", data);
      return new Response(
        JSON.stringify({
          error: data.error?.message || "No content returned from API",
          raw: data
        }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Server error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
}
