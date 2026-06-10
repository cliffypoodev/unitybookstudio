const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODEL = "deepseek/deepseek-v3.2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init.headers || {}),
    },
  });
}

function truncate(value: string, max = 4000) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}...[truncated]` : value;
}

function normalizeModel(model: unknown) {
  const cleaned = String(model || "").trim();
  return cleaned || DEFAULT_MODEL;
}

function normalizeMaxTokens(value: unknown) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 8192;
  return Math.min(Math.floor(parsed), 16000);
}

function normalizeTemperature(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.72;
  return Math.max(0, Math.min(parsed, 2));
}

function stripCodeFences(value: string) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function extractLikelyJson(value: string) {
  let s = stripCodeFences(value);

  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  return s.trim();
}

function fixStringValues(str: string) {
  return str.replace(/"((?:[^"\\]|\\.)*)"/gs, (_match, inner) => {
    const fixed = inner
      .replace(/(?<!\\)\n/g, "\\n")
      .replace(/(?<!\\)\r/g, "\\r")
      .replace(/(?<!\\)\t/g, "\\t");

    return `"${fixed}"`;
  });
}

function closeTruncatedJson(str: string) {
  let fixed = str;

  fixed = fixed.replace(/,\s*"(?:[^"\\]|\\.)*$/s, "");
  fixed = fixed.replace(/,\s*"[^"]*"\s*:\s*"(?:[^"\\]|\\.)*$/s, "");
  fixed = fixed.replace(/,\s*"[^"]*"\s*:\s*$/s, "");
  fixed = fixed.replace(/,\s*$/s, "");

  let objectDepth = 0;
  let arrayDepth = 0;
  let inString = false;
  let escaped = false;

  for (const char of fixed) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") objectDepth += 1;
    if (char === "}") objectDepth -= 1;
    if (char === "[") arrayDepth += 1;
    if (char === "]") arrayDepth -= 1;
  }

  while (arrayDepth > 0) {
    fixed += "]";
    arrayDepth -= 1;
  }

  while (objectDepth > 0) {
    fixed += "}";
    objectDepth -= 1;
  }

  return fixed;
}

function parseJsonAggressively(raw: string) {
  const jsonStr = extractLikelyJson(raw);

  const attempts = [
    () => JSON.parse(jsonStr),
    () => JSON.parse(jsonStr.replace(/,\s*([}\]])/g, "$1")),
    () => JSON.parse(fixStringValues(jsonStr).replace(/,\s*([}\]])/g, "$1")),
    () => JSON.parse(closeTruncatedJson(fixStringValues(jsonStr).replace(/,\s*([}\]])/g, "$1"))),
    () => {
      let cleaned = jsonStr.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
      cleaned = fixStringValues(cleaned).replace(/,\s*([}\]])/g, "$1");
      cleaned = closeTruncatedJson(cleaned);
      return JSON.parse(cleaned);
    },
    () => {
      let nuclear = jsonStr.replace(/[^\x20-\x7e\n\r\t]/g, "");
      nuclear = fixStringValues(nuclear).replace(/,\s*([}\]])/g, "$1");
      nuclear = closeTruncatedJson(nuclear);
      return JSON.parse(nuclear);
    },
  ];

  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      // Keep trying.
    }
  }

  return null;
}

function buildMessages(body: any): ChatMessage[] {
  if (Array.isArray(body?.messages) && body.messages.length > 0) {
    return body.messages
      .filter((msg: any) => msg && msg.role && typeof msg.content === "string")
      .map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      }));
  }

  const prompt = String(body?.prompt || "").trim();

  const messages: ChatMessage[] = [];

  if (body?.system_prompt) {
    messages.push({
      role: "system",
      content: String(body.system_prompt),
    });
  }

  messages.push({
    role: "user",
    content: prompt,
  });

  return messages;
}

function buildStructuredSystemInstruction(schema: unknown) {
  return [
    "You must respond with one valid JSON object only.",
    "Do not include markdown.",
    "Do not include code fences.",
    "Do not include commentary before or after the JSON.",
    "The JSON must conform to this schema:",
    JSON.stringify(schema),
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (req.method === "GET") {
    return json({
      ok: true,
      service: "openRouterLLM",
      mode: "chat-completions",
      default_model: DEFAULT_MODEL,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed. Use POST.",
      },
      { status: 405 },
    );
  }

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!apiKey) {
      return json(
        {
          error: "OPENROUTER_API_KEY is not configured in Base44 secrets.",
        },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));

    const prompt = String(body?.prompt || "").trim();
    const hasMessages = Array.isArray(body?.messages) && body.messages.length > 0;

    if (!prompt && !hasMessages) {
      return json(
        {
          error: "prompt or messages is required.",
        },
        { status: 400 },
      );
    }

    const model = normalizeModel(body?.model);
    const maxTokens = normalizeMaxTokens(body?.max_tokens);
    const temperature = normalizeTemperature(body?.temperature);
    const responseJsonSchema = body?.response_json_schema;

    let messages = buildMessages(body);

    if (responseJsonSchema) {
      const structuredInstruction = buildStructuredSystemInstruction(responseJsonSchema);

      const existingSystemIndex = messages.findIndex((msg) => msg.role === "system");

      if (existingSystemIndex >= 0) {
        messages[existingSystemIndex] = {
          ...messages[existingSystemIndex],
          content: `${messages[existingSystemIndex].content}\n\n${structuredInstruction}`,
        };
      } else {
        messages = [
          {
            role: "system",
            content: structuredInstruction,
          },
          ...messages,
        ];
      }
    }

    const openRouterPayload: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (responseJsonSchema) {
      openRouterPayload.response_format = {
        type: "json_object",
      };
    }

    let response: Response;

    try {
      response = await fetch(OPENROUTER_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://base44.app",
          "X-Title": "Unity Book Studio",
        },
        body: JSON.stringify(openRouterPayload),
        signal: AbortSignal.timeout(180000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return json(
        {
          error:
            message.includes("aborted") || message.includes("Timeout")
              ? "OpenRouter request timed out after 180 seconds."
              : `OpenRouter fetch failed: ${message}`,
        },
        { status: 504 },
      );
    }

    const rawText = await response.text();

    let data: any = null;

    try {
      data = JSON.parse(rawText);
    } catch {
      return json(
        {
          error: `OpenRouter returned non-JSON response: ${truncate(rawText)}`,
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    if (!response.ok) {
      const apiError =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        rawText ||
        "Unknown OpenRouter API error.";

      return json(
        {
          error: `OpenRouter API error: ${response.status} ${typeof apiError === "string" ? apiError : JSON.stringify(apiError)}`,
          status: response.status,
          model,
        },
        { status: response.status >= 500 ? response.status : 502 },
      );
    }

    const content =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      "";

    if (!content || typeof content !== "string") {
      return json(
        {
          error: "OpenRouter returned an empty completion.",
          model,
          raw: data,
        },
        { status: 502 },
      );
    }

    if (responseJsonSchema) {
      const parsed = parseJsonAggressively(content);

      if (!parsed) {
        return json(
          {
            error: "Failed to parse OpenRouter JSON response.",
            raw: content,
            model,
          },
          { status: 200 },
        );
      }

      return json(parsed);
    }

    return json({
      text: content,
      model,
      usage: data?.usage || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
});