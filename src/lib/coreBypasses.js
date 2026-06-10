// src/lib/coreBypasses.js — FULL REPLACEMENT for local operation
import { invokeLLMWithRetry } from '@/lib/integrationRetry';

export async function bypassInvokeLLM(payload) {
  const response = await invokeLLMWithRetry({ prompt: payload.prompt, temperature: payload.temperature, max_tokens: payload.max_tokens, task_type: payload.task_type || 'prose' });
  let text = typeof response === 'string' ? response : (response?.text || '');
  if (payload.response_json_schema) {
    text = text.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();
    try { return JSON.parse(text); } catch (e) { console.warn('[BYPASS] JSON parse failed'); return text; }
  }
  return text;
}

export async function bypassGenerateImage(payload) {
  const { generateImageLocal } = await import('@/lib/localImageGen');

  const result = await generateImageLocal({
    prompt: payload.prompt,
    size: payload.size || '1024x1536',
    quality: payload.quality,
  });

  return {
    url: result.url,
    image_url: result.image_url,
    raw: result,
  };
}

export async function bypassUploadFile({ file }) {
  if (typeof file === 'string') return { file_url: file };
  if (file instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ file_url: reader.result });
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }
  throw new Error('bypassUploadFile: unsupported file type');
}
