// Bring-your-own-model provider interface. Every provider does one thing: turn a system prompt and
// a user prompt into text. Classification and generation logic live in core/, not here.

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  /** 'low' for classification, 'medium' for writing. Providers that do not support it ignore it. */
  effort: 'low' | 'medium';
}

export interface LlmProvider {
  name: string;
  complete(req: CompletionRequest): Promise<string>;
}

export class LlmError extends Error {}
