const SOURCES = [
  { name: 'Kungälvs kommun', url: 'https://www.kungalv.se/kommun--politik/nyheter/', region: 'Kungälv & Marstrand', type: 'kungalv' },
  { name: 'Göteborgs Stad', url: 'https://goteborg.se/wps/wcm/connect/Portal%20Site/Aktuellt/?cmpntname=goteborg-design%2Faktuellt%2Faktuelltarkiv-rss-lank&source=library&srv=cmpnt', region: 'Göteborg', type: 'rss' },
  { name: 'Stenungsunds kommun', url: 'https://www.stenungsund.se/4.1ba6a58519047c931db181d6/12.1ba6a58519047c931db181e2.portlet?state=rss&sv.contenttype=text%2Fxml%3Bcharset%3DUTF-8', region: 'Stenungsund & Tjörn', type: 'rss' },
  { name: 'Tjörns kommun', url: 'https://www.tjorn.se/4.62e5211e171ac42ce6c35126/12.62e5211e171ac42ce6c35174.portlet?state=rss&sv.contenttype=text%2Fxml%3Bcharset%3DUTF-8', region: 'Stenungsund & Tjörn', type: 'rss' },
  { name: 'SVT Nyheter Väst', url: 'https://www.svt.se/nyheter/lokalt/vast/rss.xml', region: 'Västsverige', type: 'rss' },
  { name: 'SVT Nyheter', url: 'https://www.svt.se/nyheter/rss.xml', region: 'Sverige', type: 'rss' }
];

function decode(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function parseFeed(xml, source) {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  return blocks.slice(0, 14).map((block, index) => ({
    id: `${source.name}-${index}-${tag(block, ['pubDate', 'updated', 'published'])}`,
    title: tag(block, 'title'),
    description: tag(block, ['description', 'summary', 'content']),
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
  while ((match = pattern.exec(html)) && results.length < 14) {
    const href = match[1];
    const title = decode(match[2]);
    if (!title || title.length < 12 || title.length > 180) continue;
    if (!/nyheter|aktuellt/i.test(href) || /kommun--politik\/nyheter\/?$/i.test(href)) continue;
    const link = absoluteUrl(source.url, href);
    if (!link || results.some(item => item.link === link)) continue;
    const nearby = html.slice(pattern.lastIndex, pattern.lastIndex + 700);
    const description = decode(nearby.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
    results.push({ id: `${source.name}-${results.length}-${link}`, title, description, link, published: new Date().toISOString(), source: source.name, region: source.region });
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
  results.forEach((result, index) => { if (result.status === 'rejected') console.error('[api/news] source failed', SOURCES[index].name, String(result.reason)); });
  const news = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  res.status(200).json({ news, updatedAt: new Date().toISOString(), sources: SOURCES.map(source => source.name) });
};