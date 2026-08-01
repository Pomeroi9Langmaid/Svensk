const SOURCES = [
  { name: 'Kungälvs kommun', url: 'https://www.kungalv.se/kommun--politik/nyheter/', region: 'Kungälv & Marstrand', type: 'kungalv' },
  { name: 'Göteborgs Stad', url: 'https://goteborg.se/wps/wcm/connect/Portal%20Site/Aktuellt/?cmpntname=goteborg-design%2Faktuellt%2Faktuelltarkiv-rss-lank&source=library&srv=cmpnt', region: 'Göteborg', type: 'rss' },
  { name: 'Stenungsunds kommun', url: 'https://www.stenungsund.se/4.1ba6a58519047c931db181d6/12.1ba6a58519047c931db181e2.portlet?state=rss&sv.contenttype=text%2Fxml%3Bcharset%3DUTF-8', region: 'Stenungsund & Tjörn', type: 'rss' },
  { name: 'Tjörns kommun', url: 'https://www.tjorn.se/4.62e5211e171ac42ce6c35126/12.62e5211e171ac42ce6c35174.portlet?state=rss&sv.contenttype=text%2Fxml%3Bcharset%3DUTF-8', region: 'Stenungsund & Tjörn', type: 'rss' },
  { name: 'SVT Nyheter Väst', url: 'https://www.svt.se/nyheter/lokalt/vast/rss.xml', region: 'Västsverige', type: 'rss' },
  { name: 'SVT Nyheter', url: 'https://www.svt.se/nyheter/rss.xml', region: 'Sverige', type: 'rss' }
];

function decodeEntity(match, dec, hex) {
  const code = dec ? Number(dec) : parseInt(hex, 16);
  return Number.isFinite(code) ? String.fromCodePoint(code) : match;
}

function decode(value = '') {
  let text = String(value);
  for (let i = 0; i < 3; i += 1) {
    text = text
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/&#(\d+);/g, decodeEntity)
      .replace(/&#x([0-9a-f]+);/gi, decodeEntity)
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#39;/gi, "'")
      .replace(/&aring;/gi, 'å').replace(/&Aring;/g, 'Å')
      .replace(/&auml;/gi, 'ä').replace(/&Auml;/g, 'Ä')
      .replace(/&ouml;/gi, 'ö').replace(/&Ouml;/g, 'Ö')
      .replace(/&eacute;/gi, 'é')
      .replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
  }
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tag(block, names) {
  for (const name of [].concat(names)) {
    const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return decode(match[1]);
  }
  return '';
}

function linkFrom(block) {
  const direct = tag(block, 'link');
  if (/^https?:/i.test(direct)) return direct;
  const href = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
  return decode(href || '');
}

function tidy(text, max) {
  const clean = decode(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max).replace(/\s+\S*$/, '');
  return `${cut}…`;
}

function parseFeed(xml, source) {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  return blocks.slice(0, 14).map((block, index) => ({
    id: `${source.name}-${index}-${tag(block, ['pubDate', 'updated', 'published'])}`,
    title: tidy(tag(block, 'title'), 120),
    description: tidy(tag(block, ['description', 'summary', 'content']), 280),
    link: linkFrom(block),
    published: tag(block, ['pubDate', 'updated', 'published']) || new Date().toISOString(),
    source: source.name,
    region: source.region
  })).filter(item => item.title && item.link);
}

function absoluteUrl(base, href) {
  try { return new URL(href, base).toString(); } catch { return ''; }
}

function parseKungalv(html, source) {
  const results = [];
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) && results.length < 12) {
    const href = match[1];
    if (!/nyheter|aktuellt/i.test(href) || /kommun--politik\/nyheter\/?$/i.test(href)) continue;
    const link = absoluteUrl(source.url, href);
    if (!link || results.some(item => item.link === link)) continue;

    const inner = match[2];
    const headingHtml = inner.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]
      || inner.match(/<(strong|span)[^>]*class=["'][^"']*(title|heading)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i)?.[3]
      || '';
    let title = decode(headingHtml);
    const fullText = decode(inner);
    if (!title) title = fullText.split(/(?<=[.!?])\s+/)[0];
    title = tidy(title, 105);
    if (!title || title.length < 8) continue;

    const remaining = fullText.startsWith(title.replace(/…$/, ''))
      ? fullText.slice(title.replace(/…$/, '').length).trim()
      : '';
    const nearby = html.slice(pattern.lastIndex, pattern.lastIndex + 900);
    const nearbyParagraph = decode(nearby.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
    const description = tidy(remaining || nearbyParagraph, 240);

    results.push({
      id: `${source.name}-${results.length}-${link}`,
      title,
      description,
      link,
      published: new Date().toISOString(),
      source: source.name,
      region: source.region
    });
  }
  return results;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  const results = await Promise.allSettled(SOURCES.map(async source => {
    const response = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0 SvenskaNara/1.0' } });
    if (!response.ok) throw new Error(`${source.name}: ${response.status}`);
    const text = await response.text();
    return source.type === 'kungalv' ? parseKungalv(text, source) : parseFeed(text, source);
  }));
  results.forEach((result, index) => {
    if (result.status === 'rejected') console.error('[api/news] source failed', SOURCES[index].name, String(result.reason));
  });
  const news = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  res.status(200).json({ news, updatedAt: new Date().toISOString(), sources: SOURCES.map(source => source.name) });
};