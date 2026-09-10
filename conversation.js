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
const conversationEvaluation = document.getElementById('conversationEvaluation');
const conversationEvaluationState = document.getElementById('conversationEvaluationState');
const conversationEvaluationDetails = document.getElementById('conversationEvaluationDetails');
const conversationEvaluationSummary = document.getElementById('conversationEvaluationSummary');
const conversationEvaluationStats = document.getElementById('conversationEvaluationStats');
const conversationEvaluationScores = document.getElementById('conversationEvaluationScores');
const conversationEvaluationStrengths = document.getElementById('conversationEvaluationStrengths');
const conversationEvaluationPriorities = document.getElementById('conversationEvaluationPriorities');
const conversationEvaluationFeedback = document.getElementById('conversationEvaluationFeedback');
const conversationEvaluationRetryBtn = document.getElementById('conversationEvaluationRetryBtn');
const conversationAutoVoice = document.getElementById('conversationAutoVoice');
const conversationHandsFree = document.getElementById('conversationHandsFree');
const conversationContinuous = document.getElementById('conversationContinuous');
const conversationStopVoiceBtn = document.getElementById('conversationStopVoiceBtn');
const conversationRecordBtn = document.getElementById('conversationRecordBtn');
const conversationPauseBtn = document.getElementById('conversationPauseBtn');
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

const CONVERSATION_SCORE_LABELS = {
  clarity: 'Clarity',
  structure: 'Structure',
  specificity: 'Specificity',
  delivery_fluency: 'Delivery fluency',
  filler_words: 'Filler words',
  average_speaking_rate: 'Speaking rate'
};

let selectedConversationMode = 'mock_interview';
let currentConversationSession = null;
let conversationStream = null;
let conversationRecorder = null;
let conversationChunks = [];
let conversationRecordingStartedAt = 0;
let conversationMaxRecordingTimer = null;
let conversationAudioContext = null;
let conversationAudioSource = null;
let conversationAudioAnalyser = null;
let conversationSilenceFrame = null;
let conversationAutoListenTimer = null;
let continuousConversationActive = false;
let conversationEvaluationRequestVersion = 0;
let pendingConversationPayload = null;
const renderedConversationTurnIds = new Set();
const conversationVoiceSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const ConversationAudioContext = window.AudioContext || window.webkitAudioContext;
const conversationHandsFreeSupported = !!ConversationAudioContext;
const CONVERSATION_SILENCE_MS = 1800;
const CONVERSATION_MIN_VOICE_MS = 180;
let activeConversationUtterance = null;
let activeConversationVoiceButton = null;

function preferredConversationVoice() {
  if (!conversationVoiceSupported) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(voice => voice.lang === 'en-US' && voice.localService) ||
    voices.find(voice => voice.lang && voice.lang.toLowerCase().startsWith('en') && voice.localService) ||
    voices.find(voice => voice.lang === 'en-US') ||
    voices.find(voice => voice.lang && voice.lang.toLowerCase().startsWith('en')) ||
    null;
}

function stopConversationVoice() {
  const previousVoiceButton = activeConversationVoiceButton;
  activeConversationUtterance = null;
  activeConversationVoiceButton = null;
  if (conversationVoiceSupported) window.speechSynthesis.cancel();
  if (previousVoiceButton) {
    previousVoiceButton.textContent = 'Listen';
    previousVoiceButton.setAttribute('aria-label', 'Read this agent message aloud');
  }
  conversationStopVoiceBtn.disabled = true;
}

function speakConversationText(text, button, onFinished = null) {
  if (!conversationVoiceSupported || !text) return false;
  if (conversationRecorder && conversationRecorder.state === 'recording') {
    conversationActiveStatus.textContent = 'Finish or pause your recording before playing an agent message.';
    return false;
  }
  if (activeConversationVoiceButton === button && window.speechSynthesis.speaking) {
    stopConversationVoice();
    if (continuousConversationActive) scheduleContinuousConversationRecording();
    return false;
  }

  stopConversationVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.95;
  const voice = preferredConversationVoice();
  if (voice) utterance.voice = voice;

  activeConversationUtterance = utterance;
  activeConversationVoiceButton = button;
  button.textContent = 'Stop';
  button.setAttribute('aria-label', 'Stop reading this agent message');
  conversationStopVoiceBtn.disabled = false;

  const finish = () => {
    if (activeConversationUtterance !== utterance) return;
    activeConversationUtterance = null;
    activeConversationVoiceButton = null;
    button.textContent = 'Listen';
    button.setAttribute('aria-label', 'Read this agent message aloud');
    conversationStopVoiceBtn.disabled = true;
    if (onFinished) onFinished();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);
  return true;
}

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

function renderConversationMessage(turn, autoSpeak = false, onAutoSpeechEnd = null) {
  if (turn.id && renderedConversationTurnIds.has(turn.id)) return false;
  const message = document.createElement('div');
  message.className = 'conversation-message ' + turn.role;

  const messageHead = document.createElement('div');
  messageHead.className = 'conversation-message-head';
  const role = document.createElement('span');
  role.className = 'conversation-message-role';
  role.textContent = turn.role === 'agent' ? 'Agent' : 'You';
  messageHead.appendChild(role);

  let voiceButton = null;
  if (turn.role === 'agent' && conversationVoiceSupported) {
    voiceButton = document.createElement('button');
    voiceButton.className = 'conversation-voice-button';
    voiceButton.type = 'button';
    voiceButton.textContent = 'Listen';
    voiceButton.setAttribute('aria-label', 'Read this agent message aloud');
    voiceButton.addEventListener('click', () => speakConversationText(turn.content, voiceButton));
    messageHead.appendChild(voiceButton);
  }

  const content = document.createElement('div');
  content.textContent = turn.content;
  message.appendChild(messageHead);
  message.appendChild(content);
  conversationMessages.appendChild(message);
  if (turn.id) renderedConversationTurnIds.add(turn.id);
  conversationMessages.scrollTop = conversationMessages.scrollHeight;
  if (voiceButton && autoSpeak && conversationAutoVoice.checked) {
    return speakConversationText(turn.content, voiceButton, onAutoSpeechEnd);
  }
  return false;
}

function resetConversationEvaluation() {
  conversationEvaluationRequestVersion++;
  conversationEvaluation.classList.add('hidden');
  conversationEvaluationDetails.classList.add('hidden');
  conversationEvaluationRetryBtn.classList.add('hidden');
  conversationEvaluationRetryBtn.disabled = false;
  conversationEvaluationState.textContent = '';
  conversationEvaluationSummary.textContent = '';
  conversationEvaluationStats.textContent = '';
  conversationEvaluationScores.replaceChildren();
  conversationEvaluationStrengths.replaceChildren();
  conversationEvaluationPriorities.replaceChildren();
  conversationEvaluationFeedback.textContent = '';
}

function renderConversationScoreCards(scores) {
  conversationEvaluationScores.replaceChildren();
  Object.entries(CONVERSATION_SCORE_LABELS).forEach(([key, label]) => {
    const card = document.createElement('div');
    card.className = 'conversation-score-card';
    const value = document.createElement('strong');
    const score = scores && typeof scores[key] === 'number' ? scores[key] : null;
    value.textContent = score === null ? '—' : score + '/10';
    const name = document.createElement('span');
    name.textContent = label;
    card.appendChild(value);
    card.appendChild(name);
    conversationEvaluationScores.appendChild(card);
  });
}

function renderConversationCoachingItems(container, items, copyKey) {
  container.replaceChildren();
  (Array.isArray(items) ? items : []).forEach(item => {
    const row = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = item && item.title ? item.title : 'Observation';
    const evidence = document.createElement('q');
    evidence.textContent = item && item.evidence ? item.evidence : '';
    const copy = document.createElement('p');
    copy.textContent = item && item[copyKey] ? item[copyKey] : '';
    row.appendChild(title);
    row.appendChild(evidence);
    row.appendChild(copy);
    container.appendChild(row);
  });
}

function renderConversationEvaluation(evaluation, stats) {
  conversationEvaluationState.textContent = '';
  conversationEvaluationRetryBtn.classList.add('hidden');
  conversationEvaluationSummary.textContent = evaluation.summary || '';
  if (stats) {
    const parts = [
      stats.responseCount + (stats.responseCount === 1 ? ' response' : ' responses'),
      stats.wordCount + ' words',
      stats.fillerTotal + (stats.fillerTotal === 1 ? ' possible filler' : ' possible fillers')
    ];
    if (typeof stats.averageWpm === 'number') parts.push(stats.averageWpm + ' average WPM');
    conversationEvaluationStats.textContent = parts.join(' · ');
  }
  renderConversationScoreCards(evaluation.scores);
  renderConversationCoachingItems(conversationEvaluationStrengths, evaluation.strengths, 'detail');
  renderConversationCoachingItems(conversationEvaluationPriorities, evaluation.priorities, 'action');
  conversationEvaluationFeedback.textContent = evaluation.feedback || '';
  conversationEvaluationDetails.classList.remove('hidden');
}

async function generateConversationEvaluation() {
  if (!currentConversationSession || currentConversationSession.status !== 'completed') return;
  const sessionId = currentConversationSession.id;
  const requestVersion = ++conversationEvaluationRequestVersion;
  conversationEvaluation.classList.remove('hidden');
  conversationEvaluationDetails.classList.add('hidden');
  conversationEvaluationRetryBtn.classList.add('hidden');
  conversationEvaluationRetryBtn.disabled = true;
  conversationEvaluationState.textContent = 'Reviewing your full conversation…';

  const { data, error } = await invokeAuthenticatedConversationFunction('conversation-evaluate', { sessionId });
  if (requestVersion !== conversationEvaluationRequestVersion ||
      !currentConversationSession || currentConversationSession.id !== sessionId) return;

  conversationEvaluationRetryBtn.disabled = false;
  if (error || !data || !data.evaluation) {
    conversationEvaluationState.textContent = await edgeFunctionErrorMessage(
      error,
      'The session feedback could not be generated.'
    );
    conversationEvaluationRetryBtn.classList.remove('hidden');
    conversationActiveStatus.textContent = 'Conversation complete. Retry the evaluation when you are ready.';
    return;
  }

  renderConversationEvaluation(data.evaluation, data.stats);
  conversationActiveStatus.textContent = 'Conversation complete. Your session review is ready.';
  conversationEvaluation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

async function invokeAuthenticatedConversationFunction(functionName, body) {
  let { data: sessionData, error: sessionError } = await sb.auth.getSession();
  let session = sessionData && sessionData.session;

  if (!sessionError && session && session.expires_at && session.expires_at * 1000 <= Date.now() + 30000) {
    const refreshed = await sb.auth.refreshSession();
    sessionError = refreshed.error;
    session = refreshed.data && refreshed.data.session;
  }

  if (sessionError || !session || !session.access_token) {
    return {
      data: null,
      error: new Error('Your login session expired. Please log out and sign in again.')
    };
  }

  return sb.functions.invoke(functionName, {
    body,
    headers: { Authorization: 'Bearer ' + session.access_token }
  });
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

  const { data, error } = await invokeAuthenticatedConversationFunction('conversation-start', {
    mode: selectedConversationMode,
    focus,
    agentRole: selectedConversationMode === 'difficult_conversation' ? agentRole : undefined,
    turnLimit
  });

  startConversationBtn.disabled = false;
  conversationModeCards.forEach(card => { card.disabled = false; });
  if (error || !data || !data.session || !data.openingTurn) {
    conversationStatus.textContent = await edgeFunctionErrorMessage(error, 'Could not start the conversation.');
    return;
  }

  currentConversationSession = data.session;
  setContinuousConversationActive(false);
  resetConversationEvaluation();
  pendingConversationPayload = null;
  renderedConversationTurnIds.clear();
  conversationMessages.innerHTML = '';
  renderConversationMessage(data.openingTurn, true);
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

function clearConversationAutoListenTimer() {
  clearTimeout(conversationAutoListenTimer);
  conversationAutoListenTimer = null;
}

function setContinuousConversationActive(active) {
  continuousConversationActive = !!active;
  if (!continuousConversationActive) clearConversationAutoListenTimer();
  conversationPauseBtn.classList.toggle('hidden', !continuousConversationActive);
}

function scheduleContinuousConversationRecording() {
  clearConversationAutoListenTimer();
  if (!continuousConversationActive || !currentConversationSession ||
      currentConversationSession.status === 'completed' || pendingConversationPayload ||
      (conversationRecorder && conversationRecorder.state === 'recording')) return;

  conversationRecordBtn.disabled = true;
  conversationRecordBtn.textContent = 'Listening will resume…';
  conversationActiveStatus.textContent = 'Your turn is next. Starting the microphone…';
  conversationAutoListenTimer = setTimeout(() => {
    conversationAutoListenTimer = null;
    if (continuousConversationActive) beginConversationRecording(false);
  }, 400);
}

function stopConversationSilenceDetection() {
  if (conversationSilenceFrame !== null) {
    cancelAnimationFrame(conversationSilenceFrame);
    conversationSilenceFrame = null;
  }
  if (conversationAudioSource) conversationAudioSource.disconnect();
  if (conversationAudioAnalyser) conversationAudioAnalyser.disconnect();
  conversationAudioSource = null;
  conversationAudioAnalyser = null;
  if (conversationAudioContext) {
    const audioContext = conversationAudioContext;
    conversationAudioContext = null;
    audioContext.close().catch(() => {});
  }
}

async function startConversationSilenceDetection() {
  stopConversationSilenceDetection();
  if (!conversationHandsFree.checked || !conversationHandsFreeSupported || !conversationStream) return false;

  try {
    const audioContext = new ConversationAudioContext();
    conversationAudioContext = audioContext;
    if (audioContext.state === 'suspended') await audioContext.resume();
    if (conversationAudioContext !== audioContext || !conversationStream) {
      audioContext.close().catch(() => {});
      return false;
    }

    const source = audioContext.createMediaStreamSource(conversationStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.2;
    source.connect(analyser);
    conversationAudioSource = source;
    conversationAudioAnalyser = analyser;

    const samples = new Float32Array(analyser.fftSize);
    let noiseFloor = 0.004;
    let candidateVoiceMs = 0;
    let speechDetected = false;
    let lastSpeechAt = 0;
    let previousSampleAt = performance.now();

    const monitorLevel = () => {
      if (conversationAudioAnalyser !== analyser ||
          !conversationRecorder || conversationRecorder.state !== 'recording') return;

      analyser.getFloatTimeDomainData(samples);
      let sumSquares = 0;
      for (let index = 0; index < samples.length; index++) {
        sumSquares += samples[index] * samples[index];
      }
      const level = Math.sqrt(sumSquares / samples.length);
      const now = performance.now();
      const elapsed = Math.min(50, now - previousSampleAt);
      previousSampleAt = now;

      if (!speechDetected && level < 0.02) {
        noiseFloor = Math.min(0.012, noiseFloor * 0.95 + level * 0.05);
      }
      const speechThreshold = Math.max(0.012, noiseFloor * 3);
      if (level >= speechThreshold) {
        candidateVoiceMs += elapsed;
        if (candidateVoiceMs >= CONVERSATION_MIN_VOICE_MS) speechDetected = true;
        if (speechDetected) lastSpeechAt = now;
      } else if (!speechDetected) {
        candidateVoiceMs = Math.max(0, candidateVoiceMs - elapsed * 2);
      }

      if (speechDetected && now - lastSpeechAt >= CONVERSATION_SILENCE_MS) {
        stopConversationSilenceDetection();
        conversationActiveStatus.textContent = 'Silence detected. Sending your response…';
        stopAndSendConversationRecording();
        return;
      }
      conversationSilenceFrame = requestAnimationFrame(monitorLevel);
    };

    conversationSilenceFrame = requestAnimationFrame(monitorLevel);
    return true;
  } catch (error) {
    stopConversationSilenceDetection();
    console.warn('Hands-free silence detection could not start:', error);
    return false;
  }
}

function releaseConversationStream() {
  stopConversationSilenceDetection();
  if (conversationStream) {
    conversationStream.getTracks().forEach(track => track.stop());
    conversationStream = null;
  }
}

async function beginConversationRecording(activateContinuous = true) {
  if (!currentConversationSession || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    conversationActiveStatus.textContent = 'Audio recording is not supported in this browser.';
    return;
  }

  clearConversationAutoListenTimer();
  if (activateContinuous && conversationContinuous.checked) {
    setContinuousConversationActive(true);
  }
  stopConversationVoice();
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
    const handsFreeActive = await startConversationSilenceDetection();
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
    conversationActiveStatus.textContent = handsFreeActive
      ? 'Listening… your response sends after a brief silence. You can also stop it manually.'
      : 'Recording… respond naturally, then stop when you’re finished.';
  } catch (error) {
    releaseConversationStream();
    setContinuousConversationActive(false);
    conversationRecordBtn.disabled = false;
    conversationRecordBtn.textContent = 'Record response';
    conversationActiveStatus.textContent = 'Microphone access was blocked or recording could not start.';
  }
}

function finalizeConversationRecording() {
  clearTimeout(conversationMaxRecordingTimer);
  stopConversationSilenceDetection();
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

  const { data, error } = await invokeAuthenticatedConversationFunction(
    'converse-turn',
    pendingConversationPayload
  );

  leaveConversationBtn.disabled = false;
  if (error || !data || !data.userTurn || !data.agentTurn) {
    setContinuousConversationActive(false);
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
  const agentVoiceStarted = renderConversationMessage(
    data.agentTurn,
    true,
    data.shouldEnd ? null : scheduleContinuousConversationRecording
  );
  conversationProgress.textContent = data.responseCount + ' of ' + currentConversationSession.turn_limit + ' responses';
  conversationRecordBtn.classList.remove('recording');

  if (data.shouldEnd) {
    currentConversationSession.status = 'completed';
    setContinuousConversationActive(false);
    conversationRecordBtn.disabled = true;
    conversationRecordBtn.textContent = 'Conversation complete';
    conversationActiveStatus.textContent = 'Conversation complete. Preparing your session review…';
    generateConversationEvaluation();
  } else {
    if (continuousConversationActive) {
      conversationRecordBtn.disabled = true;
      conversationRecordBtn.textContent = agentVoiceStarted ? 'Waiting for agent…' : 'Listening will resume…';
      conversationActiveStatus.textContent = agentVoiceStarted
        ? 'Agent speaking… listening will resume when the agent finishes.'
        : 'Starting the microphone for your next response…';
      if (!agentVoiceStarted) scheduleContinuousConversationRecording();
    } else {
      conversationRecordBtn.disabled = false;
      conversationRecordBtn.textContent = 'Record response';
      conversationActiveStatus.textContent = 'Ready for your next response.';
    }
  }
}

async function stopAndSendConversationRecording() {
  conversationRecordBtn.disabled = true;
  const durationSeconds = Math.max(1, (performance.now() - conversationRecordingStartedAt) / 1000);
  const blob = await finalizeConversationRecording();
  conversationRecordBtn.classList.remove('recording');
  if (!blob || blob.size === 0) {
    setContinuousConversationActive(false);
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
    setContinuousConversationActive(false);
    conversationRecordBtn.disabled = false;
    conversationRecordBtn.textContent = 'Record again';
    conversationActiveStatus.textContent = 'Could not prepare this recording.';
    return;
  }
  await sendConversationTurn();
}

async function handleConversationRecordButton() {
  if (conversationContinuous.checked) setContinuousConversationActive(true);
  if (pendingConversationPayload) {
    await sendConversationTurn();
  } else if (conversationRecorder && conversationRecorder.state === 'recording') {
    await stopAndSendConversationRecording();
  } else {
    await beginConversationRecording();
  }
}

async function pauseContinuousConversation() {
  if (!continuousConversationActive) return;
  setContinuousConversationActive(false);
  stopConversationVoice();
  if (conversationRecorder && conversationRecorder.state === 'recording') {
    conversationRecordBtn.disabled = true;
    await discardConversationRecording();
  }
  if (!pendingConversationPayload && currentConversationSession?.status !== 'completed') {
    conversationRecordBtn.disabled = false;
    conversationRecordBtn.textContent = 'Record response';
  }
  conversationActiveStatus.textContent = 'Conversation paused. Press Record response when you are ready.';
}

async function leaveConversation() {
  if (!currentConversationSession) return;
  const confirmed = await customConfirm('Delete this conversation and all of its saved turns?');
  if (!confirmed) return;

  stopConversationVoice();
  setContinuousConversationActive(false);
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
  resetConversationEvaluation();
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
conversationPauseBtn.addEventListener('click', pauseContinuousConversation);
conversationEvaluationRetryBtn.addEventListener('click', generateConversationEvaluation);
leaveConversationBtn.addEventListener('click', leaveConversation);
conversationStopVoiceBtn.addEventListener('click', () => {
  stopConversationVoice();
  if (continuousConversationActive) scheduleContinuousConversationRecording();
});
conversationAutoVoice.addEventListener('change', () => {
  try {
    localStorage.setItem('conversationAutoVoice', conversationAutoVoice.checked ? '1' : '0');
  } catch (error) { /* storage may be unavailable in private browsing */ }
  if (!conversationAutoVoice.checked) {
    stopConversationVoice();
    if (continuousConversationActive) scheduleContinuousConversationRecording();
  }
});
conversationHandsFree.addEventListener('change', async () => {
  try {
    localStorage.setItem('conversationHandsFree', conversationHandsFree.checked ? '1' : '0');
  } catch (error) { /* storage may be unavailable in private browsing */ }

  if (!conversationRecorder || conversationRecorder.state !== 'recording') return;
  if (conversationHandsFree.checked) {
    const handsFreeActive = await startConversationSilenceDetection();
    conversationActiveStatus.textContent = handsFreeActive
      ? 'Listening… your response sends after a brief silence. You can also stop it manually.'
      : 'Automatic silence detection is unavailable. Stop the response manually.';
  } else {
    stopConversationSilenceDetection();
    conversationActiveStatus.textContent = 'Recording… stop manually when you’re finished.';
  }
});
conversationContinuous.addEventListener('change', () => {
  try {
    localStorage.setItem('conversationContinuous', conversationContinuous.checked ? '1' : '0');
  } catch (error) { /* storage may be unavailable in private browsing */ }
  if (!conversationContinuous.checked && continuousConversationActive) {
    setContinuousConversationActive(false);
    if (!conversationRecorder || conversationRecorder.state !== 'recording') {
      conversationRecordBtn.disabled = false;
      conversationRecordBtn.textContent = 'Record response';
      conversationActiveStatus.textContent = 'Continuous mode is off. Start each response manually.';
    }
  }
});

// Existing navigation owns its own panels; make it close this one as well.
[practiceNavBtn, manageDecksBtn, completedBtn, historyBtn, progressBtn].forEach(button => {
  button.addEventListener('click', () => {
    stopConversationVoice();
    setContinuousConversationActive(false);
    if (conversationRecorder && conversationRecorder.state !== 'inactive') {
      discardConversationRecording();
      conversationActiveStatus.textContent = 'Recording discarded because you left the conversation.';
    }
    conversationPanel.classList.add('hidden');
  });
});

logoutBtn.addEventListener('click', () => {
  stopConversationVoice();
  setContinuousConversationActive(false);
  if (conversationRecorder && conversationRecorder.state !== 'inactive') {
    discardConversationRecording();
  }
  pendingConversationPayload = null;
  currentConversationSession = null;
  resetConversationEvaluation();
});

if (!conversationVoiceSupported) {
  conversationAutoVoice.checked = false;
  conversationAutoVoice.disabled = true;
  conversationStopVoiceBtn.disabled = true;
} else {
  try {
    conversationAutoVoice.checked = localStorage.getItem('conversationAutoVoice') !== '0';
  } catch (error) { /* keep the default when storage is unavailable */ }
}

if (!conversationHandsFreeSupported) {
  conversationHandsFree.checked = false;
  conversationHandsFree.disabled = true;
} else {
  try {
    conversationHandsFree.checked = localStorage.getItem('conversationHandsFree') !== '0';
  } catch (error) { /* keep the default when storage is unavailable */ }
}

try {
  conversationContinuous.checked = localStorage.getItem('conversationContinuous') !== '0';
} catch (error) { /* keep the default when storage is unavailable */ }

setConversationMode(selectedConversationMode);
