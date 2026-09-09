/* ---- Turn-based conversation practice ---- */
const conversationBtn = document.getElementById('conversationBtn');
const conversationPanel = document.getElementById('conversationPanel');
const conversationSetup = document.getElementById('conversationSetup');
const conversationActive = document.getElementById('conversationActive');
const conversationModeCards = Array.from(document.querySelectorAll('[data-conversation-mode]'));
const conversationFocusLabel = document.getElementById('conversationFocusLabel');
const conversationFocus = document.getElementById('conversationFocus');
const conversationAgentRoleField = document.getElementById('conversationAgentRoleField');
const conversationAgentRole = document.getElementById('conversationAgentRole');
const conversationTurnLimit = document.getElementById('conversationTurnLimit');
const startConversationBtn = document.getElementById('startConversationBtn');
const conversationStatus = document.getElementById('conversationStatus');
const conversationModeLabel = document.getElementById('conversationModeLabel');
const conversationActiveTitle = document.getElementById('conversationActiveTitle');
const conversationProgress = document.getElementById('conversationProgress');
const conversationMessages = document.getElementById('conversationMessages');
const conversationRecordBtn = document.getElementById('conversationRecordBtn');
const conversationActiveStatus = document.getElementById('conversationActiveStatus');
const leaveConversationBtn = document.getElementById('leaveConversationBtn');

const CONVERSATION_MODE_UI = {
  mock_interview: {
    label: 'Mock interview',
    focusLabel: 'Role or interview focus',
    focusPlaceholder: 'e.g. Mid-level frontend developer interview',
    minTurns: 3,
    maxTurns: 8,
    defaultTurns: 5
  },
  difficult_conversation: {
    label: 'Difficult conversation',
    focusLabel: 'What needs to be discussed?',
    focusPlaceholder: 'e.g. Repeatedly missed deadlines on a shared project',
    minTurns: 4,
    maxTurns: 10,
    defaultTurns: 6
  }
};

let selectedConversationMode = 'mock_interview';
let currentConversationSession = null;
let conversationStream = null;
let conversationRecorder = null;
let conversationChunks = [];
let conversationRecordingStartedAt = 0;
let conversationMaxRecordingTimer = null;
let pendingConversationPayload = null;
const renderedConversationTurnIds = new Set();

function setConversationMode(mode) {
  if (!CONVERSATION_MODE_UI[mode]) return;
  selectedConversationMode = mode;
  const config = CONVERSATION_MODE_UI[mode];

  conversationModeCards.forEach(card => {
    card.classList.toggle('active', card.dataset.conversationMode === mode);
  });
  conversationFocusLabel.textContent = config.focusLabel;
  conversationFocus.placeholder = config.focusPlaceholder;
  conversationAgentRoleField.classList.toggle('hidden', mode !== 'difficult_conversation');
  conversationTurnLimit.innerHTML = '';
  for (let count = config.minTurns; count <= config.maxTurns; count++) {
    const option = document.createElement('option');
    option.value = String(count);
    option.textContent = String(count);
    option.selected = count === config.defaultTurns;
    conversationTurnLimit.appendChild(option);
  }
  conversationStatus.textContent = '';
}

function showConversationPanel() {
  if (running || (mediaRecorder && mediaRecorder.state !== 'inactive')) {
    stopTimer();
    finalizeSpeechCapture();
    resetCaptions();
  }
  decksPanel.classList.add('hidden');
  historyPanel.classList.add('hidden');
  completedPanel.classList.add('hidden');
  progressPanel.classList.add('hidden');
  document.getElementById('practiceSection').classList.add('hidden');
  conversationPanel.classList.remove('hidden');
  document.querySelectorAll('.main-nav .nav-link').forEach(link => link.classList.remove('active'));
  conversationBtn.classList.add('active');
}

function renderConversationMessage(turn) {
  if (turn.id && renderedConversationTurnIds.has(turn.id)) return;
  const message = document.createElement('div');
  message.className = 'conversation-message ' + turn.role;

  const role = document.createElement('span');
  role.className = 'conversation-message-role';
  role.textContent = turn.role === 'agent' ? 'Agent' : 'You';

  const content = document.createElement('div');
  content.textContent = turn.content;
  message.appendChild(role);
  message.appendChild(content);
  conversationMessages.appendChild(message);
  if (turn.id) renderedConversationTurnIds.add(turn.id);
  conversationMessages.scrollTop = conversationMessages.scrollHeight;
}

async function edgeFunctionErrorDetails(error, fallback) {
  if (!error) return { message: fallback, status: 0, recoverable: false };
  let body = null;
  try {
    body = await error.context.json();
  } catch (e) { /* retain fallback */ }
  return {
    message: body && body.error ? body.error : (error.message || fallback),
    status: error.context && error.context.status ? error.context.status : 0,
    recoverable: !!(body && body.recoverable)
  };
}

async function edgeFunctionErrorMessage(error, fallback) {
  return (await edgeFunctionErrorDetails(error, fallback)).message;
}

async function startConversation() {
  const focus = conversationFocus.value.trim();
  const agentRole = conversationAgentRole.value.trim();
  const turnLimit = Number.parseInt(conversationTurnLimit.value, 10);

  if (focus.length < 3) {
    conversationStatus.textContent = 'Describe what you want to practise.';
    conversationFocus.focus();
    return;
  }
  if (selectedConversationMode === 'difficult_conversation' && !agentRole) {
    conversationStatus.textContent = 'Describe who the agent should play.';
    conversationAgentRole.focus();
    return;
  }

  startConversationBtn.disabled = true;
  conversationModeCards.forEach(card => { card.disabled = true; });
  conversationStatus.textContent = 'Preparing the conversation…';

  const { data, error } = await sb.functions.invoke('conversation-start', {
    body: {
      mode: selectedConversationMode,
      focus,
      agentRole: selectedConversationMode === 'difficult_conversation' ? agentRole : undefined,
      turnLimit
    }
  });

  startConversationBtn.disabled = false;
  conversationModeCards.forEach(card => { card.disabled = false; });
  if (error || !data || !data.session || !data.openingTurn) {
    conversationStatus.textContent = await edgeFunctionErrorMessage(error, 'Could not start the conversation.');
    return;
  }

  currentConversationSession = data.session;
  pendingConversationPayload = null;
  renderedConversationTurnIds.clear();
  conversationMessages.innerHTML = '';
  renderConversationMessage(data.openingTurn);
  conversationModeLabel.textContent = data.mode && data.mode.label
    ? data.mode.label
    : CONVERSATION_MODE_UI[selectedConversationMode].label;
  conversationActiveTitle.textContent = focus;
  conversationProgress.textContent = '0 of ' + data.session.turn_limit + ' responses';
  conversationStatus.textContent = '';
  conversationSetup.classList.add('hidden');
  conversationActive.classList.remove('hidden');
  conversationRecordBtn.disabled = false;
  conversationRecordBtn.textContent = 'Record response';
  conversationActiveStatus.textContent = 'Ready for your response.';
}

function conversationAudioMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];
  return candidates.find(type => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) || '';
}

function releaseConversationStream() {
  if (conversationStream) {
    conversationStream.getTracks().forEach(track => track.stop());
    conversationStream = null;
  }
}

async function beginConversationRecording() {
  if (!currentConversationSession || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    conversationActiveStatus.textContent = 'Audio recording is not supported in this browser.';
    return;
  }

  pendingConversationPayload = null;
  conversationChunks = [];
  conversationRecordBtn.disabled = true;
  conversationActiveStatus.textContent = 'Requesting microphone access…';
  try {
    conversationStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = conversationAudioMimeType();
    const options = { audioBitsPerSecond: 32000 };
    if (mimeType) options.mimeType = mimeType;
    conversationRecorder = new MediaRecorder(conversationStream, options);
    conversationRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) conversationChunks.push(event.data);
    };
    conversationRecorder.start(1000);
    conversationRecordingStartedAt = performance.now();
    clearTimeout(conversationMaxRecordingTimer);
    conversationMaxRecordingTimer = setTimeout(() => {
      if (conversationRecorder && conversationRecorder.state === 'recording') {
        conversationActiveStatus.textContent = 'Five-minute recording limit reached. Sending your response…';
        stopAndSendConversationRecording();
      }
    }, 300000);
    conversationRecordBtn.disabled = false;
    conversationRecordBtn.textContent = 'Stop & send';
    conversationRecordBtn.classList.add('recording');
    conversationActiveStatus.textContent = 'Recording… respond naturally, then stop when you’re finished.';
  } catch (error) {
    releaseConversationStream();
    conversationRecordBtn.disabled = false;
    conversationRecordBtn.textContent = 'Record response';
    conversationActiveStatus.textContent = 'Microphone access was blocked or recording could not start.';
  }
}

function finalizeConversationRecording() {
  clearTimeout(conversationMaxRecordingTimer);
  if (!conversationRecorder || conversationRecorder.state === 'inactive') {
    releaseConversationStream();
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    const mimeType = conversationRecorder.mimeType || 'audio/webm';
    conversationRecorder.onstop = () => {
      const blob = conversationChunks.length ? new Blob(conversationChunks, { type: mimeType }) : null;
      conversationChunks = [];
      releaseConversationStream();
      resolve(blob);
    };
    try {
      conversationRecorder.stop();
    } catch (error) {
      releaseConversationStream();
      resolve(null);
    }
  });
}

async function discardConversationRecording() {
  await finalizeConversationRecording();
  conversationChunks = [];
  conversationRecordBtn.classList.remove('recording');
  conversationRecordBtn.textContent = 'Record response';
}

function conversationBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function sendConversationTurn() {
  if (!pendingConversationPayload || !currentConversationSession) return;
  conversationRecordBtn.disabled = true;
  leaveConversationBtn.disabled = true;
  conversationRecordBtn.textContent = 'Sending…';
  conversationActiveStatus.textContent = 'Transcribing your response and preparing the next turn…';

  const { data, error } = await sb.functions.invoke('converse-turn', {
    body: pendingConversationPayload
  });

  leaveConversationBtn.disabled = false;
  if (error || !data || !data.userTurn || !data.agentTurn) {
    const details = await edgeFunctionErrorDetails(error, 'Could not process this response.');
    conversationActiveStatus.textContent = details.message;
    conversationRecordBtn.disabled = false;
    if (details.status === 422) {
      pendingConversationPayload = null;
      conversationRecordBtn.textContent = 'Record again';
    } else {
      conversationRecordBtn.textContent = 'Retry turn';
    }
    return;
  }

  pendingConversationPayload = null;
  renderConversationMessage(data.userTurn);
  renderConversationMessage(data.agentTurn);
  conversationProgress.textContent = data.responseCount + ' of ' + currentConversationSession.turn_limit + ' responses';
  conversationRecordBtn.classList.remove('recording');

  if (data.shouldEnd) {
    currentConversationSession.status = 'completed';
    conversationRecordBtn.disabled = true;
    conversationRecordBtn.textContent = 'Conversation complete';
    conversationActiveStatus.textContent = 'Conversation complete. The summary evaluation is added in Step 4.';
  } else {
    conversationRecordBtn.disabled = false;
    conversationRecordBtn.textContent = 'Record response';
    conversationActiveStatus.textContent = 'Ready for your next response.';
  }
}

async function stopAndSendConversationRecording() {
  conversationRecordBtn.disabled = true;
  const durationSeconds = Math.max(1, (performance.now() - conversationRecordingStartedAt) / 1000);
  const blob = await finalizeConversationRecording();
  conversationRecordBtn.classList.remove('recording');
  if (!blob || blob.size === 0) {
    conversationRecordBtn.disabled = false;
    conversationRecordBtn.textContent = 'Record again';
    conversationActiveStatus.textContent = 'No audio was captured. Please try again.';
    return;
  }

  try {
    pendingConversationPayload = {
      sessionId: currentConversationSession.id,
      requestId: crypto.randomUUID(),
      audioBase64: await conversationBlobToBase64(blob),
      mimeType: blob.type || 'audio/webm',
      durationSeconds
    };
  } catch (error) {
    conversationRecordBtn.disabled = false;
    conversationRecordBtn.textContent = 'Record again';
    conversationActiveStatus.textContent = 'Could not prepare this recording.';
    return;
  }
  await sendConversationTurn();
}

async function handleConversationRecordButton() {
  if (pendingConversationPayload) {
    await sendConversationTurn();
  } else if (conversationRecorder && conversationRecorder.state === 'recording') {
    await stopAndSendConversationRecording();
  } else {
    await beginConversationRecording();
  }
}

async function leaveConversation() {
  if (!currentConversationSession) return;
  const confirmed = await customConfirm('Delete this conversation and all of its saved turns?');
  if (!confirmed) return;

  await discardConversationRecording();
  leaveConversationBtn.disabled = true;
  const { error } = await sb
    .from('conversation_sessions')
    .delete()
    .eq('id', currentConversationSession.id);
  leaveConversationBtn.disabled = false;
  if (error) {
    showToast(error.message, true);
    return;
  }

  currentConversationSession = null;
  pendingConversationPayload = null;
  renderedConversationTurnIds.clear();
  conversationMessages.innerHTML = '';
  conversationActive.classList.add('hidden');
  conversationSetup.classList.remove('hidden');
  conversationStatus.textContent = '';
  showToast('Conversation removed.');
}

conversationModeCards.forEach(card => {
  card.addEventListener('click', () => setConversationMode(card.dataset.conversationMode));
});
conversationBtn.addEventListener('click', showConversationPanel);
startConversationBtn.addEventListener('click', startConversation);
conversationRecordBtn.addEventListener('click', handleConversationRecordButton);
leaveConversationBtn.addEventListener('click', leaveConversation);

// Existing navigation owns its own panels; make it close this one as well.
[practiceNavBtn, manageDecksBtn, completedBtn, historyBtn, progressBtn].forEach(button => {
  button.addEventListener('click', () => {
    if (conversationRecorder && conversationRecorder.state !== 'inactive') {
      discardConversationRecording();
      conversationActiveStatus.textContent = 'Recording discarded because you left the conversation.';
    }
    conversationPanel.classList.add('hidden');
  });
});

logoutBtn.addEventListener('click', () => {
  if (conversationRecorder && conversationRecorder.state !== 'inactive') {
    discardConversationRecording();
  }
  pendingConversationPayload = null;
});

setConversationMode(selectedConversationMode);
