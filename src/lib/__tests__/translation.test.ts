import { describe, it, expect } from 'vitest';
import { createTranslator } from '../translation';
import { languageName } from '../languages';

describe('translation workflow', () => {
  it('falls back to the mock translator when no API key is configured', async () => {
    const translator = createTranslator();
    const out = await translator.translateTexts(['Hello', 'World'], 'es');
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('Spanish');
  });

  it('preserves segment order and count (timing is preserved by the caller)', async () => {
    const translator = createTranslator();
    const texts = ['one', 'two', 'three'];
    const out = await translator.translateTexts(texts, 'fr');
    expect(out).toHaveLength(3);
    expect(out[1]).toContain('French');
    expect(out[1]).toContain('two');
  });

  it('preserves empty strings (does not invent content)', async () => {
    const translator = createTranslator();
    const out = await translator.translateTexts(['', 'hello'], 'de');
    expect(out[0]).toBe('');
    expect(out[1]).toContain('German');
  });

  it('supports the full advertised language catalog', () => {
    // The mock supports everything; verify key RTL + CJK codes resolve to names.
    expect(languageName('ar')).toBe('Arabic');
    expect(languageName('he')).toBe('Hebrew');
    expect(languageName('zh-Hans')).toBe('Chinese (Simplified)');
    expect(languageName('ja')).toBe('Japanese');
    expect(languageName('th')).toBe('Thai');
  });
});
