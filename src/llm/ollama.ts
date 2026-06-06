export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function queryLLM(
  provider: "ollama" | "gemini" | "openrouter",
  model: string,
  apiKey: string | undefined,
  messages: LLMMessage[],
  jsonMode: boolean
): Promise<string> {
  const selectedProvider = provider || "ollama";

  if (selectedProvider === "ollama") {
    const url = `${process.env.OLLAMA_URL || "http://127.0.0.1:11434"}/api/chat`;
    const modelName = model || process.env.OLLAMA_MODEL || "qwen3:4b";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          format: jsonMode ? "json" : undefined,
          stream: false,
          options: {
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama HTTP Error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as { message?: { content?: string } };
      return data.message?.content || "";
    } catch (err: any) {
      throw new Error(
        `Ollama connection error: Failed to communicate with Ollama at ${url} using model "${modelName}". ` +
        `Make sure Ollama is running ('ollama serve') and the model is pulled ('ollama pull ${modelName}'). ` +
        `Error details: ${err.message}`
      );
    }
  }

  if (selectedProvider === "gemini") {
    if (!apiKey) {
      throw new Error("Gemini API Key is required but not provided in the request.");
    }
    const url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const modelName = model || "gemini-2.5-flash";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          response_format: jsonMode ? { type: "json_object" } : undefined,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err: any) {
      throw new Error(`Gemini API connection error: ${err.message}`);
    }
  }

  if (selectedProvider === "openrouter") {
    if (!apiKey) {
      throw new Error("OpenRouter API Key is required but not provided in the request.");
    }
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const modelName = model || "google/gemini-2.5-flash";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "OpsisAI",
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          response_format: jsonMode ? { type: "json_object" } : undefined,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err: any) {
      throw new Error(`OpenRouter API connection error: ${err.message}`);
    }
  }

  throw new Error(`Unsupported LLM provider: ${selectedProvider}`);
}
