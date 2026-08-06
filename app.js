/* ---- Supabase setup ---- */
const SUPABASE_URL = 'https://epetjjagenqmezgbdyxk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Nrs1bv1Hz9g_G3j0R5zBdA_JiTkx-8Z';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let authMode = 'login'; // 'login' | 'signup'

const authStage = document.getElementById('authStage');
const appStage = document.getElementById('appStage');
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

function showAuthScreen(){
  authStage.classList.remove('hidden');
  appStage.classList.add('hidden');
}

function showAppScreen(user){
  authStage.classList.add('hidden');
  appStage.classList.remove('hidden');
  userEmail.textContent = user.email;
  currentUser = user;
  loadUserDecks();
  if(topics.length === 0) loadActiveDeckTopics();
}

sb.auth.onAuthStateChange((event, session) => {
  if(session && session.user){
    showAppScreen(session.user);
  }else{
    showAuthScreen();
  }
});

sb.auth.getSession().then(({ data }) => {
  if(data.session && data.session.user){
    showAppScreen(data.session.user);
  }else{
    showAuthScreen();
  }
});

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
const decksPanelMsg = document.getElementById('decksPanelMsg');
const closeDecksBtn = document.getElementById('closeDecksBtn');

function setPanelMsg(text, isErr){
  decksPanelMsg.textContent = text || '';
  decksPanelMsg.classList.toggle('err', !!isErr);
}

async function loadUserDecks(){
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
  if(!confirm('Delete this deck and all its topics?')) return;
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
  deckTopicList.innerHTML = '<li><span class="empty-note">Loading…</span></li>';
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
const completedPanelMsg = document.getElementById('completedPanelMsg');
const closeCompletedBtn = document.getElementById('closeCompletedBtn');

completedBtn.addEventListener('click', () => {
  completedPanel.classList.toggle('hidden');
  decksPanel.classList.add('hidden');
  historyPanel.classList.add('hidden');
  if(!completedPanel.classList.contains('hidden')) renderCompletedList();
});
closeCompletedBtn.addEventListener('click', () => completedPanel.classList.add('hidden'));

function setCompletedMsg(text, isErr){
  completedPanelMsg.textContent = text || '';
  completedPanelMsg.classList.toggle('err', !!isErr);
}

async function renderCompletedList(){
  const deckLabel = deckSelect.options[deckSelect.selectedIndex]
    ? deckSelect.options[deckSelect.selectedIndex].textContent
    : 'Default deck';
  completedDeckName.textContent = deckLabel;
  completedList.innerHTML = '<li><span class="empty-note">Loading…</span></li>';
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

function handleEmptyDeck(message){
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
let remaining = 90;
let duration = 90;
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
}

function stopTimer(){
  running = false;
  clearInterval(timerId);
  startBtn.textContent = 'Start';
  statusDot.classList.remove('live');
  statusText.textContent = 'ready';
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
}

function enableControls(){
  startBtn.disabled = false;
  drawBtn.disabled = false;
  completeBtn.disabled = false;
}

async function markComplete(){
  if(!currentTopic || !currentUser) return;
  completeBtn.disabled = true;
  const payload = {
    user_id: currentUser.id,
    deck_id: selectedDeckId === 'default' ? null : selectedDeckId,
    topic_id: currentTopic.id || null,
    topic_key: currentTopic.key,
    category: currentTopic.category,
    text: currentTopic.text
  };
  const { error } = await sb.from('completions').insert(payload);
  if(error){
    statusText.textContent = 'error saving';
    completeBtn.disabled = false;
    return;
  }
  const doneKey = currentTopic.key;
  topics = topics.filter(t => t.key !== doneKey);
  stopTimer();
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
  errorMsg.innerHTML = message;
  errorMsg.classList.add('show');
  topicText.textContent = 'Could not load topics';
  statusText.textContent = 'error';
}

async function loadDefaultTopics(){
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

drawBtn.addEventListener('click', drawTopic);
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
  calGrid.innerHTML = '<div class="empty-note" style="grid-column:1/-1;text-align:center;">Loading…</div>';

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

updateClock();