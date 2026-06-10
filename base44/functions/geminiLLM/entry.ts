const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

Deno.serve(async (req) => {
  try {
    const { prompt, response_json_schema, add_context_from_internet, max_tokens, temperature } = await req.json();

    if (!prompt) {
      return Response.json({ error: 'prompt is required' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'GOOGLE_AI_API_KEY not set' }, { status: 500 });
    }

    // Gemini 2.5 Flash: 65,536 output token ceiling (vs 8,192 on 2.0 Flash).
    // Needed for large structured outputs like anthology bibles with 20+ stories.
    // thinkingBudget: 0 disables 2.5's "thinking" phase so latency stays comparable
    // to 2.0 Flash for analytical tasks (beats, judge, scan, critique, research).
    const model = 'gemini-2.5-flash';
    const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;

    // Build parts
    // When search is enabled, embed schema instructions into the prompt itself
    // because system instructions + grounding can cause Gemini to echo the schema
    let finalPrompt = prompt;
    if (response_json_schema && add_context_from_internet) {
      finalPrompt = prompt + '\n\nIMPORTANT: After completing your research, format your ENTIRE response as a single valid JSON object (no markdown, no code fences, no explanation before or after). The JSON must conform to this schema:\n' + JSON.stringify(response_json_schema);
    }
    const parts = [{ text: finalPrompt }];

    // System instruction only for non-search structured output
    const systemInstruction = (response_json_schema && !add_context_from_internet)
      ? { parts: [{ text: `You MUST respond with valid JSON only. No markdown, no code fences, no explanation. The JSON must conform to this schema:\n${JSON.stringify(response_json_schema)}` }] }
      : undefined;

    // When search/grounding is enabled, Gemini does NOT allow responseMimeType
    // We also track this so the JSON parsing path knows whether to trust structured output
    const useStructuredOutput = response_json_schema && !add_context_from_internet;

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: max_tokens || 8192,
        temperature: temperature ?? 0.7,
        thinkingConfig: { thinkingBudget: 0 },
        ...(useStructuredOutput ? { responseMimeType: 'application/json' } : {}),
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    // If web search (grounding) requested, add Google Search tool
    if (add_context_from_internet) {
      body.tools = [{ googleSearch: {} }];
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180000),
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
        return Response.json({ error: 'Gemini request timed out after 180s' }, { status: 504 });
      }
      throw fetchErr;
    }

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        { error: `Gemini API error: ${response.status} ${errorText}` },
        { status: response.status >= 500 ? response.status : 502 }
      );
    }

    const data = await response.json();
    // Concatenate ALL parts — Gemini can split long responses across multiple parts
    const allParts = data?.candidates?.[0]?.content?.parts || [];
    const content = allParts.map(p => p.text || '').join('');
    console.log('[GEMINI] Response parts count:', allParts.length, '| Total content length:', content.length);

    if (response_json_schema) {
      let jsonStr = content.trim();
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
      }
      // Helper: attempt to parse with guard check
      const guardAndReturn = (parsed) => {
        if (parsed.type === 'object' && parsed.properties && parsed.required) {
          console.log('[GEMINI] Response echoed schema instead of data. Returning as text.');
          return Response.json({ text: content });
        }
        return Response.json(parsed);
      };

      // Helper: aggressive newline/control-char fix for string values
      const fixStringValues = (s) => {
        // Replace literal newlines/tabs/carriage-returns INSIDE JSON string values
        // This regex matches content between double quotes (non-greedy, handles escaped quotes)
        return s.replace(/"((?:[^"\\]|\\.)*)"/gs, (match, inner) => {
          const fixed = inner
            .replace(/(?<!\\)\n/g, '\\n')
            .replace(/(?<!\\)\r/g, '\\r')
            .replace(/(?<!\\)\t/g, '\\t');
          return '"' + fixed + '"';
        });
      };

      // Helper: close truncated JSON
      const closeTruncated = (s) => {
        // Remove trailing incomplete string value or key
        let f = s.replace(/,\s*"(?:[^"\\]|\\.)*$/s, '');
        f = f.replace(/,\s*"[^"]*"\s*:\s*"(?:[^"\\]|\\.)*$/s, '');
        f = f.replace(/,\s*"[^"]*"\s*:\s*$/s, '');
        f = f.replace(/,\s*$/s, '');
        let opens = 0; let openArr = 0;
        for (const c of f) { if (c === '{') opens++; else if (c === '}') opens--; else if (c === '[') openArr++; else if (c === ']') openArr--; }
        while (openArr > 0) { f += ']'; openArr--; }
        while (opens > 0) { f += '}'; opens--; }
        return f;
      };

      const parseAttempts = [
        // 1: direct parse
        () => JSON.parse(jsonStr),
        // 2: fix trailing commas
        () => JSON.parse(jsonStr.replace(/,\s*([}\]])/g, '$1')),
        // 3: fix unescaped newlines + trailing commas
        () => JSON.parse(fixStringValues(jsonStr).replace(/,\s*([}\]])/g, '$1')),
        // 4: close truncated JSON + fix newlines
        () => {
          const closed = closeTruncated(fixStringValues(jsonStr).replace(/,\s*([}\]])/g, '$1'));
          const parsed = JSON.parse(closed);
          console.log('[GEMINI] Parsed JSON after closing truncated braces.');
          return parsed;
        },
        // 5: strip all control chars except \n\r\t, then fix newlines + close
        () => {
          let cleaned = jsonStr.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
          cleaned = fixStringValues(cleaned).replace(/,\s*([}\]])/g, '$1');
          cleaned = closeTruncated(cleaned);
          return JSON.parse(cleaned);
        },
        // 6: nuclear option — strip ALL non-printable, re-extract braces, fix, close
        () => {
          let nuclear = jsonStr.replace(/[^\x20-\x7e\n\r\t]/g, '');
          nuclear = fixStringValues(nuclear).replace(/,\s*([}\]])/g, '$1');
          nuclear = closeTruncated(nuclear);
          return JSON.parse(nuclear);
        },
      ];

      for (let i = 0; i < parseAttempts.length; i++) {
        try {
          return guardAndReturn(parseAttempts[i]());
        } catch {}
      }

      // All parsing attempts failed — return raw with 200 so client can salvage
      console.error('[GEMINI] All JSON parse attempts failed. Raw length:', jsonStr.length, '| First 500:', jsonStr.substring(0, 500));
      if (add_context_from_internet) {
        return Response.json({ text: content });
      }
      // Return 200 with error+raw so client-side salvage can attempt recovery
      // (returning 422 causes the SDK to throw before client can access raw)
      return Response.json({ error: 'Failed to parse JSON response', raw: content || jsonStr });
    }

    return Response.json({ text: content });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});