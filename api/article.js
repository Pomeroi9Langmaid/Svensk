const ALLOWED_HOSTS = new Set([
  'www.svt.se','svt.se',
  'www.kungalv.se','kungalv.se',
  'goteborg.se','www.goteborg.se',
  'www.stenungsund.se','stenungsund.se',
  'www.tjorn.se','tjorn.se'
]);

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findArticleBody(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return '';
  seen.add(value);
  for (const key of ['articleBody', 'description', 'text']) {
    if (typeof value[key] === 'string' && value[key].length > 180) return value[key];
  }
  for (const child of Object.values(value)) {
    const found = findArticleBody(child, seen);
    if (found) return found;
  }
  return '';
}

function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of blocks) {
    try {
      const data = JSON.parse(match[1].trim());
      const body = findArticleBody(data);
      if (body) return body;
    } catch {}
  }
  return '';
}

function fallbackParagraphs(html) {
  const main = (html.match(/<(article|main)[^>]*>[\s\S]*?<\/\1>/i) || [])[0] || html;
  const paragraphs = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => decodeHtml(match[1]))
    .filter(paragraph => paragraph.length > 35)
    .filter(paragraph => !/cookie|javascript|integritet|personuppgifter|kontakta oss|hjälpte informationen|allmän handling/i.test(paragraph));
  return [...new Set(paragraphs)].slice(0, 45).join('\n\n');
}

module.exports = async (req, res) => {
  try {
    const url = new URL(String(req.query?.url || ''));
    if (!ALLOWED_HOSTS.has(url.hostname)) return res.status(400).json({ error: 'Unsupported source' });
    const response = await fetch(url.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 SvenskaNaraReader/1.0' } });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    const html = await response.text();
    const body = extractJsonLd(html) || fallbackParagraphs(html);
    if (!body) return res.status(422).json({ error: 'Article text unavailable' });
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ body, source: url.hostname });
  } catch (error) {
    console.error('[api/article] failed', String(error));
    return res.status(500).json({ error: 'Could not load article' });
  }
};