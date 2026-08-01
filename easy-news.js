(async function(){
  const host=document.querySelector('#newsView');
  const anchor=document.querySelector('#newsSections');
  if(!host||!anchor)return;

  const section=document.createElement('section');
  section.className='easy-news panel';
  section.innerHTML=`
    <div class="easy-head">
      <div>
        <p class="eyebrow">LÄTTAST IDAG</p>
        <h2>Starta här</h2>
        <p class="easy-intro">Förstå först vad nyheten handlar om. Välj sedan om du vill läsa mer på svenska.</p>
      </div>
      <button id="toggleEasyEnglish" class="easy-toggle" type="button">Dölj engelska</button>
    </div>
    <div id="easyNewsList" class="easy-list"><p class="muted">Hämtar lättare nyheter…</p></div>`;
  host.insertBefore(section,anchor);

  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const firstSentence=s=>(clean(s).match(/^[^.!?]+[.!?]?/)||[''])[0].trim();
  const score=item=>{
    const text=`${item.title} ${item.description}`;
    const words=clean(text).split(/\s+/).filter(Boolean);
    const long=words.filter(w=>w.length>10).length;
    const punctuation=(text.match(/[,:;()]/g)||[]).length;
    return words.length+long*3+punctuation*2;
  };
  async function translateMany(items){
    const text=items.map((item,i)=>`[${i+1}] ${item.title}`).join('\n');
    try{
      const response=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
      const data=await response.json();
      if(!response.ok||!data.translation)throw new Error();
      const lines=data.translation.split(/\n+/).map(line=>line.replace(/^\[?\d+\]?\s*/,'').trim()).filter(Boolean);
      return items.map((_,i)=>lines[i]||'');
    }catch{return items.map(()=>"")}
  }
  try{
    const response=await fetch('/api/news',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok||!Array.isArray(data.news))throw new Error();
    const preferred=data.news
      .filter(item=>['Kungälv & Marstrand','Göteborg','Stenungsund & Tjörn','Västsverige'].includes(item.region))
      .filter(item=>item.title&&item.description)
      .sort((a,b)=>score(a)-score(b))
      .slice(0,6);
    const english=await translateMany(preferred);
    document.querySelector('#easyNewsList').innerHTML=preferred.map((item,i)=>`
      <article class="easy-card">
        <div class="easy-badge">LÄTT</div>
        <div class="easy-content">
          <small>${esc(item.source)}</small>
          <h3>${esc(item.title)}</h3>
          <p class="easy-english">${esc(english[i]||'English meaning unavailable')}</p>
          <p class="easy-swedish"><strong>Enkelt:</strong> ${esc(firstSentence(item.description))}</p>
          <button type="button" data-easy-news="${encodeURIComponent(JSON.stringify(item))}">Läs nyheten</button>
        </div>
      </article>`).join('');
    document.querySelectorAll('[data-easy-news]').forEach(button=>{
      button.onclick=()=>openArticle(JSON.parse(decodeURIComponent(button.dataset.easyNews)));
    });
  }catch{
    document.querySelector('#easyNewsList').innerHTML='<p class="muted">De lättare nyheterna kunde inte laddas just nu.</p>';
  }

  document.querySelector('#toggleEasyEnglish').onclick=event=>{
    section.classList.toggle('hide-english');
    event.currentTarget.textContent=section.classList.contains('hide-english')?'Visa engelska':'Dölj engelska';
  };
})();
