import { describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { detectFields, findBlockers } from '../../src/content/detect';
import { fillCombobox, fillField, setText } from '../../src/content/fill';
import { generic } from '../../src/content/adapters/generic';
import { matchOption } from '../../src/core/options';

function load(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

const labels = (doc: Document) => detectFields(doc.body).map((f) => f.descriptor.label);

describe('label resolution', () => {
  it('uses for=, wrapping label, aria-label, aria-labelledby, placeholder, nearby text and name', () => {
    const doc = load(`
      <form>
        <label for="a">First name *</label><input id="a">
        <label>Email address <input type="email"></label>
        <input aria-label="Phone number" type="tel">
        <span id="q">Current CTC</span><input aria-labelledby="q">
        <input placeholder="LinkedIn profile URL">
        <div class="field"><div class="question">Notice period?</div><div><input></div></div>
        <input name="job_application[years_of_experience]">
      </form>`);
    expect(labels(doc)).toEqual([
      'First name',
      'Email address',
      'Phone number',
      'Current CTC',
      'LinkedIn profile URL',
      'Notice period?',
      'years of experience',
    ]);
  });

  it('does not include select options in a wrapping label', () => {
    const doc = load(`<label>Country <select><option>India</option><option>Germany</option></select></label>`);
    expect(labels(doc)).toEqual(['Country']);
  });
});

describe('field detection', () => {
  it('detects every kind and groups radios and checkboxes', () => {
    const doc = load(`
      <form>
        <label for="t">Name</label><input id="t" required>
        <label for="ta">Cover letter</label><textarea id="ta"></textarea>
        <label for="s">Country</label><select id="s"><option value="">Select...</option><option>India</option><option>Germany</option></select>
        <fieldset><legend>Willing to relocate?</legend>
          <label><input type="radio" name="reloc" value="1"> Yes</label>
          <label><input type="radio" name="reloc" value="0"> No</label>
        </fieldset>
        <fieldset><legend>Languages</legend>
          <label><input type="checkbox" name="lang" value="en"> English</label>
          <label><input type="checkbox" name="lang" value="de"> German</label>
        </fieldset>
        <label><input type="checkbox" name="consent"> I agree to the privacy policy</label>
        <label for="f">Resume</label><input id="f" type="file" style="display:none">
      </form>`);
    const fields = detectFields(doc.body).map((f) => f.descriptor);
    expect(fields.map((f) => [f.label, f.kind])).toEqual([
      ['Name', 'text'],
      ['Cover letter', 'textarea'],
      ['Country', 'select'],
      ['Willing to relocate?', 'radio'],
      ['Languages', 'checkbox'],
      ['I agree to the privacy policy', 'checkbox'],
      ['Resume', 'file'],
    ]);
    expect(fields[0].required).toBe(true);
    expect(fields[2].options).toEqual(['India', 'Germany']);
    expect(fields[3].options).toEqual(['Yes', 'No']);
    expect(fields[4].options).toEqual(['English', 'German']);
  });

  it('never returns passwords, hidden inputs, hidden fields or captcha internals', () => {
    const doc = load(`
      <form>
        <input type="password" aria-label="Password">
        <input type="hidden" name="token">
        <div style="display:none"><input aria-label="Honeypot"></div>
        <div class="g-recaptcha"><textarea aria-label="g-recaptcha-response"></textarea></div>
        <input aria-label="Real field">
      </form>`);
    expect(labels(doc)).toEqual(['Real field']);
    expect(findBlockers(doc)).toEqual(['captcha', 'login']);
  });
});

describe('filling', () => {
  it('updates a React controlled input so React state changes', async () => {
    let seen = '';
    function Form() {
      const [v, setV] = useState('');
      seen = v;
      return <input aria-label="City" value={v} onChange={(e) => setV(e.target.value)} />;
    }
    const host = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(host);
    await act(async () => createRoot(host).render(<Form />));
    const input = host.querySelector('input')!;
    await act(async () => setText(input, 'Bengaluru'));
    expect(seen).toBe('Bengaluru');
    expect(input.value).toBe('Bengaluru');
  });

  it('fires input and change events that bubble', () => {
    const doc = load(`<form><input aria-label="x"></form>`);
    const events: string[] = [];
    doc.querySelector('form')!.addEventListener('input', () => events.push('input'));
    doc.querySelector('form')!.addEventListener('change', () => events.push('change'));
    setText(doc.querySelector('input')!, 'v');
    expect(events).toEqual(['input', 'change']);
  });

  it('selects options, radios and checkbox groups by text and refuses unknown values', async () => {
    const doc = load(`
      <select aria-label="Country"><option value="">Select</option><option value="in">India</option><option value="de">Germany</option></select>
      <fieldset><legend>Authorised to work?</legend>
        <label><input type="radio" name="a"> Yes, I am authorised</label>
        <label><input type="radio" name="a"> No</label></fieldset>
      <fieldset><legend>Languages</legend>
        <label><input type="checkbox" name="l"> English</label>
        <label><input type="checkbox" name="l"> German</label>
        <label><input type="checkbox" name="l"> Hindi</label></fieldset>`);
    const [country, auth, langs] = detectFields(doc.body);
    expect(await fillField(country, 'Germany', null)).toBe(true);
    expect((country.elements[0] as HTMLSelectElement).value).toBe('de');
    expect(await fillField(country, 'Atlantis', null)).toBe(false);
    expect(await fillField(auth, 'Yes', null)).toBe(true);
    expect((auth.elements[0] as HTMLInputElement).checked).toBe(true);
    expect(await fillField(langs, 'English, Hindi', null)).toBe(true);
    expect(langs.elements.map((e) => (e as HTMLInputElement).checked)).toEqual([true, false, true]);
  });

  it('attaches a resume file', async () => {
    const doc = load(`<label for="r">Resume</label><input id="r" type="file">`);
    const [f] = detectFields(doc.body);
    let changed = false;
    f.elements[0].addEventListener('change', () => (changed = true));
    // jsdom lacks DataTransfer; the e2e suite covers the real browser path.
    if (typeof DataTransfer === 'undefined') {
      expect(await fillField(f, 'resume', null)).toBe(false);
      return;
    }
    expect(await fillField(f, 'resume', { name: 'cv.pdf', type: 'application/pdf', base64: btoa('%PDF') })).toBe(true);
    expect(changed).toBe(true);
  });
});

describe('combobox', () => {
  function combobox() {
    const doc = load(`<label id="l">Country</label><input id="country" role="combobox" aria-labelledby="l" aria-controls="menu"><div id="menu"></div>`);
    const input = doc.querySelector('input')!;
    const picked: string[] = [];
    // Minimal widget: renders options matching what was typed, records the clicked one.
    input.addEventListener('input', () => {
      const menu = doc.getElementById('menu')!;
      menu.innerHTML = ['India', 'Indonesia', 'United Kingdom']
        .filter((o) => o.toLowerCase().includes(input.value.toLowerCase()))
        .map((o) => `<div role="option">${o}</div>`)
        .join('');
      menu.querySelectorAll('[role=option]').forEach((o) => o.addEventListener('click', () => picked.push(o.textContent!)));
    });
    return { field: detectFields(doc.body)[0], picked };
  }

  it('types, waits for the widget options and clicks the matching one', async () => {
    const { field, picked } = combobox();
    expect(field.descriptor.kind).toBe('select');
    expect(await fillField(field, 'India', null)).toBe(true);
    expect(picked).toEqual(['India']);
  });

  it('gives up and clears the text when no option matches', async () => {
    const { field, picked } = combobox();
    expect(await fillCombobox(field.elements[0] as HTMLInputElement, 'Atlantis', 300)).toBe(false);
    expect(picked).toEqual([]);
    expect((field.elements[0] as HTMLInputElement).value).toBe('');
  });
});

describe('matchOption', () => {
  it('matches exact, yes/no polarity, containment and fuzzy, and refuses ambiguity', () => {
    expect(matchOption('india', ['Germany', 'India'])).toBe(1);
    expect(matchOption('Yes', ['Yes, I will relocate', 'No, I will not'])).toBe(0);
    expect(matchOption('No', ['Yes, I will relocate', 'No, I will not'])).toBe(1);
    expect(matchOption('India', ['India (+91)', 'Indonesia (+62)'])).toBe(0);
    expect(matchOption('Bachelors degree', ["Bachelor's Degree", "Master's Degree", 'PhD'])).toBe(0);
    expect(matchOption('Senior', ['Junior', 'Mid'])).toBe(-1);
    expect(matchOption('', ['A'])).toBe(-1);
  });
});

describe('generic adapter', () => {
  it('picks the form with the most fields and finds submit and next buttons', () => {
    const doc = load(`
      <h1>Senior Engineer</h1>
      <form id="search"><input aria-label="Search jobs"></form>
      <form id="apply"><input aria-label="Name"><input aria-label="Email"><button type="submit">Submit application</button></form>`);
    const root = generic.formRoot(doc)!;
    expect(root.id).toBe('apply');
    expect(generic.submitButton(root)?.textContent).toBe('Submit application');
    expect(generic.nextButton(root)).toBeNull();
    expect(generic.jobInfo(doc).role).toBe('Senior Engineer');
  });
});
