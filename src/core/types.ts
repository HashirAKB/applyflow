// Shared data types. Pure TypeScript, no chrome.* APIs.

export interface Experience {
  company: string;
  title: string;
  start: string;
  end: string;
  description: string;
}

export interface Education {
  school: string;
  degree: string;
  field: string;
  start: string;
  end: string;
}

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  city: string;
  country: string;
  linkedin: string;
  github: string;
  website: string;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
}

export function emptyProfile(): Profile {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    city: '',
    country: '',
    linkedin: '',
    github: '',
    website: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
  };
}

/** One entry in the answer bank. */
export interface Answer {
  /** Canonical question id, or `custom:<slug>` for a question the user taught us. */
  questionId: string;
  /** The answer value exactly as the user gave it. */
  value: string;
  /** Labels seen on real forms that the user confirmed mean this question. Used for fuzzy matching. */
  aliases: string[];
  updatedAt: string;
}

export type LlmProviderName = 'none' | 'anthropic' | 'openai' | 'mock';

export interface LlmSettings {
  provider: LlmProviderName;
  /** Base URL for OpenAI-compatible providers (OpenAI, Groq, Ollama, LM Studio). */
  baseUrl: string;
  model: string;
}

export interface AutoSubmitSettings {
  /** Global kill switch. When false nothing is ever submitted automatically. */
  enabled: boolean;
  /** Per-site opt-in, keyed by adapter id. */
  sites: Record<string, boolean>;
  /** The one-time risk confirmation screen was accepted. */
  riskAcknowledged: boolean;
  /** Do everything except clicking submit. */
  dryRun: boolean;
  dailyCap: number;
  minDelayMs: number;
  maxDelayMs: number;
}

export interface Settings {
  /** Minimum confidence to fill a field without asking. */
  threshold: number;
  llm: LlmSettings;
  autoSubmit: AutoSubmitSettings;
}

export function defaultSettings(): Settings {
  return {
    threshold: 0.75,
    llm: { provider: 'none', baseUrl: 'https://api.openai.com/v1', model: '' },
    autoSubmit: {
      enabled: false,
      sites: {},
      riskAcknowledged: false,
      dryRun: true,
      dailyCap: 10,
      minDelayMs: 800,
      maxDelayMs: 2500,
    },
  };
}

/** Secrets kept separate from settings so they can be encrypted with the vault. */
export interface Secrets {
  llmApiKey: string;
}

export type ApplicationStatus = 'filled' | 'submitted' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';

export interface ApplicationRecord {
  id: string;
  company: string;
  role: string;
  url: string;
  site: string;
  date: string;
  status: ApplicationStatus;
  /** Question label -> answer used. */
  answers: Record<string, string>;
  jobDescription: string;
}
