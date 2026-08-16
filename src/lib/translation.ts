import { config } from './config';
import { languageName } from './languages';

export class TranslationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}

export interface Translator {
  translateTexts(texts: string[], targetLang: string): Promise<string[]>;
}

class MockTranslator implements Translator {
  async translateTexts(texts: string[], targetLang: string): Promise<string[]> {
    const name = languageName(targetLang);
    return texts.map((t) => (t ? `[${name}] ${t}` : ''));
  }
}

// DeepL uses uppercase codes and a subset of languages.
const DEEPL_CODES: Record<string, string> = {
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
  pt: 'PT',
  nl: 'NL',
  pl: 'PL',
  uk: 'UK',
  ru: 'RU',
  ar: 'AR',
  he: 'HE',
  tr: 'TR',
  'zh-Hans': 'ZH',
  'zh-Hant': 'ZH-HANT',
  ja: 'JA',
  ko: 'KO',
  id: 'ID',
  el: 'EL',
  cs: 'CS',
  ro: 'RO',
  hu: 'HU',
  sv: 'SV',
  da: 'DA',
  fi: 'FI',
  no: 'NB',
  sk: 'SK',
  bg: 'BG',
  lt: 'LT',
  lv: 'LV',
  et: 'ET',
  sl: 'SL',
};

class DeepLTranslator implements Translator {
  async translateTexts(texts: string[], targetLang: string): Promise<string[]> {
    const code = DEEPL_CODES[targetLang];
    if (!code) {
      throw new TranslationError(
        'UNSUPPORTED_LANGUAGE',
        `DeepL does not support ${languageName(targetLang)} (${targetLang}).`,
      );
    }
    const body = new URLSearchParams();
    for (const t of texts) body.append('text', t);
    body.set('target_lang', code);

    const res = await fetch(`${config.translation.deeplBaseUrl}/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${config.translation.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (res.status === 429) throw new TranslationError('RATE_LIMIT', 'DeepL rate limit reached. Please retry shortly.');
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new TranslationError('TRANSLATION_FAILED', `DeepL error: ${detail}`);
    }
    const data = await res.json();
    const list: any[] = Array.isArray(data.translations) ? data.translations : [];
    return list.map((t) => String(t.text ?? ''));
  }
}

const GOOGLE_CODES: Record<string, string> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  he: 'iw',
  no: 'no',
};

class GoogleTranslator implements Translator {
  async translateTexts(texts: string[], targetLang: string): Promise<string[]> {
    const target = GOOGLE_CODES[targetLang] ?? targetLang;
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      config.translation.googleApiKey ?? '',
    )}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, target, format: 'text' }),
    });

    if (res.status === 429) throw new TranslationError('RATE_LIMIT', 'Google Translate rate limit reached. Please retry shortly.');
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new TranslationError('TRANSLATION_FAILED', `Google Translate error: ${detail}`);
    }
    const data = await res.json();
    const list: any[] = Array.isArray(data.data?.translations) ? data.data.translations : [];
    return list.map((t) => String(t.translatedText ?? ''));
  }
}

export function createTranslator(): Translator {
  const provider = config.translation.provider;
  if (provider === 'deepl' && config.translation.apiKey) return new DeepLTranslator();
  if (provider === 'google' && config.translation.googleApiKey) return new GoogleTranslator();
  return new MockTranslator();
}
