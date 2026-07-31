function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function chunks(text, max = 900) {
  const output = [];
  let rest = String(text || '').trim();
  while (rest) {
    if (rest.length <= max) { output.push(rest); break; }
    let cut = Math.max(rest.lastIndexOf('. ', max), rest.lastIndexOf(' ', max));
    if (cut < 200) cut = max;
    output.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  return output;
}

async function googleTranslate(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=sv&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error(`Google translation returned ${response.status}`);
  const data = await response.json();
  const translation = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('') : '';
  if (!translation) throw new Error('Empty translation');
  return translation;
}

async function fallbackTranslate(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=sv|en`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fallback translation returned ${response.status}`);
  const data = await response.json();
  const translation = data.responseData?.translatedText || '';
  if (!translation) throw new Error('Empty fallback translation');
  return translation;
}

module.exports = async (req, res) => {
  const body = parseBody(req);
  const text = String(req.method === 'GET' ? req.query?.text || '' : body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Text required' });
  if (text.length > 18000) return res.status(413).json({ error: 'Text too long' });

  console.log('[api/translate] request', { method: req.method, characters: text.length });
  try {
    const translated = [];
    for (const part of chunks(text).slice(0, 24)) {
      try {
        translated.push(await googleTranslate(part));
      } catch (primaryError) {
        console.warn('[api/translate] primary failed', String(primaryError));
        translated.push(await fallbackTranslate(part));
      }
    }
    const translation = translated.join('\n\n').trim();
    if (!translation) throw new Error('No translated text returned');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ translation });
  } catch (error) {
    console.error('[api/translate] failed', String(error));
    return res.status(502).json({ error: 'Translation unavailable' });
  }
};