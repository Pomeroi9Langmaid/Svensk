const STARTER_WORDS=[
{swedish:'ställa in',english:'cancel',example:'Mötet måste ställas in på grund av ovädret.',status:'learning'},
{swedish:'ta reda på',english:'find out',example:'Jag ska ta reda på när bussen går.',status:'learning'},
{swedish:'hålla med',english:'agree',example:'Jag håller med om att svenska är svårt ibland.',status:'learning'},
{swedish:'på grund av',english:'because of',example:'Tåget är sent på grund av ett tekniskt fel.',status:'learning'},
{swedish:'det visar sig att',english:'it turns out that',example:'Det visar sig att vägen redan är öppen.',status:'learning'}];
const STORIES=[
'Ett möte i Göteborg skulle börja klockan nio, men arrangörerna behövde ställa in det på grund av ett tekniskt problem. Andrew försökte ta reda på vad som hade hänt. Det visar sig att lokalen saknade el. Lisa höll med om att det var bättre att boka en ny dag.',
'Kommunen ville ställa in arbetet på en gata i Majorna på grund av kraftigt regn. En reporter försökte ta reda på när arbetet skulle fortsätta. Det visar sig att arbetet börjar igen på måndag. Många boende håller med om beslutet.',
'Andrew läste en nyhet om ett tåg som hade ställts in på grund av ett signalfel. Han ville ta reda på om ersättningsbussar fanns. Det visar sig att bussarna redan väntade utanför stationen, och de flesta resenärer höll med om att informationen var tydlig.'
];
let words=JSON.parse(localStorage.getItem('svenska-nara-words-v2')||'null')||STARTER_WORDS;
let storyIndex=0;
let currentArticle=null;
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanWord=s=>String(s||'').trim().replace(/^[^A-Za-zÅÄÖåäöÉéÜü-]+|[^A-Za-zÅÄÖåäöÉéÜü-]+$/g,'').toLowerCase();
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function save(){localStorage.setItem('svenska-nara-words-v2',JSON.stringify(words));renderWords();renderReaderWords()}
function learning(){return words.filter(w=>w.status!=='mastered')}
function mastered(){return words.filter(w=>w.status==='mastered')}
function addWord(swedish,context=''){
  const value=cleanWord(swedish)||String(swedish||'').trim().toLowerCase();
  if(!value||value.length>70)return;
  const existing=words.find(w=>w.swedish.toLowerCase()===value.toLowerCase());
  if(existing){existing.status='learning';save();toast(`Tillbaka i träning: ${value}`);return}
  const word={swedish:value,english:'Hämtar betydelse…',example:context,status:'learning',addedAt:new Date().toISOString()};
  words.unshift(word);save();toast(`Sparat för träning: ${value}`);translate(value).then(t=>{word.english=t||'Betydelse saknas';save()});
}
function renderStarter(){document.querySelector('#starterWords').innerHTML=STARTER_WORDS.map((w,i)=>`<button class="word-card" data-starter="${i}"><strong>${w.swedish}</strong><span>${w.english}</span></button>`).join('');document.querySelectorAll('[data-starter]').forEach(b=>b.onclick=()=>addWord(STARTER_WORDS[+b.dataset.starter].swedish,STARTER_WORDS[+b.dataset.starter].example))}
function wordCard(w,index,isMastered=false){return `<article class="saved-word"><div><strong>${esc(w.swedish)}</strong><span>${esc(w.english||'')}</span>${w.example?`<small>${esc(w.example)}</small>`:''}</div><div class="word-actions"><button data-speak-word="${index}" aria-label="Lyssna på ${esc(w.swedish)}">🔊</button>${isMastered?`<button data-reactivate="${index}">Träna igen</button>`:`<button class="understood" data-master="${index}">✓ Ord förstått</button>`}</div></article>`}
function renderWords(){
  const learn=learning(),done=mastered();
  document.querySelector('#learningCount').textContent=`${learn.length} ord`;
  document.querySelector('#savedWords').innerHTML=learn.length?learn.map((w,i)=>wordCard(w,i,false)).join(''):'<p class="muted">Inga aktiva ord. Klicka på ord i en nyhetsartikel för att lägga till dem.</p>';
  document.querySelector('#masteredWords').innerHTML=done.length?done.map((w,i)=>wordCard(w,i,true)).join(''):'<p class="muted">Inga förstådda ord ännu.</p>';
  document.querySelectorAll('[data-master]').forEach(b=>b.onclick=()=>{learning()[+b.dataset.master].status='mastered';save();toast('Flyttat till Förstådda ord')});
  document.querySelectorAll('[data-reactivate]').forEach(b=>b.onclick=()=>{mastered()[+b.dataset.reactivate].status='learning';save();toast('Ordet är aktivt igen')});
  document.querySelectorAll('[data-speak-word]').forEach(b=>b.onclick=()=>{const list=b.closest('#masteredWords')?mastered():learning();speak(list[+b.dataset.speakWord].swedish)});
}
function renderStory(){document.querySelector('#story').textContent=STORIES[storyIndex]}
function newsCards(items){return items.slice(0,8).map(item=>`<article class="news-card" data-news='${encodeURIComponent(JSON.stringify(item))}'><small>${esc(item.source)} · ${new Date(item.published).toLocaleDateString('sv-SE')}</small><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><span>Läs inne på Svenska Nära →</span></article>`).join('')||'<p class="muted">Inga nyheter kunde hämtas just nu.</p>'}
function bindNews(){document.querySelectorAll('[data-news]').forEach(card=>card.onclick=()=>openNews(JSON.parse(decodeURIComponent(card.dataset.news))))}
function tokenize(text){return esc(text).split(/(\s+)/).map(part=>/^\s+$/.test(part)?part:`<button class="click-word" data-click-word="${encodeURIComponent(cleanWord(part))}">${part}</button>`).join('')}
async function openNews(item){
  currentArticle=item;
  document.body.classList.add('reader-open');
  document.querySelector('#reader').innerHTML=`<section class="reader"><header class="reader-top"><button id="closeReader">← Till nyheterna</button><span>${esc(item.source)}</span></header><div class="reader-shell"><article><p class="eyebrow">${esc(item.source)}</p><h1>${esc(item.title)}</h1><p class="article-date">${new Date(item.published).toLocaleString('sv-SE')}</p><div class="reader-tools"><button id="speakArticle">▶ Lyssna</button><button id="stopArticle" class="secondary">■ Stoppa</button><button id="translateArticle" class="secondary">Translate to English</button></div><div id="articleStatus" class="tip">Hämtar hela den fria artikeln…</div><div id="articleText" class="article-text"></div><div id="translation" class="translation hidden"></div></article><aside><h3>Ordverktyg</h3><p>Klicka på ett ord för att spara det. Markera flera ord och tryck sedan på knappen nedan.</p><button id="saveSelection" class="full">+ Spara markerad fras</button><div id="readerWords"></div></aside></div></section>`;
  document.querySelector('#closeReader').onclick=closeReader;
  document.querySelector('#speakArticle').onclick=()=>speak(`${item.title}. ${document.querySelector('#articleText').innerText}`);
  document.querySelector('#stopArticle').onclick=stopSpeaking;
  document.querySelector('#translateArticle').onclick=translateCurrentArticle;
  document.querySelector('#saveSelection').onclick=()=>{const text=window.getSelection().toString().trim();if(text)addWord(text,item.title);else toast('Markera en fras i artikeln först')};
  try{
    const data=await fetch(`/api/article?url=${encodeURIComponent(item.link)}`).then(r=>r.json());
    const body=data.body||item.description;
    document.querySelector('#articleStatus').innerHTML=`Hela artikeln visas här inne. Klicka på ett ord, eller markera en fras. <a href="${esc(item.link)}" target="_blank" rel="noreferrer">Källa: ${esc(item.source)}</a>`;
    document.querySelector('#articleText').innerHTML=body.split(/\n+/).filter(Boolean).map(p=>`<p>${tokenize(p)}</p>`).join('');
    bindClickableWords();
  }catch(e){document.querySelector('#articleStatus').textContent='Hela texten kunde inte hämtas. Sammanfattningen visas i stället.';document.querySelector('#articleText').innerHTML=`<p>${tokenize(item.description)}</p>`;bindClickableWords()}
  renderReaderWords();
}
function bindClickableWords(){document.querySelectorAll('[data-click-word]').forEach(b=>b.onclick=e=>{e.stopPropagation();const word=decodeURIComponent(b.dataset.clickWord);if(word)addWord(word,currentArticle?.title||'')})}
function renderReaderWords(){const el=document.querySelector('#readerWords');if(!el)return;el.innerHTML=learning().slice(0,12).map(w=>`<div><strong>${esc(w.swedish)}</strong><span>${esc(w.english)}</span></div>`).join('')}
function closeReader(){stopSpeaking();document.body.classList.remove('reader-open');document.querySelector('#reader').innerHTML=''}
function bestSwedishVoice(){const voices=speechSynthesis.getVoices().filter(v=>v.lang.toLowerCase().startsWith('sv'));return voices.find(v=>v.localService)||voices[0]||null}
function speak(text){if(!('speechSynthesis'in window)){toast('Uppläsning stöds inte i den här webbläsaren');return}stopSpeaking();const u=new SpeechSynthesisUtterance(text);u.lang='sv-SE';u.rate=.92;u.pitch=1;const voice=bestSwedishVoice();if(voice)u.voice=voice;speechSynthesis.speak(u)}
function stopSpeaking(){if('speechSynthesis'in window)speechSynthesis.cancel()}
async function translate(text){try{const r=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});const d=await r.json();return d.translation||''}catch{return''}}
async function translateCurrentArticle(){const button=document.querySelector('#translateArticle');const box=document.querySelector('#translation');if(!box.classList.contains('hidden')){box.classList.add('hidden');button.textContent='Translate to English';return}button.disabled=true;button.textContent='Translating…';const text=`${currentArticle.title}\n\n${document.querySelector('#articleText').innerText}`;const result=await translate(text);box.textContent=result||'Translation is temporarily unavailable.';box.classList.remove('hidden');button.disabled=false;button.textContent='Hide English translation'}
async function loadNews(){try{const data=await fetch('/api/news').then(r=>r.json());document.querySelector('#localNews').innerHTML=newsCards(data.news.filter(n=>n.region==='Göteborg & Väst'));document.querySelector('#nationalNews').innerHTML=newsCards(data.news.filter(n=>n.region==='Sverige'));bindNews()}catch(e){document.querySelector('#localNews').innerHTML='<p class="muted">Nyhetsflödet kunde inte laddas.</p>';document.querySelector('#nationalNews').innerHTML='<p class="muted">Nyhetsflödet kunde inte laddas.</p>'}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav-button,.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector(`#${b.dataset.view}`).classList.add('active')});
renderStarter();renderWords();renderStory();loadNews();
document.querySelector('#newStory').onclick=()=>{storyIndex=(storyIndex+1)%STORIES.length;renderStory()};
document.querySelector('#speakStory').onclick=()=>speak(document.querySelector('#story').innerText);
if('speechSynthesis'in window)speechSynthesis.getVoices();