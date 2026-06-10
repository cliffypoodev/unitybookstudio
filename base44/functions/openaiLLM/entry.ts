const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

Deno.serve(async (req) => {
  try {
    const { prompt, response_json_schema, max_tokens, temperature, model } = await req.json();

    if (!prompt) {
      return Response.json({ error: 'prompt is required' }, { status: 400 });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
    }

    // Resolve model string — accept shorthand and map to full API model IDs
    const MODEL_MAP = {
      'gpt-5.5': 'gpt-5.5-2026-04-23',
      'gpt-5.5-pro': 'gpt-5.5-pro-2026-04-23',
      'gpt-5.4': 'gpt-5.4-2026-03-05',
      'gpt-5': 'gpt-5.4-2026-03-05',
      'gpt-5.4-mini': 'gpt-5.4-mini',
      'gpt-5.4-nano': 'gpt-5.4-nano',
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini',
    };
    const resolvedModel = MODEL_MAP[model] || model || 'gpt-5.4-2026-03-05';

    // GPT-5.x models require max_completion_tokens instead of max_tokens
    const isGpt5 = resolvedModel.startsWith('gpt-5');

    console.log(`[openaiLLM] Using model: ${resolvedModel} (requested: ${model || 'default'}) isGpt5: ${isGpt5}`);

    const messages = [{ role: 'user', content: prompt }];

    if (response_json_schema) {
      messages.unshift({
        role: 'system',
        content: `You MUST respond with valid JSON only. No markdown, no code fences, no explanation. The JSON must conform to this schema:\n${JSON.stringify(response_json_schema)}`
      });
    }

    const body = {
      model: resolvedModel,
      messages,
      temperature: temperature ?? 0.7,
    };

    // Use the correct token limit parameter based on model family
    if (isGpt5) {
      body.max_completion_tokens = max_tokens || 8192;
    } else {
      body.max_tokens = max_tokens || 8192;
    }

    if (response_json_schema) {
      body.response_format = { type: 'json_object' };
    }

    let response;
    try {
      response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180000),
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
        return Response.json({ error: 'OpenAI request timed out after 180s' }, { status: 504 });
      }
      throw fetchErr;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[openaiLLM] OpenAI error ${response.status}: ${errorText.substring(0, 500)}`);
      return Response.json(
        { error: `OpenAI API error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';

    console.log(`[openaiLLM] Success. Response length: ${content.length} chars`);

    if (response_json_schema) {
      let jsonStr = content.trim();
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
      }
      try {
        return Response.json(JSON.parse(jsonStr));
      } catch {
        try {
          const fixed = jsonStr.replace(/,\s*([}\]])/g, '$1');
          return Response.json(JSON.parse(fixed));
        } catch {
          return Response.json({ error: 'Failed to parse JSON response', raw: content }, { status: 422 });
        }
      }
    }

    return Response.json({ text: content });
  } catch (error) {
    console.error(`[openaiLLM] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});