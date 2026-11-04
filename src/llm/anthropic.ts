// Anthropic Messages API via the official SDK. The request goes straight from the extension to
// api.anthropic.com with the user's own key; there is no applyflow server in between.
import Anthropic from '@anthropic-ai/sdk';
import { LlmError, type CompletionRequest, type LlmProvider } from './provider';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5-5';

export function anthropicProvider(apiKey: string, model = ANTHROPIC_DEFAULT_MODEL): LlmProvider {
  // dangerouslyAllowBrowser: the key belongs to the user and never leaves their machine except to Anthropic.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  return {
    name: 'anthropic',
    async complete(req: CompletionRequest) {
      const res = await client.beta.messages.create({
        model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
        output_config: { effort: req.effort },
        // If a request is declined by a safety classifier, let the API retry it on a fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      if (res.stop_reason === 'refusal') throw new LlmError('The model declined this request.');
      return res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
    },
  };
}
