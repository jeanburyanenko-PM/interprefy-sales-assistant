async function loadKnowledge() {
  try {
    const baseUrl = "https://6ab8d395.interprefy-sales-assistant.pages.dev/data";

    const files = [
      "integrations.txt",
      "setups.txt"
      // añade más aquí
    ];

    let combinedText = "";

    for (const file of files) {
      const res = await fetch(baseUrl + file);
      const text = await res.text();

      combinedText += `\n\n### ${file}\n${text}`;
    }

    return combinedText;

  } catch (err) {
    console.log("Error loading knowledge:", err);
    return "";
  }
}
async function loadKnowledge() {
  try {
    const res = await fetch("https://6ab8d395.interprefy-sales-assistant.pages.dev/data");
    const data = await res.json();

    return data.map(doc => {
      return `### ${doc.title}\n${doc.content}`;
    }).join("\n\n");

  } catch (err) {
    console.log("Error loading knowledge:", err);
    return "";
  }
}
export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    
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
${body.system}

ADDITIONAL KNOWLEDGE:
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
