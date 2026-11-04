// OpenAI-compatible chat completions. Covers OpenAI, Groq, and local servers (Ollama, LM Studio)
// that expose /v1/chat/completions.
import { LlmError, type CompletionRequest, type LlmProvider } from './provider';

export function openaiCompatibleProvider(baseUrl: string, apiKey: string, model: string): LlmProvider {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  return {
    name: 'openai-compatible',
    async complete(req: CompletionRequest) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens,
          temperature: 0,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.prompt },
          ],
        }),
      });
      if (!res.ok) throw new LlmError(`LLM request failed with HTTP ${res.status}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content ?? '';
    },
  };
}
