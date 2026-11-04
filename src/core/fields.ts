// Types shared by the content script (which sees the DOM) and the matcher (which never does).

export type FieldKind =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file';

/** What the matcher is allowed to know about a form field: its question, never the page around it. */
export interface FieldDescriptor {
  id: string;
  label: string;
  kind: FieldKind;
  /** Visible option texts for select, radio groups and checkbox groups. */
  options: string[];
  required: boolean;
  /** The input's name attribute. Helps rules on sites with poor labels. */
  name: string;
}

export type MatchMethod = 'rule' | 'fuzzy' | 'llm' | 'none';

export interface FieldDecision {
  fieldId: string;
  /** Canonical or custom question id this field was matched to, or null. */
  questionId: string | null;
  /** Value to put in the field (for selects and radios, the exact option text). */
  value: string | null;
  confidence: number;
  method: MatchMethod;
  /** fill: confident and we have a value. ask: needs the user. skip: optional field we have nothing for. */
  action: 'fill' | 'ask' | 'skip';
  reason: string;
}
