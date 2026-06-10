// .// base44/functions/fetchFromGitHub/entry.js

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (req.method !== "POST") {
      return jsonResponse(
        {
          error: "Method not allowed. Use POST.",
        },
        405
      );
    }

    const body = await req.json().catch(() => ({}));
    const url = String(body.url || body.file_url || body.raw_url || "").trim();

    if (!url) {
      return jsonResponse(
        {
          error: "Missing required field: url",
        },
        400
      );
    }

    if (!isAllowedGitHubRawUrl(url)) {
      return jsonResponse(
        {
          error: "Blocked URL. Only raw GitHub content URLs are allowed.",
          received: url.slice(0, 200),
        },
        400
      );
    }

    const bustUrl = addCacheBust(url);

    const response = await fetch(bustUrl, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "User-Agent": "Base44-Chapter-Fetcher",
        "Accept": "text/plain, text/markdown, application/octet-stream, */*",
      },
    });

    if (!response.ok) {
      return jsonResponse(
        {
          error: "GitHub fetch failed",
          status: response.status,
          statusText: response.statusText,
          url: scrubUrlForLog(url),
        },
        502
      );
    }

    const text = await response.text();

    return jsonResponse(
      {
        ok: true,
        text,
        content: text,
        chars: text.length,
        words: countWords(text),
        url: scrubUrlForLog(url),
        fetched_at: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

function isAllowedGitHubRawUrl(url) {
  try {
    const parsed = new URL(url);

    const allowedHosts = new Set([
      "raw.githubusercontent.com",
      "github.com",
    ]);

    if (!allowedHosts.has(parsed.hostname)) return false;

    if (parsed.hostname === "github.com") {
      return parsed.pathname.includes("/raw/");
    }

    return true;
  } catch {
    return false;
  }
}

function addCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_base44_proxy_t=${Date.now()}`;
}

function scrubUrlForLog(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url || "").slice(0, 200);
  }
}

function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}