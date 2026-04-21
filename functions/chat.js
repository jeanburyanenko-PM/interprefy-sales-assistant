async function loadKnowledge() {
  const baseUrl = "https://interprepy-sales-assistant.pages.dev/data/";

  const files = [
    "integrations.txt"
  ];

  let combinedText = "";

  for (const file of files) {
    try {
      const res = await fetch(baseUrl + file);

      if (!res.ok) continue;

      const text = await res.text();
      combinedText += `\n\n### ${file}\n${text}`;

    } catch (err) {
      console.log(err);
    }
  }

  return combinedText;
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // ✅ SIEMPRE FUERA del JSON
    const knowledge = await loadKnowledge();

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
You MUST ONLY use the knowledge base below.

KNOWLEDGE BASE:
${knowledge}
        `,

        messages: body.messages
      })
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
}
