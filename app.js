/* ---- Supabase setup ---- */
const SUPABASE_URL = 'https://epetjjagenqmezgbdyxk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Nrs1bv1Hz9g_G3j0R5zBdA_JiTkx-8Z';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---- Toast notifications ---- */
const toastContainer = document.getElementById('toastContainer');

function showToast(text, isErr){
  if(!text) return;
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = text;
  toastContainer.appendChild(el);
  const dismiss = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };
  const timer = setTimeout(dismiss, 3400);
  el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
}

/* ---- Custom confirm modal (replaces window.confirm) ---- */
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmText = document.getElementById('confirmText');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmOkBtn = document.getElementById('confirmOkBtn');
let confirmResolver = null;

function customConfirm(message){
  confirmText.textContent = message;
  confirmOverlay.classList.remove('hidden');
  return new Promise(resolve => { confirmResolver = resolve; });
}
function closeConfirm(result){
  confirmOverlay.classList.add('hidden');
  if(confirmResolver){ confirmResolver(result); confirmResolver = null; }
}
confirmCancelBtn.addEventListener('click', () => closeConfirm(false));
confirmOkBtn.addEventListener('click', () => closeConfirm(true));
confirmOverlay.addEventListener('click', (e) => { if(e.target === confirmOverlay) closeConfirm(false); });
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && !confirmOverlay.classList.contains('hidden')) closeConfirm(false);
});

/* ---- Skeleton loading helpers ---- */
function skeletonListHTML(count, widths){
  let html = '';
  for(let i = 0; i < count; i++){
    const w = widths[i % widths.length];
    html += '<li class="skel-item"><span class="skel skel-line" style="width:' + w + '"></span></li>';
  }
  return html;
}

let authMode = 'login'; // 'login' | 'signup'

const landingStage = document.getElementById('landingStage');
const authStage = document.getElementById('authStage');
const appStage = document.getElementById('appStage');
const authBackBtn = document.getElementById('authBackBtn');
const authTitle = document.getElementById('authTitle');
const authSub = document.getElementById('authSub');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSwitchText = document.getElementById('authSwitchText');
const authSwitchBtn = document.getElementById('authSwitchBtn');
const authMsg = document.getElementById('authMsg');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');

function setAuthMsg(text, type){
  authMsg.textContent = text || '';
  authMsg.classList.remove('err', 'ok');
  if(type) authMsg.classList.add(type);
}

function setAuthMode(mode){
  authMode = mode;
  setAuthMsg('');
  if(mode === 'login'){
    authTitle.textContent = 'Welcome back';
    authSub.textContent = 'Log in to save your practice history and decks.';
    authSubmitBtn.textContent = 'Log in';
    authSwitchText.textContent = "Don't have an account?";
    authSwitchBtn.textContent = 'Sign up';
  }else{
    authTitle.textContent = 'Create an account';
    authSub.textContent = 'Save decks and track your practice over time.';
    authSubmitBtn.textContent = 'Sign up';
    authSwitchText.textContent = 'Already have an account?';
    authSwitchBtn.textContent = 'Log in';
  }
}

authSwitchBtn.addEventListener('click', () => {
  setAuthMode(authMode === 'login' ? 'signup' : 'login');
});

authSubmitBtn.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if(!email || !password){
    setAuthMsg('Enter both email and password.', 'err');
    return;
  }
  authSubmitBtn.disabled = true;
  setAuthMsg(authMode === 'login' ? 'Logging in…' : 'Creating account…');

  if(authMode === 'login'){
    const { error } = await sb.auth.signInWithPassword({ email, password });
    authSubmitBtn.disabled = false;
    if(error){ setAuthMsg(error.message, 'err'); return; }
    // onAuthStateChange will handle showing the app
  }else{
    const { error } = await sb.auth.signUp({ email, password });
    authSubmitBtn.disabled = false;
    if(error){ setAuthMsg(error.message, 'err'); return; }
    setAuthMsg('Account created. Check your email to confirm, then log in.', 'ok');
    setAuthMode('login');
  }
});

logoutBtn.addEventListener('click', async () => {
  await sb.auth.signOut();
});

function showLandingScreen(){
  landingStage.classList.remove('hidden');
  authStage.classList.add('hidden');
  appStage.classList.add('hidden');
  initDemo();
}

function showAuthScreen(){
  landingStage.classList.add('hidden');
  authStage.classList.remove('hidden');
  appStage.classList.add('hidden');
}

function showAppScreen(user){
  landingStage.classList.add('hidden');
  authStage.classList.add('hidden');
  appStage.classList.remove('hidden');
  userEmail.textContent = user.email;
  currentUser = user;
  loadUserDecks();
  if(topics.length === 0) loadActiveDeckTopics();
}

authBackBtn.addEventListener('click', showLandingScreen);

sb.auth.onAuthStateChange((event, session) => {
  if(session && session.user){
    showAppScreen(session.user);
  }else{
    showLandingScreen();
  }
});

sb.auth.getSession().then(({ data }) => {
  if(data.session && data.session.user){
    showAppScreen(data.session.user);
  }else{
    showLandingScreen();
  }
});

/* ---- Landing page: live demo card (no auth, no persistence) ---- */
const landingLoginBtn = document.getElementById('landingLoginBtn');
const landingSignupBtn = document.getElementById('landingSignupBtn');
const landingTryBtn = document.getElementById('landingTryBtn');
const landingDemo = document.getElementById('landingDemo');
const demoCard = document.getElementById('demoCard');
const demoTopicText = document.getElementById('demoTopicText');
const demoCategoryLabel = document.getElementById('demoCategoryLabel');
const demoClock = document.getElementById('demoClock');
const demoBarFill = document.getElementById('demoBarFill');
const demoStartBtn = document.getElementById('demoStartBtn');
const demoDrawBtn = document.getElementById('demoDrawBtn');
const demoTimerWrap = document.getElementById('demoTimerWrap');

landingLoginBtn.addEventListener('click', () => { setAuthMode('login'); showAuthScreen(); });
landingSignupBtn.addEventListener('click', () => { setAuthMode('signup'); showAuthScreen(); });
landingTryBtn.addEventListener('click', () => {
  landingDemo.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

let demoTopics = [];
let demoDeck = [];
let demoDeckIndex = 0;
const demoDuration = 180;
let demoRemaining = demoDuration;
let demoTimerId = null;
let demoRunning = false;
let demoInitialized = false;

async function initDemo(){
  if(demoInitialized) return;
  demoInitialized = true;
  try{
    const res = await fetch('topics.json', { cache: 'no-store' });
    const data = await res.json();
    demoTopics = data.map(([category, text]) => ({ category, text }));
    demoDeck = shuffle(demoTopics);
    demoDeckIndex = 0;
    drawDemoTopic();
  }catch(err){
    demoTopicText.textContent = "Couldn't load a preview topic — sign up to use the full app.";
  }
}

function drawDemoTopic(){
  if(demoDeck.length === 0) return;
  if(demoDeckIndex >= demoDeck.length){ demoDeck = shuffle(demoTopics); demoDeckIndex = 0; }
  const t = demoDeck[demoDeckIndex++];
  demoCategoryLabel.textContent = t.category;
  demoTopicText.textContent = t.text;
  demoCard.classList.remove('animate');
  void demoCard.offsetWidth;
  demoCard.classList.add('animate');
  stopDemoTimer();
  demoRemaining = demoDuration;
  updateDemoClock();
}

function updateDemoClock(){
  demoClock.textContent = formatTime(demoRemaining);
  const pct = 100 - (demoRemaining / demoDuration) * 100;
  demoBarFill.style.width = pct + '%';
  demoTimerWrap.classList.toggle('warn', demoRemaining <= 10 && demoRemaining > 0);
}

function stopDemoTimer(){
  demoRunning = false;
  clearInterval(demoTimerId);
  demoStartBtn.textContent = 'Start';
}

function startDemoTimer(){
  if(demoRunning){ stopDemoTimer(); return; }
  if(demoRemaining <= 0) demoRemaining = demoDuration;
  demoRunning = true;
  demoStartBtn.textContent = 'Pause';
  demoTimerId = setInterval(() => {
    demoRemaining--;
    updateDemoClock();
    if(demoRemaining <= 0){
      stopDemoTimer();
      showToast("Time's up! Sign up to save attempts and get AI feedback.");
    }
  }, 1000);
}

demoStartBtn.addEventListener('click', startDemoTimer);
demoDrawBtn.addEventListener('click', drawDemoTopic);

/* ---- Decks ---- */
let currentUser = null;
let userDecks = [];          // [{id, name}]
let selectedDeckId = 'default';
let panelSelectedDeckId = null;

const deckSelect = document.getElementById('deckSelect');
const manageDecksBtn = document.getElementById('manageDecksBtn');
const decksPanel = document.getElementById('decksPanel');
const deckList = document.getElementById('deckList');
const newDeckName = document.getElementById('newDeckName');
const createDeckBtn = document.getElementById('createDeckBtn');
const deckTopicsSection = document.getElementById('deckTopicsSection');
const deckTopicsTitle = document.getElementById('deckTopicsTitle');
const deckTopicList = document.getElementById('deckTopicList');
const newTopicText = document.getElementById('newTopicText');
const newTopicCategory = document.getElementById('newTopicCategory');
const addTopicBtn = document.getElementById('addTopicBtn');
const closeDecksBtn = document.getElementById('closeDecksBtn');

function setPanelMsg(text, isErr){
  showToast(text, isErr);
}

async function loadUserDecks(){
  if(!decksPanel.classList.contains('hidden')){
    deckList.innerHTML = skeletonListHTML(3, ['60%', '45%', '70%']);
  }
  const { data, error } = await sb
    .from('decks')
    .select('id, name')
    .order('created_at', { ascending: true });
  if(error){ setPanelMsg(error.message, true); return; }
  userDecks = data || [];
  renderDeckSelect();
  renderDeckList();
}

function renderDeckSelect(){
  const prev = deckSelect.value;
  deckSelect.innerHTML = '<option value="default">Default deck</option>';
  userDecks.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    deckSelect.appendChild(opt);
  });
  const stillExists = prev === 'default' || userDecks.some(d => d.id === prev);
  deckSelect.value = stillExists ? prev : 'default';
  selectedDeckId = deckSelect.value;
}

function renderDeckList(){
  deckList.innerHTML = '';
  if(userDecks.length === 0){
    const li = document.createElement('li');
    li.innerHTML = '<span class="empty-note">No custom decks yet — create one below.</span>';
    deckList.appendChild(li);
  }
  userDecks.forEach(d => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'deck-name' + (d.id === panelSelectedDeckId ? ' active' : '');
    nameSpan.textContent = d.name;
    nameSpan.style.cursor = 'pointer';
    nameSpan.addEventListener('click', () => openDeckTopics(d.id, d.name));

    const actions = document.createElement('span');
    actions.style.display = 'flex';
    actions.style.gap = '12px';

    const delLink = document.createElement('span');
    delLink.className = 'small-link danger';
    delLink.textContent = 'Delete';
    delLink.addEventListener('click', () => deleteDeck(d.id));

    actions.appendChild(delLink);
    li.appendChild(nameSpan);
    li.appendChild(actions);
    deckList.appendChild(li);
  });
}

async function createDeck(){
  const name = newDeckName.value.trim();
  if(!name){ setPanelMsg('Enter a deck name.', true); return; }
  createDeckBtn.disabled = true;
  const { data, error } = await sb
    .from('decks')
    .insert({ name, user_id: currentUser.id })
    .select('id, name')
    .single();
  createDeckBtn.disabled = false;
  if(error){ setPanelMsg(error.message, true); return; }
  newDeckName.value = '';
  setPanelMsg('Deck created.');
  await loadUserDecks();
  openDeckTopics(data.id, data.name);
}

async function deleteDeck(deckId){
  const ok = await customConfirm('Delete this deck and all its topics?');
  if(!ok) return;
  const { error } = await sb.from('decks').delete().eq('id', deckId);
  if(error){ setPanelMsg(error.message, true); return; }
  if(panelSelectedDeckId === deckId){
    panelSelectedDeckId = null;
    deckTopicsSection.classList.add('hidden');
  }
  await loadUserDecks();
  if(selectedDeckId === deckId){
    selectedDeckId = 'default';
    deckSelect.value = 'default';
    loadActiveDeckTopics();
  }
}

async function openDeckTopics(deckId, name){
  panelSelectedDeckId = deckId;
  deckTopicsTitle.textContent = 'Topics in "' + name + '"';
  deckTopicsSection.classList.remove('hidden');
  renderDeckList();
  await renderDeckTopicList();
}

async function renderDeckTopicList(){
  deckTopicList.innerHTML = skeletonListHTML(3, ['78%', '55%', '65%']);
  const { data, error } = await sb
    .from('topics')
    .select('id, text, category')
    .eq('deck_id', panelSelectedDeckId)
    .order('created_at', { ascending: true });
  if(error){ setPanelMsg(error.message, true); return; }
  deckTopicList.innerHTML = '';
  if(!data || data.length === 0){
    const li = document.createElement('li');
    li.innerHTML = '<span class="empty-note">No topics yet — add one below.</span>';
    deckTopicList.appendChild(li);
    return;
  }
  data.forEach(t => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className = 'topic-text';
    span.textContent = t.text + (t.category ? '  —  ' + t.category : '');
    const delLink = document.createElement('span');
    delLink.className = 'small-link danger';
    delLink.textContent = 'Remove';
    delLink.addEventListener('click', () => deleteTopic(t.id));
    li.appendChild(span);
    li.appendChild(delLink);
    deckTopicList.appendChild(li);
  });
}

async function addTopicToDeck(){
  const text = newTopicText.value.trim();
  const category = newTopicCategory.value.trim() || 'custom';
  if(!text){ setPanelMsg('Enter topic text.', true); return; }
  if(!panelSelectedDeckId){ setPanelMsg('Select a deck first.', true); return; }
  addTopicBtn.disabled = true;
  const { error } = await sb
    .from('topics')
    .insert({ deck_id: panelSelectedDeckId, text, category });
  addTopicBtn.disabled = false;
  if(error){ setPanelMsg(error.message, true); return; }
  newTopicText.value = '';
  newTopicCategory.value = '';
  setPanelMsg('Topic added.');
  await renderDeckTopicList();
  if(selectedDeckId === panelSelectedDeckId) loadActiveDeckTopics();
}

async function deleteTopic(topicId){
  const { error } = await sb.from('topics').delete().eq('id', topicId);
  if(error){ setPanelMsg(error.message, true); return; }
  await renderDeckTopicList();
  if(selectedDeckId === panelSelectedDeckId) loadActiveDeckTopics();
}

manageDecksBtn.addEventListener('click', () => {
  decksPanel.classList.toggle('hidden');
  historyPanel.classList.add('hidden');
  completedPanel.classList.add('hidden');
  progressPanel.classList.add('hidden');
  if(!decksPanel.classList.contains('hidden')) loadUserDecks();
});
closeDecksBtn.addEventListener('click', () => decksPanel.classList.add('hidden'));
createDeckBtn.addEventListener('click', createDeck);
addTopicBtn.addEventListener('click', addTopicToDeck);

deckSelect.addEventListener('change', () => {
  selectedDeckId = deckSelect.value;
  loadActiveDeckTopics();
  if(!completedPanel.classList.contains('hidden')) renderCompletedList();
});

/* ---- Completed topics ---- */
const completedBtn = document.getElementById('completedBtn');
const completedPanel = document.getElementById('completedPanel');
const completedDeckName = document.getElementById('completedDeckName');
const completedList = document.getElementById('completedList');
const closeCompletedBtn = document.getElementById('closeCompletedBtn');

completedBtn.addEventListener('click', () => {
  completedPanel.classList.toggle('hidden');
  decksPanel.classList.add('hidden');
  historyPanel.classList.add('hidden');
  progressPanel.classList.add('hidden');
  if(!completedPanel.classList.contains('hidden')) renderCompletedList();
});
closeCompletedBtn.addEventListener('click', () => completedPanel.classList.add('hidden'));

function setCompletedMsg(text, isErr){
  showToast(text, isErr);
}

async function renderCompletedList(){
  const deckLabel = deckSelect.options[deckSelect.selectedIndex]
    ? deckSelect.options[deckSelect.selectedIndex].textContent
    : 'Default deck';
  completedDeckName.textContent = deckLabel;
  completedList.innerHTML = skeletonListHTML(4, ['70%', '85%', '60%', '75%']);
  setCompletedMsg('');

  let query = sb
    .from('completions')
    .select('id, text, category, completed_at')
    .order('completed_at', { ascending: false });
  query = selectedDeckId === 'default' ? query.is('deck_id', null) : query.eq('deck_id', selectedDeckId);

  const { data, error } = await query;
  if(error){ setCompletedMsg(error.message, true); completedList.innerHTML = ''; return; }

  completedList.innerHTML = '';
  if(!data || data.length === 0){
    const li = document.createElement('li');
    li.innerHTML = '<span class="empty-note">No completed topics in this deck yet.</span>';
    completedList.appendChild(li);
    return;
  }

  data.forEach(row => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className = 'topic-text';
    span.textContent = row.text + (row.category ? '  —  ' + row.category : '');

    const dateSpan = document.createElement('span');
    dateSpan.className = 'completed-date';
    dateSpan.textContent = new Date(row.completed_at).toLocaleDateString();

    const undoLink = document.createElement('span');
    undoLink.className = 'small-link';
    undoLink.textContent = 'Uncomplete';
    undoLink.addEventListener('click', () => uncompleteTopic(row.id));

    const right = document.createElement('span');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.appendChild(dateSpan);
    right.appendChild(undoLink);

    li.appendChild(span);
    li.appendChild(right);
    completedList.appendChild(li);
  });
}

async function uncompleteTopic(completionId){
  const { error } = await sb.from('completions').delete().eq('id', completionId);
  if(error){ setCompletedMsg(error.message, true); return; }
  setCompletedMsg('Moved back into rotation.');
  await renderCompletedList();
  loadActiveDeckTopics();
}

async function loadActiveDeckTopics(){
  if(selectedDeckId === 'default'){
    loadDefaultTopics();
    return;
  }
  statusText.textContent = 'loading';
  startBtn.disabled = true;
  drawBtn.disabled = true;
  completeBtn.disabled = true;
  showTopicSkeleton();
  const { data, error } = await sb
    .from('topics')
    .select('id, category, text')
    .eq('deck_id', selectedDeckId)
    .order('created_at', { ascending: true });
  if(error){
    showError(error.message);
    return;
  }
  const mapped = (data || []).map(t => ({ id: t.id, category: t.category || 'custom', text: t.text, key: 't:' + t.id }));
  const completedKeys = await fetchCompletedKeys(selectedDeckId);
  topics = mapped.filter(t => !completedKeys.has(t.key));

  if(mapped.length === 0){
    handleEmptyDeck('This deck has no topics yet. Add some via "Manage decks".');
    return;
  }
  if(topics.length === 0){
    handleEmptyDeck("You've completed every topic in this deck. Add more via \"Manage decks\".");
    return;
  }
  finishLoadingTopics();
}

async function fetchCompletedKeys(deckId){
  let query = sb.from('completions').select('topic_key');
  query = deckId === null ? query.is('deck_id', null) : query.eq('deck_id', deckId);
  const { data, error } = await query;
  if(error) return new Set();
  return new Set((data || []).map(r => r.topic_key));
}

function showTopicSkeleton(){
  categoryLabel.classList.add('skel');
  categoryLabel.textContent = '';
  cardEl.classList.remove('animate');
  topicText.classList.add('skel-topic');
  topicText.innerHTML = '<span class="skel"></span><span class="skel"></span>';
}

function hideTopicSkeleton(){
  categoryLabel.classList.remove('skel');
  topicText.classList.remove('skel-topic');
}

function handleEmptyDeck(message){
  hideTopicSkeleton();
  errorMsg.classList.remove('show');
  categoryLabel.textContent = 'all done';
  topicText.textContent = message;
  deckCount.textContent = '0 remaining';
  statusText.textContent = 'ready';
  startBtn.disabled = true;
  drawBtn.disabled = true;
  completeBtn.disabled = true;
}

function finishLoadingTopics(){
  hideTopicSkeleton();
  newDeck();
  errorMsg.classList.remove('show');
  statusText.textContent = 'ready';
  enableControls();
  drawTopic();
}

/* ---- Speaking practice app ---- */
let topics = [];
let deck = [];
let deckIndex = 0;
let currentTopic = null;
let timerId = null;
let remaining = 180;
let duration = 180;
let running = false;

const cardEl = document.getElementById('card');
const topicText = document.getElementById('topicText');
const categoryLabel = document.getElementById('categoryLabel');
const deckCount = document.getElementById('deckCount');
const clock = document.getElementById('clock');
const barFill = document.getElementById('barFill');
const startBtn = document.getElementById('startBtn');
const drawBtn = document.getElementById('drawBtn');
const completeBtn = document.getElementById('completeBtn');
const resetBtn = document.getElementById('resetBtn');
const durationSelect = document.getElementById('durationSelect');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const timerWrap = document.getElementById('timerWrap');
const errorMsg = document.getElementById('errorMsg');

/* ---- Speech capture (Web Speech API) ---- */
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSupported = !!SpeechRecognitionCtor;
let recognition = null;
let speechTranscript = '';
let micDenied = false;

if(speechSupported){
  recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (e) => {
    for(let i = e.resultIndex; i < e.results.length; i++){
      if(e.results[i].isFinal){
        const chunk = e.results[i][0].transcript.trim();
        if(chunk) speechTranscript += (speechTranscript ? ' ' : '') + chunk;
      }
    }
  };

  recognition.onerror = (e) => {
    if(e.error === 'not-allowed' || e.error === 'service-not-allowed'){
      micDenied = true;
    }
    // other errors (e.g. 'no-speech') are transient — onend below decides whether to restart
  };

  recognition.onend = () => {
    // Chrome periodically ends recognition on its own (silence, ~60s caps).
    // If the timer's still running and the mic wasn't denied, pick back up.
    if(running && !micDenied){
      try{ recognition.start(); }catch(e){ /* already running, ignore */ }
    }
  };
}

function beginSpeechCapture(){
  if(!speechSupported) return;
  try{ recognition.start(); }catch(e){ /* already started, ignore */ }
}

function stopSpeechCapture(){
  if(!speechSupported) return;
  try{ recognition.stop(); }catch(e){ /* ignore */ }
}

function shuffle(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newDeck(){
  deck = shuffle(topics);
  deckIndex = 0;
}

function formatTime(sec){
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

function updateClock(){
  clock.textContent = formatTime(remaining);
  const pct = 100 - (remaining / duration) * 100;
  barFill.style.width = pct + '%';
  timerWrap.classList.toggle('warn', remaining <= 10 && remaining > 0);
  timerWrap.classList.toggle('done', remaining === 0);
}

function drawTopic(){
  if(topics.length === 0) return;
  if(deckIndex >= deck.length) newDeck();
  const t = deck[deckIndex];
  deckIndex++;
  currentTopic = t;
  categoryLabel.textContent = t.category;
  topicText.textContent = t.text;
  deckCount.textContent = topics.length + ' remaining';
  cardEl.classList.remove('animate');
  void cardEl.offsetWidth;
  cardEl.classList.add('animate');
  stopTimer();
  remaining = duration;
  updateClock();
  completeBtn.disabled = false;
  speechTranscript = '';
  micDenied = false;
}

function stopTimer(){
  running = false;
  clearInterval(timerId);
  startBtn.textContent = 'Start';
  statusDot.classList.remove('live');
  statusText.textContent = 'ready';
  stopSpeechCapture();
}

function tick(){
  remaining--;
  updateClock();
  if(remaining <= 0){
    stopTimer();
    statusText.textContent = "time's up";
  }
}

function startTimer(){
  if(running){
    stopTimer();
    return;
  }
  if(remaining <= 0) remaining = duration;
  running = true;
  startBtn.textContent = 'Pause';
  statusDot.classList.add('live');
  statusText.textContent = 'speaking';
  timerId = setInterval(tick, 1000);
  beginSpeechCapture();
}

function enableControls(){
  startBtn.disabled = false;
  drawBtn.disabled = false;
  completeBtn.disabled = false;
}

/* ---- Evaluation panel ---- */
const evalPanel = document.getElementById('evalPanel');
const evalBody = document.getElementById('evalBody');
const closeEvalBtn = document.getElementById('closeEvalBtn');

closeEvalBtn.addEventListener('click', hideEvalPanel);

function showEvalPanel(){
  evalPanel.classList.remove('hidden');
}
function hideEvalPanel(){
  evalPanel.classList.add('hidden');
}
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function setEvalNote(text){
  evalBody.innerHTML = '<p class="eval-note">' + escapeHtml(text) + '</p>';
}
function setEvalLoading(){
  evalBody.innerHTML = '<p class="eval-loading">Evaluating your response…</p>';
}
function renderEvalResult(scores, feedback, example){
  const dims = [
    ['clarity', 'Clarity'],
    ['structure', 'Structure'],
    ['filler_words', 'Filler words'],
    ['pacing', 'Pacing']
  ];
  const rows = dims.map(([key, label]) => {
    const val = scores ? scores[key] : null;
    if(val === null || val === undefined){
      return '<div class="eval-row"><span class="eval-label">' + label +
        '</span><span></span><span class="eval-score">—</span></div>';
    }
    const pct = Math.max(0, Math.min(100, val * 10));
    return '<div class="eval-row"><span class="eval-label">' + label +
      '</span><div class="eval-bar"><div class="eval-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="eval-score">' + val + '/10</span></div>';
  }).join('');
  const exampleHtml = example && example.trim()
    ? '<div class="eval-example"><span class="eval-example-label">Try something like</span><p>' + escapeHtml(example) + '</p></div>'
    : '';
  evalBody.innerHTML = rows + '<p class="eval-feedback">' + escapeHtml(feedback || '') + '</p>' + exampleHtml;
}

async function evaluateAttempt(topic, transcript, deckId, completionId, wasSpeechSupported, wasMicDenied, elapsedSeconds){
  showEvalPanel();

  if(!wasSpeechSupported){
    setEvalNote("Speech recognition isn't supported in this browser — try Chrome or Edge to get feedback next time. Your completion was still saved.");
    return;
  }
  if(wasMicDenied){
    setEvalNote("Microphone access was denied, so this attempt couldn't be evaluated. Your completion was still saved.");
    return;
  }
  if(!transcript || !transcript.trim()){
    setEvalNote("No speech was captured for this attempt, so there's nothing to evaluate. Your completion was still saved.");
    return;
  }

  setEvalLoading();

  const { data, error } = await sb.functions.invoke('evaluate-speech', {
    body: { topic: topic.text, category: topic.category, transcript, elapsedSeconds }
  });

  if(error || !data || !data.scores){
    setEvalNote('Could not get feedback for this attempt (evaluation service error). Your completion was still saved.');
    return;
  }

  renderEvalResult(data.scores, data.feedback, data.example);

  await sb.from('evaluations').insert({
    user_id: currentUser.id,
    completion_id: completionId,
    deck_id: deckId,
    topic_key: topic.key,
    category: topic.category,
    topic_text: topic.text,
    transcript,
    scores: data.scores,
    feedback: data.feedback || '',
    example: data.example || ''
  });
}

async function markComplete(){
  if(!currentTopic || !currentUser) return;
  completeBtn.disabled = true;

  // Snapshot everything before state moves on to the next topic
  const topicSnapshot = { ...currentTopic };
  const transcriptSnapshot = speechTranscript;
  const deckIdSnapshot = selectedDeckId === 'default' ? null : selectedDeckId;
  const wasSpeechSupported = speechSupported;
  const wasMicDenied = micDenied;
  const elapsedSecondsSnapshot = Math.max(0, duration - remaining);

  const payload = {
    user_id: currentUser.id,
    deck_id: deckIdSnapshot,
    topic_id: topicSnapshot.id || null,
    topic_key: topicSnapshot.key,
    category: topicSnapshot.category,
    text: topicSnapshot.text
  };
  const { data: completionRow, error } = await sb
    .from('completions')
    .insert(payload)
    .select('id')
    .single();
  if(error){
    statusText.textContent = 'error saving';
    completeBtn.disabled = false;
    return;
  }
  const doneKey = topicSnapshot.key;
  topics = topics.filter(t => t.key !== doneKey);
  stopTimer();

  // Fire off evaluation in the background — don't block moving to the next topic
  evaluateAttempt(topicSnapshot, transcriptSnapshot, deckIdSnapshot, completionRow.id, wasSpeechSupported, wasMicDenied, elapsedSecondsSnapshot);

  if(topics.length === 0){
    currentTopic = null;
    handleEmptyDeck("You've completed every topic in this deck. Add more via \"Manage decks\".");
    return;
  }
  newDeck();
  drawTopic();
}

completeBtn.addEventListener('click', markComplete);

function showError(message){
  hideTopicSkeleton();
  errorMsg.innerHTML = message;
  errorMsg.classList.add('show');
  topicText.textContent = 'Could not load topics';
  statusText.textContent = 'error';
}

async function loadDefaultTopics(){
  showTopicSkeleton();
  try{
    const res = await fetch('topics.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if(!Array.isArray(data) || data.length === 0) throw new Error('empty topics.json');
    const mapped = data.map(([category, text]) => ({ id: null, category, text, key: 'default:' + text }));
    const completedKeys = await fetchCompletedKeys(null);
    topics = mapped.filter(t => !completedKeys.has(t.key));
    if(topics.length === 0){
      handleEmptyDeck("You've completed every topic in the default deck. Try a custom deck or create more topics.");
      return;
    }
    finishLoadingTopics();
  }catch(err){
    showError(
      "Couldn't load <code>topics.json</code>. If you opened this file directly " +
      "(file://), browsers block local fetches — run a tiny local server instead, e.g. " +
      "<code>python3 -m http.server</code> in this folder, then open " +
      "<code>http://localhost:8000/index.html</code>."
    );
  }
}

drawBtn.addEventListener('click', () => {
  hideEvalPanel();
  drawTopic();
});
startBtn.addEventListener('click', startTimer);
resetBtn.addEventListener('click', () => {
  stopTimer();
  remaining = duration;
  updateClock();
});
durationSelect.addEventListener('change', (e) => {
  duration = parseInt(e.target.value, 10);
  stopTimer();
  remaining = duration;
  updateClock();
});

/* ---- History / calendar ---- */
let calYear, calMonth;
const historyBtn = document.getElementById('historyBtn');
const historyPanel = document.getElementById('historyPanel');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const calMonthLabel = document.getElementById('calMonthLabel');
const calGrid = document.getElementById('calGrid');
const calSummary = document.getElementById('calSummary');
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

historyBtn.addEventListener('click', () => {
  historyPanel.classList.toggle('hidden');
  decksPanel.classList.add('hidden');
  completedPanel.classList.add('hidden');
  progressPanel.classList.add('hidden');
  if(!historyPanel.classList.contains('hidden')){
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    renderCalendar();
  }
});
closeHistoryBtn.addEventListener('click', () => historyPanel.classList.add('hidden'));
prevMonthBtn.addEventListener('click', () => {
  calMonth--;
  if(calMonth < 0){ calMonth = 11; calYear--; }
  renderCalendar();
});
nextMonthBtn.addEventListener('click', () => {
  calMonth++;
  if(calMonth > 11){ calMonth = 0; calYear++; }
  renderCalendar();
});

async function renderCalendar(){
  calMonthLabel.textContent = monthNames[calMonth] + ' ' + calYear;
  calGrid.innerHTML = Array.from({ length: 35 }).map(() =>
    '<div class="cal-day skel-day"><span class="skel"></span></div>'
  ).join('');

  const startOfMonth = new Date(calYear, calMonth, 1);
  const startOfNextMonth = new Date(calYear, calMonth + 1, 1);

  const { data, error } = await sb
    .from('completions')
    .select('completed_at')
    .gte('completed_at', startOfMonth.toISOString())
    .lt('completed_at', startOfNextMonth.toISOString());

  const counts = {};
  if(!error && data){
    data.forEach(row => {
      const d = new Date(row.completed_at);
      const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      counts[key] = (counts[key] || 0) + 1;
    });
  }

  calGrid.innerHTML = '';
  const firstWeekday = (startOfMonth.getDay() + 6) % 7; // Monday = 0
  for(let i = 0; i < firstWeekday; i++){
    const cell = document.createElement('div');
    cell.className = 'cal-day empty';
    calGrid.appendChild(cell);
  }

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  let total = 0;

  for(let day = 1; day <= daysInMonth; day++){
    const key = calYear + '-' + (calMonth + 1) + '-' + day;
    const count = counts[key] || 0;
    total += count;
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if(today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day){
      cell.classList.add('today');
    }
    if(count > 0){
      const alpha = Math.min(0.14 + count * 0.16, 0.92);
      cell.style.background = 'rgba(245,244,240,' + alpha + ')';
      cell.style.color = '#0a0a0a';
    }
    cell.innerHTML = '<span class="d-num">' + day + '</span>' +
      (count > 0 ? '<span class="d-count">' + count + '</span>' : '');
    calGrid.appendChild(cell);
  }

  calSummary.textContent = total + ' topic' + (total === 1 ? '' : 's') +
    ' completed in ' + monthNames[calMonth];
}

/* ---- Progress panel: streaks + score trend chart ---- */
const progressBtn = document.getElementById('progressBtn');
const progressPanel = document.getElementById('progressPanel');
const closeProgressBtn = document.getElementById('closeProgressBtn');
const currentStreakNum = document.getElementById('currentStreakNum');
const longestStreakNum = document.getElementById('longestStreakNum');
const totalSessionsNum = document.getElementById('totalSessionsNum');
const chartWrap = document.getElementById('chartWrap');
const chartLegend = document.getElementById('chartLegend');

const CHART_METRICS = [
  { key: 'clarity', label: 'Clarity' },
  { key: 'structure', label: 'Structure' },
  { key: 'pacing', label: 'Pacing' },
  { key: 'filler_words', label: 'Filler words' }
];
const chartHiddenMetrics = new Set();
let lastProgressRows = [];

progressBtn.addEventListener('click', () => {
  progressPanel.classList.toggle('hidden');
  decksPanel.classList.add('hidden');
  historyPanel.classList.add('hidden');
  completedPanel.classList.add('hidden');
  if(!progressPanel.classList.contains('hidden')) loadProgress();
});
closeProgressBtn.addEventListener('click', () => progressPanel.classList.add('hidden'));

function dateKey(d){
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function computeStreaks(dates){
  if(dates.length === 0) return { current: 0, longest: 0 };
  const daySet = new Set(dates.map(dateKey));
  const uniqueDays = Array.from(daySet).map(k => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  }).sort((a, b) => a - b);

  let longest = 1, run = 1;
  for(let i = 1; i < uniqueDays.length; i++){
    const diffDays = Math.round((uniqueDays[i] - uniqueDays[i - 1]) / 86400000);
    run = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cursor = new Date(today);
  if(!daySet.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while(daySet.has(dateKey(cursor))){
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, longest };
}

async function loadProgress(){
  chartWrap.innerHTML = '<div class="chart-skel skel"></div>';
  chartLegend.innerHTML = '';
  currentStreakNum.textContent = '—';
  longestStreakNum.textContent = '—';
  totalSessionsNum.textContent = '—';

  const [completionsRes, evaluationsRes] = await Promise.all([
    sb.from('completions').select('completed_at').order('completed_at', { ascending: true }),
    sb.from('evaluations').select('scores, created_at').order('created_at', { ascending: true })
  ]);

  if(completionsRes.error){
    showToast(completionsRes.error.message, true);
  }else{
    const streaks = computeStreaks((completionsRes.data || []).map(r => new Date(r.completed_at)));
    currentStreakNum.textContent = streaks.current;
    longestStreakNum.textContent = streaks.longest;
  }

  if(evaluationsRes.error){
    showToast(evaluationsRes.error.message, true);
    chartWrap.innerHTML = '<p class="empty-note">Could not load your progress.</p>';
    return;
  }

  const rows = (evaluationsRes.data || []).filter(r => r.scores);
  totalSessionsNum.textContent = rows.length;

  if(rows.length === 0){
    chartWrap.innerHTML = '<p class="empty-note">Complete a few practice sessions to see your trend line here.</p>';
    return;
  }

  renderChartLegend();
  renderChart(rows);
}

function renderChartLegend(){
  chartLegend.innerHTML = CHART_METRICS.map(m => {
    const off = chartHiddenMetrics.has(m.key) ? ' off' : '';
    return '<span class="legend-item' + off + '" data-metric="' + m.key + '">' +
      '<span class="legend-swatch ' + m.key + '"></span>' + m.label + '</span>';
  }).join('');
  chartLegend.querySelectorAll('.legend-item').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.metric;
      if(chartHiddenMetrics.has(key)) chartHiddenMetrics.delete(key);
      else chartHiddenMetrics.add(key);
      renderChartLegend();
      renderChart(lastProgressRows);
    });
  });
}

function renderChart(rows){
  lastProgressRows = rows;
  const W = 640, H = 220, padL = 26, padR = 10, padT = 14, padB = 10;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = rows.length;
  const xFor = i => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yFor = v => padT + innerH - (Math.max(0, Math.min(10, v)) / 10) * innerH;

  let gridLines = '';
  for(let g = 0; g <= 10; g += 2){
    const y = yFor(g);
    gridLines += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#ffffff14" stroke-width="1"/>';
    gridLines += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-size="9" fill="#8a8a85" font-family="IBM Plex Mono, monospace">' + g + '</text>';
  }

  const dashPatterns = { clarity: 'none', structure: '7,4', pacing: '2,4', filler_words: '10,3,2,3' };
  const opacities = { clarity: 1, structure: 0.85, pacing: 0.85, filler_words: 0.65 };

  let paths = '';
  CHART_METRICS.forEach(m => {
    if(chartHiddenMetrics.has(m.key)) return;
    const pts = rows.map((r, i) => {
      const v = r.scores ? r.scores[m.key] : null;
      return (v === null || v === undefined) ? null : [xFor(i), yFor(v)];
    });
    let d = '';
    let started = false;
    pts.forEach(p => {
      if(!p){ started = false; return; }
      d += (started ? ' L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      started = true;
    });
    if(!d) return;
    paths += '<path d="' + d + '" fill="none" stroke="#f5f4f0" stroke-width="2" ' +
      'stroke-dasharray="' + dashPatterns[m.key] + '" opacity="' + opacities[m.key] + '" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>';
    pts.forEach(p => {
      if(p) paths += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6" fill="#f5f4f0" opacity="' + opacities[m.key] + '"/>';
    });
  });

  chartWrap.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="progress-chart">' + gridLines + paths + '</svg>';
}

updateClock();