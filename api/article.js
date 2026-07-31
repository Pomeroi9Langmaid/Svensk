const ALLOWED_HOSTS=new Set(['www.svt.se','svt.se']);
function decodeHtml(s=''){return s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
function findArticleBody(value,seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value))return'';seen.add(value);
  if(typeof value.articleBody==='string'&&value.articleBody.length>150)return value.articleBody;
  for(const child of Object.values(value)){const found=findArticleBody(child,seen);if(found)return found}
  return'';
}
function extractJsonLd(html){
  const blocks=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for(const match of blocks){try{const data=JSON.parse(match[1].trim());const body=findArticleBody(data);if(body)return body}catch{}}
  return'';
}
function fallbackParagraphs(html){
  const article=(html.match(/<article[\s\S]*?<\/article>/i)||[])[0]||html;
  return [...article.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>decodeHtml(m[1])).filter(p=>p.length>35&&!/cookie|javascript|integritet/i.test(p)).slice(0,40).join('\n\n');
}
module.exports=async(req,res)=>{
  try{
    const url=new URL(req.query.url);
    if(!ALLOWED_HOSTS.has(url.hostname))return res.status(400).json({error:'Unsupported source'});
    const response=await fetch(url.toString(),{headers:{'User-Agent':'Mozilla/5.0 SvenskaNaraReader/1.0'}});
    if(!response.ok)throw new Error(`Source returned ${response.status}`);
    const html=await response.text();
    const body=extractJsonLd(html)||fallbackParagraphs(html);
    if(!body)return res.status(422).json({error:'Article text unavailable'});
    res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({body,source:url.hostname});
  }catch(error){res.status(500).json({error:'Could not load article'})}
};