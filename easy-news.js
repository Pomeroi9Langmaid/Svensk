(async function(){
  const host=document.querySelector('#newsView');
  const anchor=document.querySelector('#newsSections');
  if(!host||!anchor)return;

  let visibleCount=6;
  let preferred=[];
  let english=[];

  const section=document.createElement('section');
  section.className='easy-news panel';
  section.innerHTML=`
    <div class="easy-head">
      <div>
        <p class="eyebrow">LÄTTAST IDAG</p>
        <h2>Starta här</h2>
        <p class="easy-intro">Klicka på ett svårt ord. För två eller tre ord: markera hela frasen med musen och tryck på <strong>Spara markerad fras</strong>.</p>
      </div>
      <button id="toggleEasyEnglish" class="easy-toggle" type="button">Dölj engelska</button>
    </div>
    <div id="easyNewsList" class="easy-list"><p class="muted">Hämtar lättare nyheter…</p></div>
    <button id="showMoreEasy" class="show-more-easy hidden" type="button">Visa fler lätta nyheter</button>`;
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

  function bindEasyActions(){
    document.querySelectorAll('[data-easy-news]').forEach(button=>{
      button.onclick=()=>openArticle(JSON.parse(decodeURIComponent(button.dataset.easyNews)));
    });
    document.querySelectorAll('.easy-card [data-click-word]').forEach(word=>{
      word.onclick=event=>{
        event.stopPropagation();
        addWord(decodeURIComponent(word.dataset.clickWord),word.closest('.easy-card')?.dataset.context||'');
      };
      word.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();word.click()}};
    });
    document.querySelectorAll('[data-save-easy-phrase]').forEach(button=>{
      button.onclick=()=>{
        const card=button.closest('.easy-card');
        const selection=window.getSelection();
        const phrase=selection?.toString().replace(/\s+/g,' ').trim()||'';
        if(!phrase){toast('Markera två eller tre ord i kortet först');return}
        if(!card.contains(selection.anchorNode)||!card.contains(selection.focusNode)){toast('Markera orden i samma nyhetskort');return}
        addWord(phrase,card.dataset.context||'');
        selection.removeAllRanges();
      };
    });
  }

  function renderEasy(){
    const list=preferred.slice(0,visibleCount);
    document.querySelector('#easyNewsList').innerHTML=list.map((item,i)=>{
      const simple=firstSentence(item.description);
      return`<article class="easy-card" data-context="${esc(simple||item.title)}">
        <div class="easy-badge">LÄTT</div>
        <div class="easy-content">
          <small>${esc(item.source)}</small>
          <h3 class="easy-clickable">${tokenise(item.title)}</h3>
          <p class="easy-english">${esc(english[i]||'English meaning unavailable')}</p>
          <p class="easy-swedish"><strong>Enkelt:</strong> ${tokenise(simple)}</p>
          <div class="easy-actions">
            <button type="button" data-save-easy-phrase>Spara markerad fras</button>
            <button type="button" data-easy-news="${encodeURIComponent(JSON.stringify(item))}">Läs nyheten</button>
          </div>
        </div>
      </article>`;
    }).join('');
    const more=document.querySelector('#showMoreEasy');
    more.classList.toggle('hidden',visibleCount>=preferred.length);
    bindEasyActions();
  }

  try{
    const response=await fetch('/api/news',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok||!Array.isArray(data.news))throw new Error();
    preferred=data.news
      .filter(item=>['Kungälv & Marstrand','Göteborg','Stenungsund & Tjörn','Västsverige'].includes(item.region))
      .filter(item=>item.title&&item.description)
      .sort((a,b)=>score(a)-score(b))
      .slice(0,18);
    english=await translateMany(preferred);
    renderEasy();
  }catch{
    document.querySelector('#easyNewsList').innerHTML='<p class="muted">De lättare nyheterna kunde inte laddas just nu.</p>';
  }

  document.querySelector('#showMoreEasy').onclick=()=>{visibleCount=Math.min(visibleCount+6,preferred.length);renderEasy()};
  document.querySelector('#toggleEasyEnglish').onclick=event=>{
    section.classList.toggle('hide-english');
    event.currentTarget.textContent=section.classList.contains('hide-english')?'Visa engelska':'Dölj engelska';
  };
})();