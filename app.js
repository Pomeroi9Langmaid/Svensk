const STARTER_WORDS = [
  { swedish: 'ställa in', english: 'cancel', example: 'Mötet måste ställas in på grund av ovädret.', status: 'learning' },
  { swedish: 'ta reda på', english: 'find out', example: 'Jag ska ta reda på när bussen går.', status: 'learning' },
  { swedish: 'hålla med', english: 'agree', example: 'Jag håller med om att svenska är svårt ibland.', status: 'learning' },
  { swedish: 'på grund av', english: 'because of', example: 'Tåget är sent på grund av ett tekniskt fel.', status: 'learning' },
  { swedish: 'det visar sig att', english: 'it turns out that', example: 'Det visar sig att vägen redan är öppen.', status: 'learning' }
];

const STORIES = [
  'Ett möte i Göteborg skulle börja klockan nio, men arrangörerna behövde ställa in det på grund av ett tekniskt problem. Andrew försökte ta reda på vad som hade hänt. Det visar sig att lokalen saknade el. Lisa höll med om att det var bättre att boka en ny dag.',
  'Kommunen ville ställa in arbetet på en gata i Majorna på grund av kraftigt regn. En reporter försökte ta reda på när arbetet skulle fortsätta. Det visar sig att arbetet börjar igen på måndag. Många boende håller med om beslutet.',
  'Andrew läste en nyhet om ett tåg som hade ställts in på grund av ett signalfel. Han ville ta reda på om ersättningsbussar fanns. Det visar sig att bussarna redan väntade utanför stationen, och de flesta resenärer höll med om att informationen var tydlig.'
];

let words = JSON.parse(localStorage.getItem('svenska-nara-words-v2') || 'null') || STARTER_WORDS.map(word => ({ ...word }));
let storyIndex = 0;
let currentArticle = null;
let speechQueue = [];
let speechIndex = 0;
let speaking = false;

const esc = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const cleanWord = value => String(value || '')
  .trim()
  .replace(/^[^A-Za-zÅÄÖåäöÉéÜü-]+|[^A-Za-zÅÄÖåäöÉéÜü-]+$/g, '')
  .toLowerCase();

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

function learning() { return words.filter(word => word.status !== 'mastered'); }
function mastered() { return words.filter(word => word.status === 'mastered'); }

function save() {
  localStorage.setItem('svenska-nara-words-v2', JSON.stringify(words));
  renderWords();
  renderReaderWords();
}

async function translate(text) {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.translation) throw new Error(data.error || 'Translation failed');
  return data.translation;
}

async function addWord(swedish, context = '') {
  const phrase = String(swedish || '').trim().toLowerCase();
  const value = phrase.includes(' ') ? phrase : cleanWord(phrase);
  if (!value || value.length > 90) return;
  const existing = words.find(word => word.swedish.toLowerCase() === value);
  if (existing) {
    existing.status = 'learning';
    save();
    showSelectedWord(existing);
    toast(`Already saved: ${value}`);
    return;
  }
  const word = { swedish: value, english: 'Translating…', example: context, status: 'learning', addedAt: new Date().toISOString() };
  words.unshift(word);
  save();
  showSelectedWord(word);
  toast(`Saved: ${value}`);
  try { word.english = await translate(value); }
  catch { word.english = 'Translation unavailable — try again'; }
  save();
  showSelectedWord(word);
}

function renderStarter() {
  document.querySelector('#starterWords').innerHTML = STARTER_WORDS.map((word, index) => `<button class="word-card" data-starter="${index}"><strong>${esc(word.swedish)}</strong><span>${esc(word.english)}</span></button>`).join('');
  document.querySelectorAll('[data-starter]').forEach(button => {
    button.onclick = () => addWord(STARTER_WORDS[Number(button.dataset.starter)].swedish, STARTER_WORDS[Number(button.dataset.starter)].example);
  });
}

function wordCard(word, index, isMastered = false) {
  return `<article class="saved-word"><div><strong>${esc(word.swedish)}</strong><span>${esc(word.english || '')}</span>${word.example ? `<small>${esc(word.example)}</small>` : ''}</div><div class="word-actions"><button data-speak-word="${index}">🔊 Listen</button>${isMastered ? `<button data-reactivate="${index}">Practise again</button>` : `<button class="understood" data-master="${index}">✓ Word understood</button>`}</div></article>`;
}

function renderWords() {
  const active = learning();
  const done = mastered();
  document.querySelector('#learningCount').textContent = `${active.length} words`;
  document.querySelector('#savedWords').innerHTML = active.length ? active.map((word, index) => wordCard(word, index)).join('') : '<p class="muted">No active words. Click a word in an article to add it.</p>';
  document.querySelector('#masteredWords').innerHTML = done.length ? done.map((word, index) => wordCard(word, index, true)).join('') : '<p class="muted">No understood words yet.</p>';
  document.querySelectorAll('[data-master]').forEach(button => {
    button.onclick = () => { const word = learning()[Number(button.dataset.master)]; if (!word) return; word.status = 'mastered'; save(); toast('Moved to Understood words'); };
  });
  document.querySelectorAll('[data-reactivate]').forEach(button => {
    button.onclick = () => { const word = mastered()[Number(button.dataset.reactivate)]; if (!word) return; word.status = 'learning'; save(); toast('Word returned to practice'); };
  });
  document.querySelectorAll('[data-speak-word]').forEach(button => {
    button.onclick = () => { const list = button.closest('#masteredWords') ? mastered() : learning(); const word = list[Number(button.dataset.speakWord)]; if (word) speak(word.swedish); };
  });
}

function renderStory() { document.querySelector('#story').textContent = STORIES[storyIndex]; }

function newsCards(items) {
  return items.slice(0, 8).map(item => `<article class="news-card" data-news="${encodeURIComponent(JSON.stringify(item))}"><small>${esc(item.source)} · ${new Date(item.published).toLocaleDateString('sv-SE')}</small><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><span>Read inside Svenska Nära →</span></article>`).join('') || '<p class="muted">No news could be loaded.</p>';
}

function bindNews() {
  document.querySelectorAll('[data-news]').forEach(card => { card.onclick = () => openNews(JSON.parse(decodeURIComponent(card.dataset.news))); });
}

function tokenize(text) {
  return String(text || '').split(/(\s+)/).map(part => {
    if (/^\s+$/.test(part)) return part;
    const word = cleanWord(part);
    if (!word) return esc(part);
    return `<button type="button" class="click-word" data-click-word="${encodeURIComponent(word)}" title="Save ${esc(word)}">${esc(part)}</button>`;
  }).join('');
}

function showSelectedWord(word) {
  const element = document.querySelector('#selectedWord');
  if (!element || !word) return;
  element.innerHTML = `<p class="eyebrow">JUST SAVED</p><strong>${esc(word.swedish)}</strong><span>${esc(word.english)}</span>`;
}

async function openNews(item) {
  currentArticle = item;
  document.body.classList.add('reader-open');
  document.querySelector('#reader').innerHTML = `<section class="reader"><header class="reader-top"><button id="closeReader">← Back to news</button><span>${esc(item.source)}</span></header><div class="reader-shell"><article><p class="eyebrow">${esc(item.source)}</p><h1>${esc(item.title)}</h1><p class="article-date">${new Date(item.published).toLocaleString('sv-SE')}</p><div class="reader-tools"><button id="speakArticle">▶ Listen</button><button id="stopArticle" class="secondary">■ Stop</button><button id="translateArticle" class="secondary">Translate to English</button></div><div id="articleStatus" class="tip">Loading the article…</div><div id="articleText" class="article-text"></div><div id="translation" class="translation hidden"></div></article><aside><h3>Save difficult words</h3><p>Click one word. For a phrase, highlight it in the article and press the button.</p><button id="saveSelection" class="full">+ Save highlighted phrase</button><div id="selectedWord" class="selected-word"><span>No word selected yet.</span></div><div id="readerWords"></div></aside></div></section>`;
  document.querySelector('#closeReader').onclick = closeReader;
  document.querySelector('#speakArticle').onclick = () => speak(`${item.title}. ${document.querySelector('#articleText').innerText}`);
  document.querySelector('#stopArticle').onclick = stopSpeaking;
  document.querySelector('#translateArticle').onclick = translateCurrentArticle;
  document.querySelector('#saveSelection').onclick = () => { const selection = window.getSelection().toString().trim(); if (selection) addWord(selection, item.title); else toast('Highlight a phrase in the article first'); };
  try {
    const response = await fetch(`/api/article?url=${encodeURIComponent(item.link)}`);
    const data = await response.json();
    if (!response.ok || !data.body) throw new Error(data.error || 'Article failed');
    document.querySelector('#articleStatus').textContent = 'Article loaded. Click any difficult word to save it.';
    document.querySelector('#articleText').innerHTML = data.body.split(/\n+/).filter(Boolean).map(paragraph => `<p>${tokenize(paragraph)}</p>`).join('');
  } catch {
    document.querySelector('#articleStatus').textContent = 'The full article could not be loaded. The available summary is shown.';
    document.querySelector('#articleText').innerHTML = `<p>${tokenize(item.description)}</p>`;
  }
  document.querySelector('#articleText').addEventListener('click', event => { const button = event.target.closest('[data-click-word]'); if (!button) return; addWord(decodeURIComponent(button.dataset.clickWord), currentArticle?.title || ''); });
  renderReaderWords();
}

function renderReaderWords() {
  const element = document.querySelector('#readerWords');
  if (!element) return;
  const active = learning().slice(0, 12);
  element.innerHTML = active.length ? `<h4>Current practice words</h4>${active.map(word => `<div><strong>${esc(word.swedish)}</strong><span>${esc(word.english)}</span></div>`).join('')}` : '<p class="muted">No practice words yet.</p>';
}

function closeReader() { stopSpeaking(); document.body.classList.remove('reader-open'); document.querySelector('#reader').innerHTML = ''; }

function bestSwedishVoice() {
  const voices = window.speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('sv'));
  return voices.find(voice => voice.localService) || voices[0] || null;
}

function splitSpeech(text, maxLength = 220) {
  const sentences = String(text || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const chunks = [];
  let current = '';
  sentences.forEach(sentence => { if ((current + sentence).length > maxLength && current) { chunks.push(current.trim()); current = sentence; } else current += sentence; });
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function speakNext() {
  if (!speaking || speechIndex >= speechQueue.length) { speaking = false; return; }
  const utterance = new SpeechSynthesisUtterance(speechQueue[speechIndex]);
  utterance.lang = 'sv-SE';
  utterance.rate = 0.9;
  const voice = bestSwedishVoice();
  if (voice) utterance.voice = voice;
  utterance.onend = () => { speechIndex += 1; speakNext(); };
  utterance.onerror = () => { speaking = false; toast('Listening failed in this browser'); };
  window.speechSynthesis.speak(utterance);
}

function speak(text) {
  if (!('speechSynthesis' in window)) { toast('Listening is not supported by this browser'); return; }
  stopSpeaking();
  speechQueue = splitSpeech(text);
  speechIndex = 0;
  speaking = true;
  speakNext();
  toast('Reading started');
}

function stopSpeaking() {
  speaking = false;
  speechQueue = [];
  speechIndex = 0;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

async function translateCurrentArticle() {
  const button = document.querySelector('#translateArticle');
  const box = document.querySelector('#translation');
  if (!box.classList.contains('hidden')) { box.classList.add('hidden'); button.textContent = 'Translate to English'; return; }
  button.disabled = true;
  button.textContent = 'Translating…';
  box.classList.remove('hidden');
  box.textContent = 'Creating English translation…';
  try {
    const text = `${currentArticle.title}\n\n${document.querySelector('#articleText').innerText}`;
    box.textContent = await translate(text);
    button.textContent = 'Hide English translation';
  } catch {
    box.textContent = 'English translation could not be created. Please try again.';
    button.textContent = 'Try translation again';
  } finally { button.disabled = false; }
}

async function loadNews() {
  try {
    const response = await fetch('/api/news', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.news)) throw new Error('News failed');
    document.querySelector('#localNews').innerHTML = newsCards(data.news.filter(item => item.region === 'Göteborg & Väst'));
    document.querySelector('#nationalNews').innerHTML = newsCards(data.news.filter(item => item.region === 'Sverige'));
    bindNews();
  } catch {
    document.querySelector('#localNews').innerHTML = '<p class="muted">The news feed could not be loaded.</p>';
    document.querySelector('#nationalNews').innerHTML = '<p class="muted">The news feed could not be loaded.</p>';
  }
}

document.querySelectorAll('[data-view]').forEach(button => {
  button.onclick = () => { document.querySelectorAll('.nav-button,.view').forEach(element => element.classList.remove('active')); button.classList.add('active'); document.querySelector(`#${button.dataset.view}`).classList.add('active'); };
});
renderStarter();
renderWords();
renderStory();
loadNews();
document.querySelector('#newStory').onclick = () => { storyIndex = (storyIndex + 1) % STORIES.length; renderStory(); };
document.querySelector('#speakStory').onclick = () => speak(document.querySelector('#story').innerText);
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
