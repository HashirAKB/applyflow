import { describe, expect, it } from 'vitest';
import { redactTree, scrubText, secretsFrom } from '../../src/core/redact';

const secrets = secretsFrom({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', answers: [{ value: '42 LPA' }], city: 'London' });

describe('redaction', () => {
  it('scrubs profile values, emails, phones and long numbers', () => {
    expect(scrubText('Hi Ada Lovelace (ada@example.com, +44 20 7946 0000), London, id 1234567', secrets)).toBe(
      'Hi [redacted] [redacted] ([redacted], [phone]), [redacted], id [number]',
    );
    expect(scrubText('other@mail.com', secrets)).toBe('[email]');
    expect(scrubText('Expected CTC: 42 LPA', secrets)).toBe('Expected CTC: [redacted]');
  });

  it('removes values, scripts and unknown attributes but keeps structure and labels', () => {
    document.body.innerHTML = `
      <form action="/apply?token=abc">
        <label for="n">First name</label><input id="n" name="first" value="Ada" data-applyflow="filled 95%" data-applyflow-id="af-1" onclick="x()">
        <textarea name="cl">Dear team, I am Ada Lovelace</textarea>
        <select name="c"><option selected>London</option><option>Paris</option></select>
        <div contenteditable="true">secret answer</div>
        <span class="user-name">Ada Lovelace</span>
        <img src="https://cdn/profile.jpg"><script>var token = 1</script>
      </form>`;
    const form = document.querySelector('form')!.cloneNode(true) as HTMLFormElement;
    redactTree(form, secrets);
    const html = form.outerHTML;
    expect(html).not.toMatch(/Ada|Lovelace|London|secret answer|token|onclick|profile\.jpg/);
    expect(html).not.toContain('data-applyflow');
    expect(html).toContain('First name');
    expect(html).toContain('name="first"');
    expect(html).toContain('<option>Paris</option>');
    expect(html).toContain('action="/apply"');
  });
});
