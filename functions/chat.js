async function loadKnowledge(context) {
  const baseUrl = new URL(context.request.url).origin;

  const files = [
    "integrations.txt",
    "interprefy-agent-qa.txt",
    "interprefy-agent.txt",
    "interprefy-now-faq.txt",
    "hybrid-onsite-setup-requirements.txt"
  ];

  let combinedText = "";
  let failedFiles = [];

  for (const file of files) {
    try {
      const res = await fetch(`${baseUrl}/${file}`);

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

  if (failedFiles.length > 0) {
    combinedText += `\n\n### SYSTEM NOTE\nThe following knowledge files failed to load: ${failedFiles.join(", ")}.`;
  }

  return combinedText;
}
