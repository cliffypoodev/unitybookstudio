// CLOUDROUTE-1 — intentionally disabled.
//
// UBS prose inference is local-only through llama.cpp. Keep this legacy
// function as a fail-closed tombstone so an old Base44 deployment or caller
// receives an explicit refusal instead of silently sending manuscript text
// to an external model provider.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function disabledResponse() {
  return Response.json(
    {
      ok: false,
      error: "CLOUDROUTE-1: cloud LLM routes are disabled; use the local UBS llama.cpp route.",
    },
    { status: 410, headers: CORS_HEADERS },
  );
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return disabledResponse();
});
