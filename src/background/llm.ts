// Build the configured LLM provider, or null when the user has not set one up.
import type { Secrets, Settings } from '../core/types';
import { anthropicProvider } from '../llm/anthropic';
import { mockProvider } from '../llm/mock';
import { openaiCompatibleProvider } from '../llm/openai';
import type { LlmProvider } from '../llm/provider';

export function providerFor(settings: Settings, secrets: Secrets): LlmProvider | null {
  const { provider, baseUrl, model } = settings.llm;
  switch (provider) {
    case 'anthropic':
      return secrets.llmApiKey && model ? anthropicProvider(secrets.llmApiKey, model) : null;
    case 'openai':
      return model ? openaiCompatibleProvider(baseUrl, secrets.llmApiKey, model) : null;
    case 'mock':
      return mockProvider();
    default:
      return null;
  }
}
