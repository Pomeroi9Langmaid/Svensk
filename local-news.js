(async function loadHyperlocalNews(){
  const target=(id,items)=>{
    const el=document.getElementById(id);if(!el)return;
    if(!items.length){el.innerHTML='<p class="muted">Inga aktuella nyheter kunde hämtas från den här källan just nu.</p>';return;}
    el.innerHTML=items.slice(0,8).map(item=>`<article class="news-card hyperlocal-card"><small>${esc(item.source)} · ${new Date(item.published).toLocaleDateString('sv-SE')}</small><h3>${esc(item.title)}</h3><p>${esc(item.description||'')}</p><button type="button" class="open-local">Läs inne på Svenska Nära →</button></article>`).join('');
    [...el.querySelectorAll('.hyperlocal-card')].forEach((card,index)=>{card.onclick=()=>openNews(items[index])});
  };
  try{
    const response=await fetch('/api/news',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok||!Array.isArray(data.news))throw new Error('News unavailable');
    target('kungalvNews',data.news.filter(item=>item.region==='Kungälv & Marstrand'));
    target('gothenburgNews',data.news.filter(item=>item.region==='Göteborg'));
    target('coastNews',data.news.filter(item=>item.region==='Stenungsund & Tjörn'));
    target('westNews',data.news.filter(item=>item.region==='Västsverige'));
    target('nationalNews',data.news.filter(item=>item.region==='Sverige'));
  }catch(error){
    ['kungalvNews','gothenburgNews','coastNews','westNews','nationalNews'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='<p class="muted">Nyhetsflödet kunde inte laddas just nu.</p>'});
  }
})();