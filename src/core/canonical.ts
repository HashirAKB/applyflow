// Catalogue of canonical questions. Every form field is mapped to one of these (or to a custom
// question the user taught us). Profile-backed questions read from the profile; the rest read
// from the answer bank. Patterns run against the normalised label (see text.normalize).

import type { Profile } from './types';

export type Category =
  | 'contact'
  | 'links'
  | 'work'
  | 'compensation'
  | 'logistics'
  | 'eligibility'
  | 'education'
  | 'eeo'
  | 'documents'
  | 'consent'
  | 'free-text'
  | 'other';

export interface CanonicalQuestion {
  id: string;
  label: string;
  category: Category;
  /** Other common phrasings, used by fuzzy matching. */
  synonyms: string[];
  /** High-precision rules. First match wins, so order in CATALOGUE matters. */
  patterns: RegExp[];
  /** Where the value comes from. */
  source: 'profile' | 'answer' | 'resume' | 'generate';
  profile?: (p: Profile) => string;
}

const current = (p: Profile) => p.experience[0];

export const CATALOGUE: CanonicalQuestion[] = [
  // Consent first: "privacy notice" must not be read as a notice period.
  {
    id: 'privacy_consent',
    label: 'Consent to data processing / privacy policy',
    category: 'consent',
    synonyms: ['i agree to the privacy policy', 'consent to processing of personal data', 'gdpr consent'],
    patterns: [/\b(privacy|gdpr|data processing|personal data|candidate privacy)\b/, /\bi (agree|consent|acknowledge)\b/],
    source: 'answer',
  },
  // Specific compensation questions before generic ones.
  {
    id: 'expected_ctc',
    label: 'Expected salary / CTC',
    category: 'compensation',
    synonyms: ['expected compensation', 'desired salary', 'salary expectations', 'expected annual salary', 'target compensation'],
    patterns: [/\b(expected|desired|target|expectation|expectations|asking)\b.*\b(salary|ctc|compensation|pay|package)\b/, /\b(salary|compensation|pay)\b.*\b(expect|expectation|expectations|requirement|requirements)\b/],
    source: 'answer',
  },
  {
    id: 'current_ctc',
    label: 'Current salary / CTC',
    category: 'compensation',
    synonyms: ['current compensation', 'current annual salary', 'present salary', 'current package'],
    patterns: [/\b(current|present|existing|last drawn)\b.*\b(salary|ctc|compensation|pay|package)\b/, /^ctc$/],
    source: 'answer',
  },
  {
    id: 'notice_period',
    label: 'Notice period',
    category: 'logistics',
    synonyms: ['how soon can you join', 'notice period in days', 'serving notice period'],
    patterns: [/\bnotice\b/, /how soon can you (join|start)/],
    source: 'answer',
  },
  {
    id: 'start_date',
    label: 'Earliest start date',
    category: 'logistics',
    synonyms: ['when can you start', 'available start date', 'date available', 'availability to start'],
    patterns: [/\b(start date|starting date|date available|available to start|availability date|when can you start|earliest .*start|join date|joining date)\b/],
    source: 'answer',
  },
  {
    id: 'requires_sponsorship',
    label: 'Requires visa sponsorship',
    category: 'eligibility',
    synonyms: ['will you now or in the future require sponsorship', 'need visa sponsorship', 'require work permit sponsorship'],
    patterns: [/\bsponsor/, /\bvisa\b.*\b(require|need)/, /\b(require|need)\b.*\bvisa\b/],
    source: 'answer',
  },
  {
    id: 'work_authorization',
    label: 'Legally authorised to work',
    category: 'eligibility',
    synonyms: ['are you legally authorized to work in this country', 'work permit', 'right to work', 'eligible to work'],
    patterns: [/\b(authori[sz]ed|authori[sz]ation|eligible|eligibility|right|permit(ted)?)\b.*\bwork\b/, /\bwork (permit|authori[sz]ation|visa)\b/, /\bright to work\b/],
    source: 'answer',
  },
  {
    id: 'willing_to_relocate',
    label: 'Willing to relocate',
    category: 'logistics',
    synonyms: ['open to relocation', 'relocate for this role', 'move to the office location'],
    patterns: [/\brelocat/],
    source: 'answer',
  },
  {
    id: 'willing_to_travel',
    label: 'Willing to travel',
    category: 'logistics',
    synonyms: ['comfortable with travel', 'travel requirements'],
    patterns: [/\btravel\b/],
    source: 'answer',
  },
  {
    id: 'work_mode',
    label: 'Remote / hybrid / onsite preference',
    category: 'logistics',
    synonyms: ['comfortable working from the office', 'work model preference', 'able to work onsite'],
    patterns: [/\b(remote|hybrid|on ?site|in office|in person|from the office|work model|work arrangement|commut(e|ing))\b/],
    source: 'answer',
  },
  {
    id: 'total_experience',
    label: 'Total years of experience',
    category: 'work',
    synonyms: ['total work experience', 'overall experience in years', 'years of professional experience', 'how many years of experience do you have'],
    patterns: [
      /\b(total|overall|professional|relevant|industry)\b.*\b(experience|exp|years)\b/,
      /^(years of experience|experience in years|experience years|work experience years|yoe)$/,
      /^how many years of (work |professional )?experience do you have$/,
    ],
    source: 'answer',
  },
  {
    id: 'highest_education',
    label: 'Highest level of education',
    category: 'education',
    synonyms: ['highest degree', 'education level', 'highest qualification'],
    patterns: [/\b(highest|level of)\b.*\b(education|degree|qualification)\b/, /\beducation level\b/],
    source: 'answer',
  },
  {
    id: 'school',
    label: 'School / university',
    category: 'education',
    synonyms: ['university', 'college', 'institution', 'school name'],
    patterns: [/^(school|university|college|institution|school name|university name|college name|name of (school|university|college|institution))$/],
    source: 'profile',
    profile: (p) => p.education[0]?.school ?? '',
  },
  {
    id: 'degree',
    label: 'Degree',
    category: 'education',
    synonyms: ['degree obtained', 'qualification'],
    patterns: [/^(degree|degree name|degree type|qualification)$/],
    source: 'profile',
    profile: (p) => p.education[0]?.degree ?? '',
  },
  {
    id: 'field_of_study',
    label: 'Field of study / discipline',
    category: 'education',
    synonyms: ['major', 'discipline', 'specialisation'],
    patterns: [/\b(field of study|discipline|major|speciali[sz]ation)\b/],
    source: 'profile',
    profile: (p) => p.education[0]?.field ?? '',
  },
  {
    id: 'graduation_year',
    label: 'Graduation year',
    category: 'education',
    synonyms: ['year of graduation', 'year of passing'],
    patterns: [/\b(graduation|graduated|passing out|year of passing)\b/],
    source: 'profile',
    profile: (p) => (p.education[0]?.end ?? '').match(/\d{4}/)?.[0] ?? '',
  },
  {
    id: 'how_heard',
    label: 'How did you hear about us',
    category: 'other',
    synonyms: ['source', 'where did you find this job', 'referral source'],
    patterns: [/\bhow did you (hear|find|learn|come across)\b/, /\bwhere did you (hear|find|see|learn)\b/, /^(source|referral source|job source)$/],
    source: 'answer',
  },
  {
    id: 'referral',
    label: 'Referred by an employee',
    category: 'work',
    synonyms: ['employee referral', 'who referred you'],
    patterns: [/\brefer(red|ral|rer)\b/],
    source: 'answer',
  },
  {
    id: 'previously_employed',
    label: 'Previously worked at this company',
    category: 'work',
    synonyms: ['have you worked here before', 'former employee', 'ever been employed by'],
    patterns: [/\b(previously|ever|before|former)\b.*\b(work|worked|employed|employee)\b/, /\b(worked|employed)\b.*\b(before|previously)\b/],
    source: 'answer',
  },
  {
    id: 'age_over_18',
    label: 'At least 18 years old',
    category: 'eligibility',
    synonyms: ['are you over 18', 'legal working age'],
    patterns: [/\b(18|eighteen)\b.*\b(years|older|age)\b/, /\b(over|at least|above)\b.*\b(18|eighteen)\b/, /\blegal (working )?age\b/],
    source: 'answer',
  },
  {
    id: 'background_check',
    label: 'Willing to undergo a background check',
    category: 'eligibility',
    synonyms: ['consent to background verification', 'background screening'],
    patterns: [/\bbackground (check|verification|screening|investigation)\b/],
    source: 'answer',
  },
  {
    id: 'security_clearance',
    label: 'Security clearance',
    category: 'eligibility',
    synonyms: ['active clearance', 'government clearance'],
    patterns: [/\bclearance\b/],
    source: 'answer',
  },
  {
    id: 'languages',
    label: 'Languages spoken',
    category: 'work',
    synonyms: ['which languages do you speak', 'language proficiency'],
    patterns: [/\blanguages? (do you speak|spoken|proficiency|known)\b/, /\b(speak|fluent in|fluency)\b/],
    source: 'answer',
  },
  {
    id: 'gender',
    label: 'Gender (EEO, optional)',
    category: 'eeo',
    synonyms: ['gender identity', 'sex'],
    patterns: [/\b(gender|sex)\b/],
    source: 'answer',
  },
  {
    id: 'pronouns',
    label: 'Pronouns',
    category: 'eeo',
    synonyms: ['preferred pronouns'],
    patterns: [/\bpronoun/],
    source: 'answer',
  },
  {
    id: 'hispanic_latino',
    label: 'Hispanic or Latino (EEO, optional)',
    category: 'eeo',
    synonyms: ['are you hispanic or latino'],
    patterns: [/\bhispanic\b|\blatin[oax]\b/],
    source: 'answer',
  },
  {
    id: 'race_ethnicity',
    label: 'Race / ethnicity (EEO, optional)',
    category: 'eeo',
    synonyms: ['ethnic background', 'race'],
    patterns: [/\b(race|ethnicity|ethnic)\b/],
    source: 'answer',
  },
  {
    id: 'veteran_status',
    label: 'Veteran status (EEO, optional)',
    category: 'eeo',
    synonyms: ['protected veteran', 'military service'],
    patterns: [/\bveteran\b|\bmilitary\b|\barmed forces\b/],
    source: 'answer',
  },
  {
    id: 'disability_status',
    label: 'Disability status (EEO, optional)',
    category: 'eeo',
    synonyms: ['do you have a disability', 'disability self identification'],
    patterns: [/\bdisabilit/],
    source: 'answer',
  },
  // Contact and links come after the more specific questions above ("name of your referrer" is not your name).
  {
    id: 'first_name',
    label: 'First name',
    category: 'contact',
    synonyms: ['given name', 'forename'],
    patterns: [/^(first|given|fore) ?name$/, /^(legal )?first name\b/],
    source: 'profile',
    profile: (p) => p.firstName,
  },
  {
    id: 'last_name',
    label: 'Last name',
    category: 'contact',
    synonyms: ['surname', 'family name'],
    patterns: [/^(last|family|sur) ?name$/, /^(legal )?last name\b/, /^surname$/],
    source: 'profile',
    profile: (p) => p.lastName,
  },
  {
    id: 'preferred_name',
    label: 'Preferred name',
    category: 'contact',
    synonyms: ['nickname', 'name you go by'],
    patterns: [/\b(preferred|nick)\b.*\bname\b/, /\bname (do )?you(d)? (go by|prefer)\b/],
    source: 'profile',
    profile: (p) => p.firstName,
  },
  {
    id: 'full_name',
    label: 'Full name',
    category: 'contact',
    synonyms: ['name', 'your name', 'candidate name', 'legal name'],
    patterns: [/^(full |your |candidate |legal |applicant )?name$/, /^full (legal )?name\b/],
    source: 'profile',
    profile: (p) => [p.firstName, p.lastName].filter(Boolean).join(' '),
  },
  {
    id: 'email',
    label: 'Email',
    category: 'contact',
    synonyms: ['email address', 'e-mail'],
    patterns: [/\be ?mail\b/],
    source: 'profile',
    profile: (p) => p.email,
  },
  {
    id: 'phone',
    label: 'Phone',
    category: 'contact',
    synonyms: ['phone number', 'mobile number', 'contact number', 'telephone'],
    patterns: [/\b(phone|mobile|cell|telephone|contact number|whatsapp)\b/],
    source: 'profile',
    profile: (p) => p.phone,
  },
  {
    id: 'postal_code',
    label: 'Postal / ZIP code',
    category: 'contact',
    synonyms: ['zip code', 'pin code', 'postcode'],
    patterns: [/\b(zip|postal|post code|postcode|pin ?code)\b/],
    source: 'answer',
  },
  {
    id: 'city',
    label: 'City',
    category: 'contact',
    synonyms: ['current city', 'town'],
    patterns: [/^(current )?(city|town)$/, /\bcity\b/],
    source: 'profile',
    profile: (p) => p.city,
  },
  {
    id: 'country',
    label: 'Country',
    category: 'contact',
    synonyms: ['country of residence'],
    patterns: [/^country$/, /\bcountry (of residence|you live in|are you (based|located|living) in)\b/, /^(current )?country\b/],
    source: 'profile',
    profile: (p) => p.country,
  },
  {
    id: 'location',
    label: 'Current location',
    category: 'contact',
    synonyms: ['where are you based', 'location', 'address'],
    patterns: [/\blocation\b/, /\bwhere (are you|do you) (based|live|located)\b/, /\b(home |current )?address\b/],
    source: 'profile',
    profile: (p) => p.location || [p.city, p.country].filter(Boolean).join(', '),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn profile',
    category: 'links',
    synonyms: ['linkedin url'],
    patterns: [/\blinked ?in\b/],
    source: 'profile',
    profile: (p) => p.linkedin,
  },
  {
    id: 'github',
    label: 'GitHub profile',
    category: 'links',
    synonyms: ['github url', 'git hub'],
    patterns: [/\bgit ?hub\b/],
    source: 'profile',
    profile: (p) => p.github,
  },
  {
    id: 'website',
    label: 'Website / portfolio',
    category: 'links',
    synonyms: ['portfolio url', 'personal website', 'blog'],
    patterns: [/\b(website|portfolio|personal site|blog|homepage)\b/, /^(other )?(url|link)$/],
    source: 'profile',
    profile: (p) => p.website,
  },
  {
    id: 'current_company',
    label: 'Current company',
    category: 'work',
    synonyms: ['current employer', 'present organisation', 'most recent company'],
    // Anchored: long questions that merely mention "your current employer" are not this question.
    patterns: [/^(name of )?(your )?(current|present|most recent|latest) (company|employer|organi[sz]ation)( name)?$/, /^(company|employer)( name)?$/],
    source: 'profile',
    profile: (p) => current(p)?.company ?? '',
  },
  {
    id: 'current_title',
    label: 'Current job title',
    category: 'work',
    synonyms: ['current role', 'current designation', 'present position'],
    patterns: [
      /^(your )?(current|present|most recent|latest) (job )?(title|role|designation|position)$/,
      /^(job )?title at (your )?(current|present|most recent|latest) (position|role|company|job|employer)$/,
      /^(job title|title|designation)$/,
    ],
    source: 'profile',
    profile: (p) => current(p)?.title ?? '',
  },
  {
    id: 'resume',
    label: 'Resume / CV',
    category: 'documents',
    synonyms: ['upload resume', 'curriculum vitae', 'attach cv'],
    patterns: [/\b(resume|cv|curriculum vitae)\b/],
    source: 'resume',
  },
  {
    id: 'cover_letter',
    label: 'Cover letter',
    category: 'free-text',
    synonyms: ['motivation letter', 'letter of motivation'],
    patterns: [/\b(cover|motivation(al)?) letter\b/],
    source: 'generate',
  },
  {
    id: 'why_company',
    label: 'Why do you want to work here',
    category: 'free-text',
    synonyms: ['why are you interested in this role', 'what excites you about this position', 'why us'],
    patterns: [/\bwhy (do you want|are you interested|would you like|this company|us|join)\b/, /\b(interest(s|ed)? you|excites you|attracted you|motivates you)\b.*\b(role|position|company|team|us|job)\b/],
    source: 'generate',
  },
];

/** "How many years of experience do you have with React?" -> years_skill:react */
const YEARS_SKILL = /\byears?\b.*\b(?:experience|exp|worked|working)\b.*\b(?:with|in|using|of|on)\s+([a-z0-9+#. ]{1,40}?)\s*$/;
const YEARS_SKILL_2 = /^(?:years of|yrs of)\s+([a-z0-9+#. ]{1,40}?)\s+(?:experience|exp)$/;
const YEARS_SKILL_3 = /\bhow many years (?:have you|of)\s+(?:used|worked with|been using|coded in)\s+([a-z0-9+#. ]{1,40}?)\s*$/;

export function yearsSkillId(normalisedLabel: string): string | null {
  const m = normalisedLabel.match(YEARS_SKILL) ?? normalisedLabel.match(YEARS_SKILL_2) ?? normalisedLabel.match(YEARS_SKILL_3);
  if (!m) return null;
  const skill = m[1].replace(/\b(the|a|an|professional|commercial|hands on)\b/g, '').trim();
  if (!skill || /^(experience|work|industry|total|relevant)$/.test(skill)) return null;
  return `years_skill:${skill.replace(/\s+/g, '-')}`;
}

export const BY_ID = new Map(CATALOGUE.map((q) => [q.id, q]));

export function questionLabel(id: string): string {
  if (BY_ID.has(id)) return BY_ID.get(id)!.label;
  if (id.startsWith('years_skill:')) return `Years of experience with ${id.slice(12).replace(/-/g, ' ')}`;
  if (id.startsWith('custom:')) return id.slice(7).replace(/-/g, ' ');
  return id;
}
