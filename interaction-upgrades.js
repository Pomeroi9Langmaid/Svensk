let lastUndoTimer=null;

function actionableToast(text,label,action){
  const el=q('#toast');
  el.innerHTML=`<span>${esc(text)}</span>${label?`<button type="button" id="toastAction">${esc(label)}</button>`:''}`;
  el.classList.add('show');
  clearTimeout(toast.timer);
  clearTimeout(lastUndoTimer);
  if(label&&action){
    const button=q('#toastAction');
    if(button)button.onclick=()=>{action();el.classList.remove('show')};
  }
  lastUndoTimer=setTimeout(()=>el.classList.remove('show'),4200);
}

toast=function(text){actionableToast(text)};

function removeWordByText(swedish){
  const index=words.findIndex(item=>item.swedish===swedish);
  if(index<0)return;
  words.splice(index,1);
  save();
  actionableToast(`Borttaget: ${swedish}`);
}

addWord=async function(raw,context=''){
  const phrase=String(raw||'').replace(/\s+/g,' ').trim().toLowerCase();
  const word=phrase.includes(' ')?phrase:phrase.replace(/^[^a-zåäöéü-]+|[^a-zåäöéü-]+$/gi,'');
  if(!word||word.length>100)return;
  let existing=words.find(item=>item.swedish===word);
  if(existing){
    existing.status='learning';
    if(context&&!existing.examples?.includes(context))existing.examples=[context,...(existing.examples||[])].slice(0,4);
    save();
    actionableToast(`Redan sparat: ${word}`,'Ta bort',()=>removeWordByText(word));
    return;
  }
  const item={swedish:word,english:'Översätter…',examples:exampleSet(word,context),status:'learning'};
  words.unshift(item);
  save();
  actionableToast(`Sparat: ${word}`,'Ångra',()=>removeWordByText(word));
  try{item.english=await translate(word)}catch{item.english='English meaning unavailable'}
  if(words.includes(item))save();
};

tokenise=function(text){
  return String(text||'').split(/(\s+)/).map(part=>{
    if(/^\s+$/.test(part))return part;
    const clean=part.replace(/^[^a-zåäöéü-]+|[^a-zåäöéü-]+$/gi,'');
    return clean?`<span class="click-word" role="button" tabindex="0" data-click-word="${encodeURIComponent(clean.toLowerCase())}">${esc(part)}</span>`:esc(part);
  }).join('');
};

practiceCard=function(w,index,isDone){
  const list=isDone?'mastered':'learning';
  const examples=(w.examples?.length?w.examples:exampleSet(w.swedish)).slice(0,4);
  return`<article class="practice-card"><div class="practice-head"><div class="practice-title"><strong>${esc(w.swedish)}</strong><span>${esc(w.english||'')}</span></div><div class="practice-actions"><button class="action" data-word-audio="${list}:${index}">🔊 Lyssna</button>${isDone?`<button class="action" data-reactivate="${index}">Träna igen</button>`:`<button class="action understood" data-understood="${index}">✓ Ord förstått</button>`}<button class="action remove" data-remove-word="${list}:${index}">Ta bort</button></div></div><div class="examples"><p class="examples-label">ENKLA MENINGAR</p>${examples.map((s,i)=>`<div class="example-row"><p>${esc(s)}</p><button class="listen-button" data-sentence="${list}:${index}:${i}">▶ Lyssna</button></div>`).join('')}</div></article>`;
};

renderPractice=function(){
  const active=learning(),done=mastered();
  q('#learningCount').textContent=active.length;
  q('#practiceWords').innerHTML=active.length?active.map((w,i)=>practiceCard(w,i,false)).join(''):'<section class="panel"><p>Inga aktiva ord.</p></section>';
  q('#masteredWords').innerHTML=done.length?done.map((w,i)=>practiceCard(w,i,true)).join(''):'<section class="panel"><p>Inga förstådda ord ännu.</p></section>';
  qa('[data-understood]').forEach(button=>button.onclick=()=>{const item=active[+button.dataset.understood];if(!item)return;item.status='mastered';save();toast('Flyttat till Förstådda ord')});
  qa('[data-reactivate]').forEach(button=>button.onclick=()=>{const item=done[+button.dataset.reactivate];if(!item)return;item.status='learning';save();toast('Ordet är tillbaka i träning')});
  qa('[data-remove-word]').forEach(button=>button.onclick=()=>{const [type,index]=button.dataset.removeWord.split(':');const list=type==='mastered'?done:active;const item=list[+index];if(item)removeWordByText(item.swedish)});
  qa('[data-word-audio]').forEach(button=>button.onclick=()=>{const [type,index]=button.dataset.wordAudio.split(':');const item=(type==='mastered'?done:active)[+index];if(item)speak(item.swedish,button)});
  qa('[data-sentence]').forEach(button=>button.onclick=()=>{const [type,index,sentenceIndex]=button.dataset.sentence.split(':');const item=(type==='mastered'?done:active)[+index];if(item)speak(item.examples[+sentenceIndex],button)});
};

renderPractice();