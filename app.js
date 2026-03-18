import { phrases } from "./data/phrases.js";

const PHRASES_PER_STEP = 3;
const PHRASE_TARGET = 7;
const REVIEW_TARGET = 3;
const TOTAL_STEPS = 50;
const AUTO_ADVANCE_DELAY = 1200;

const CARD_TOTALS = {
  normal: 30,
  special: 15,
  super: 5
};

const STORAGE_KEYS = {
  unlockedSteps: "kids-english-steps-unlocked",
  completedSteps: "kids-english-steps-completed",
  phraseProgress: "kids-english-steps-phrase-progress",
  lastUnlockDate: "kids-english-steps-last-unlock-date",
  cards: "kids-english-cards",
  testMode: "kids-english-test-mode",
  cardOrder: "kids-english-card-order"
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const stepsScreenEl = document.getElementById("steps-screen");
const cardBoxScreenEl = document.getElementById("card-box-screen");
const reviewScreenEl = document.getElementById("review-screen");
const learningScreenEl = document.getElementById("learning-screen");
const stepsGridEl = document.getElementById("steps-grid");
const stepsMessageEl = document.getElementById("steps-message");
const testModeBannerEl = document.getElementById("test-mode-banner");
const cardSectionsEl = document.getElementById("card-sections");

const reviewStepLabelEl = document.getElementById("review-step-label");
const reviewStatusEl = document.getElementById("review-status");
const reviewEnglishEl = document.getElementById("review-english");
const reviewKoreanEl = document.getElementById("review-korean");
const reviewSlotsEl = document.getElementById("review-slots");
const reviewFeedbackEl = document.getElementById("review-feedback");

const stepLabelEl = document.getElementById("step-label");
const phraseStatusEl = document.getElementById("phrase-status");
const englishEl = document.getElementById("english");
const koreanEl = document.getElementById("korean");
const successSlotsEl = document.getElementById("success-slots");
const feedbackTextEl = document.getElementById("feedback-text");

const cardBoxBtn = document.getElementById("card-box-btn");
const cardBoxBackBtn = document.getElementById("card-box-back-btn");
const reviewBackBtn = document.getElementById("review-back-btn");
const backBtn = document.getElementById("back-btn");
const testModeBtn = document.getElementById("test-mode-btn");
const resetBtn = document.getElementById("reset-btn");
const reviewListenBtn = document.getElementById("review-listen-btn");
const reviewRecordBtn = document.getElementById("review-record-btn");
const reviewStartBtn = document.getElementById("review-start-btn");
const speakBtn = document.getElementById("speak-btn");
const recordBtn = document.getElementById("record-btn");
const meaningBtn = document.getElementById("meaning-btn");
const nextBtn = document.getElementById("next-btn");

const cardDetailModalEl = document.getElementById("card-detail-modal");
const cardDetailPreviewEl = document.getElementById("card-detail-preview");
const cardDetailTitleEl = document.getElementById("card-detail-title");
const cardDetailTypeEl = document.getElementById("card-detail-type");
const cardDetailCloseBtn = document.getElementById("card-detail-close-btn");
const rewardModalEl = document.getElementById("reward-modal");
const rewardCardEl = document.getElementById("reward-card");
const cardRevealStageEl = document.getElementById("card-reveal-stage");
const rewardGlowEl = document.getElementById("reward-glow");
const rewardPreviewEl = document.getElementById("reward-preview");
const rewardCardIdEl = document.getElementById("reward-card-id");
const rewardCardTypeEl = document.getElementById("reward-card-type");
const rewardBurstEl = document.getElementById("reward-burst");
const rewardSparklesEl = document.getElementById("reward-sparkles");
const rewardCloseBtn = document.getElementById("reward-close-btn");

let currentStep = null;
let currentPhraseIndex = 0;
let meaningVisible = false;
let advanceTimerId = null;
let recognition = null;
let isListening = false;
let hasListened = false;

let currentMode = "learning";
let pendingStep = null;
let reviewQueue = [];
let currentReviewIndex = 0;
let reviewProgress = [];
let audioContext = null;
let hasInitialized = false;
let rewardEffectTimerId = null;
let revealStageTimerIds = [];

const state = loadState();

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    isListening = true;
    updateRecordButtons();

    if (currentMode === "review") {
      setReviewFeedback("Listening... Say the sentence!", "");
    } else {
      setFeedback("Listening... Say the sentence!", "");
    }
  });

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    handleSpeechResult(transcript);
  });

  recognition.addEventListener("error", () => {
    isListening = false;
    updateRecordButtons();

    if (currentMode === "review") {
      setReviewFeedback("Let's try again. Tap the mic and speak clearly.", "error");
    } else {
      setFeedback("Let's try again. Tap the mic and speak clearly.", "error");
    }
  });

  recognition.addEventListener("end", () => {
    isListening = false;
    updateRecordButtons();
  });
}

function createInitialState() {
  return {
    unlockedSteps: [1],
    completedSteps: [],
    phraseProgress: {},
    lastUnlockDate: "",
    collectedCards: [],
    testMode: false,
    cardOrder: {}
  };
}

function readStoredArray(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readStoredObject(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function loadState() {
  const nextState = createInitialState();

  nextState.unlockedSteps = readStoredArray(STORAGE_KEYS.unlockedSteps)
    .filter((step) => Number.isInteger(step) && step >= 1 && step <= TOTAL_STEPS);
  nextState.completedSteps = readStoredArray(STORAGE_KEYS.completedSteps)
    .filter((step) => Number.isInteger(step) && step >= 1 && step <= TOTAL_STEPS);
  nextState.phraseProgress = readStoredObject(STORAGE_KEYS.phraseProgress);
  nextState.lastUnlockDate = window.localStorage.getItem(STORAGE_KEYS.lastUnlockDate) || "";
  nextState.testMode = window.localStorage.getItem(STORAGE_KEYS.testMode) === "true";
  nextState.cardOrder = getStoredCardOrder();
  const storedCards = readStoredObject(STORAGE_KEYS.cards);
  nextState.collectedCards = Array.isArray(storedCards.collectedCards)
    ? storedCards.collectedCards
        .filter((card) => card && typeof card === "object")
        .map((card) => ({
          id: String(card.id || ""),
          type: String(card.type || "normal")
        }))
        .filter((card) => card.id)
    : [];

  if (!nextState.unlockedSteps.includes(1)) {
    nextState.unlockedSteps.unshift(1);
  }

  return nextState;
}

function saveState() {
  window.localStorage.setItem(
    STORAGE_KEYS.unlockedSteps,
    JSON.stringify([...new Set(state.unlockedSteps)].sort((a, b) => a - b))
  );
  window.localStorage.setItem(
    STORAGE_KEYS.completedSteps,
    JSON.stringify([...new Set(state.completedSteps)].sort((a, b) => a - b))
  );
  window.localStorage.setItem(
    STORAGE_KEYS.phraseProgress,
    JSON.stringify(state.phraseProgress)
  );
  window.localStorage.setItem(STORAGE_KEYS.lastUnlockDate, state.lastUnlockDate);
  window.localStorage.setItem(STORAGE_KEYS.testMode, String(state.testMode));
  window.localStorage.setItem(STORAGE_KEYS.cardOrder, JSON.stringify(state.cardOrder));
  window.localStorage.setItem(
    STORAGE_KEYS.cards,
    JSON.stringify({ collectedCards: state.collectedCards })
  );
}

function getKstDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function parseDateString(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ""));
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day)
  };
}

function getDaysBetweenDateStrings(fromDateString, toDateString) {
  const fromParts = parseDateString(fromDateString);
  const toParts = parseDateString(toDateString);

  if (!fromParts || !toParts) {
    return 0;
  }

  const fromTime = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toTime = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
  return Math.floor((toTime - fromTime) / 86400000);
}

function normalizeUnlockedSteps() {
  state.unlockedSteps = [...new Set(
    state.unlockedSteps
      .filter((step) => Number.isInteger(step) && step >= 1 && step <= TOTAL_STEPS)
  )].sort((a, b) => a - b);

  if (!state.unlockedSteps.includes(1)) {
    state.unlockedSteps.unshift(1);
  }
}

function getHighestUnlockedStep() {
  normalizeUnlockedSteps();
  return state.unlockedSteps[state.unlockedSteps.length - 1] || 1;
}

function unlockNextAvailableStep() {
  normalizeUnlockedSteps();

  for (let step = 1; step <= TOTAL_STEPS; step += 1) {
    if (!state.unlockedSteps.includes(step)) {
      state.unlockedSteps.push(step);
      state.unlockedSteps.sort((a, b) => a - b);
      return step;
    }
  }

  return null;
}

function applyMissedDailyUnlocks() {
  normalizeUnlockedSteps();

  const todayKst = getKstDateString();
  const savedDate = parseDateString(state.lastUnlockDate) ? state.lastUnlockDate : "";

  if (!savedDate) {
    state.lastUnlockDate = todayKst;
    return;
  }

  const missedDays = getDaysBetweenDateStrings(savedDate, todayKst);

  if (missedDays <= 0) {
    if (savedDate !== todayKst) {
      state.lastUnlockDate = todayKst;
    }
    return;
  }

  for (let day = 0; day < missedDays; day += 1) {
    if (!unlockNextAvailableStep()) {
      break;
    }
  }

  state.lastUnlockDate = todayKst;
}

function shuffleArray(items) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }

  return nextItems;
}

function getStoredCardOrder() {
  const storedOrder = readStoredObject(STORAGE_KEYS.cardOrder);
  const nextOrder = {};

  Object.entries(CARD_TOTALS).forEach(([type, total]) => {
    const defaultIds = Array.from({ length: total }, (_, index) => formatCardId(type, index + 1));
    const savedIds = Array.isArray(storedOrder[type]) ? storedOrder[type] : [];
    const validSavedIds = savedIds.filter((id) => defaultIds.includes(id));
    const missingIds = defaultIds.filter((id) => !validSavedIds.includes(id));

    nextOrder[type] = validSavedIds.length === defaultIds.length
      ? validSavedIds
      : shuffleArray([...validSavedIds, ...missingIds]);
  });

  return nextOrder;
}

function getStepPhrases(stepNumber) {
  const startIndex = (stepNumber - 1) * PHRASES_PER_STEP;
  return phrases.slice(startIndex, startIndex + PHRASES_PER_STEP);
}

function getPhraseProgress(phraseId) {
  const savedValue = Number(state.phraseProgress[phraseId] || 0);
  return Math.max(0, Math.min(PHRASE_TARGET, savedValue));
}

function setPhraseProgress(phraseId, value) {
  state.phraseProgress[phraseId] = Math.max(0, Math.min(PHRASE_TARGET, value));
}

function resetListenGate() {
  hasListened = false;
  updateRecordButtons();
}

function unlockMicAfterListen() {
  hasListened = true;
  updateRecordButtons();
}

function isStepUnlocked(stepNumber) {
  return state.testMode || state.unlockedSteps.includes(stepNumber);
}

function isStepCompleted(stepNumber) {
  return state.completedSteps.includes(stepNumber);
}

function getCurrentPhrase() {
  if (!currentStep) {
    return null;
  }

  return getStepPhrases(currentStep)[currentPhraseIndex] || null;
}

function getCurrentReviewItem() {
  return reviewQueue[currentReviewIndex] || null;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWord(word) {
  return word
    .replace(/^'+|'+$/g, "")
    .replace(/'(s|re|ve|ll|d|m|t)$/g, "");
}

function getKeywords(text) {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "am", "to", "my", "your", "me", "i",
    "it", "this", "that", "we", "you", "now", "do", "be"
  ]);

  return normalizeText(text)
    .split(" ")
    .map(normalizeWord)
    .filter((word) => word && !stopWords.has(word));
}

function levenshteinDistance(source, target) {
  const rows = source.length + 1;
  const cols = target.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = source[row - 1] === target[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[source.length][target.length];
}

function getSimilarityScore(sourceText, targetText) {
  const source = normalizeText(sourceText);
  const target = normalizeText(targetText);

  if (!source || !target) {
    return 0;
  }

  const distance = levenshteinDistance(source, target);
  const maxLength = Math.max(source.length, target.length);
  const characterScore = maxLength === 0 ? 1 : 1 - distance / maxLength;

  const sourceWords = source.split(" ");
  const targetWords = target.split(" ");
  const targetWordSet = new Set(targetWords);
  const matchedWords = sourceWords.filter((word) => targetWordSet.has(word)).length;
  const wordScore = matchedWords / targetWords.length;

  return characterScore * 0.6 + wordScore * 0.4;
}

function getKeywordScore(spokenText, targetText) {
  const spokenKeywords = getKeywords(spokenText);
  const targetKeywords = getKeywords(targetText);

  if (targetKeywords.length === 0) {
    return 0;
  }

  const spokenSet = new Set(spokenKeywords);
  const directMatches = targetKeywords.filter((word) => spokenSet.has(word)).length;
  let softMatches = 0;

  targetKeywords.forEach((targetWord) => {
    if (spokenSet.has(targetWord)) {
      return;
    }

    const hasCloseWord = spokenKeywords.some((spokenWord) => {
      if (!spokenWord) {
        return false;
      }

      if (spokenWord.startsWith(targetWord) || targetWord.startsWith(spokenWord)) {
        return true;
      }

      return getSimilarityScore(spokenWord, targetWord) >= 0.74;
    });

    if (hasCloseWord) {
      softMatches += 1;
    }
  });

  return (directMatches + softMatches * 0.8) / targetKeywords.length;
}

function isSpeechMatch(spokenText, targetText) {
  const overallScore = getSimilarityScore(spokenText, targetText);
  const keywordScore = getKeywordScore(spokenText, targetText);
  const targetKeywords = getKeywords(targetText);
  const matchedKeywords = keywordScore * targetKeywords.length;

  if (overallScore >= 0.68) {
    return true;
  }

  if (targetKeywords.length <= 2 && keywordScore >= 0.5) {
    return true;
  }

  if (targetKeywords.length >= 3 && matchedKeywords >= 2 && keywordScore >= 0.58) {
    return true;
  }

  return overallScore >= 0.56 && keywordScore >= 0.72;
}

function formatCardId(type, index) {
  return `${type}_${String(index).padStart(2, "0")}`;
}

function getRewardCard(type, stepNumber) {
  const total = CARD_TOTALS[type];
  const cardIndex = ((stepNumber % total) + 1);
  return {
    id: formatCardId(type, cardIndex),
    type
  };
}

function addCard(card) {
  if (state.collectedCards.some((item) => item.id === card.id && item.type === card.type)) {
    return null;
  }

  state.collectedCards.push(card);
  return card;
}

function giveStepRewards(stepNumber) {
  if (stepNumber % 10 === 0) {
    return addCard(getRewardCard("super", stepNumber));
  }

  if (stepNumber % 3 === 0) {
    return addCard(getRewardCard("special", stepNumber));
  }

  return addCard(getRewardCard("normal", stepNumber));
}

function awardCardForCompletedStep(stepNumber) {
  if (state.completedSteps.includes(stepNumber)) {
    return null;
  }

  state.completedSteps.push(stepNumber);
  return giveStepRewards(stepNumber);
}

function getAllCardSlots() {
  const slots = [];

  Object.entries(CARD_TOTALS).forEach(([type, total]) => {
    for (let index = 1; index <= total; index += 1) {
      const id = formatCardId(type, index);
      slots.push({
        id,
        type,
        collected: state.collectedCards.some((card) => card.id === id)
      });
    }
  });

  return slots;
}

function getOrderedCardSlotsByType(type) {
  const cardsById = new Map(
    getAllCardSlots()
      .filter((card) => card.type === type)
      .map((card) => [card.id, card])
  );

  const orderedIds = Array.isArray(state.cardOrder[type]) ? state.cardOrder[type] : [];
  return orderedIds
    .map((id) => cardsById.get(id))
    .filter(Boolean);
}

function getCardClass(type) {
  return `card-tile ${type}`;
}

function getCardImagePath(card) {
  const extension = card.type === "super" ? "gif" : "png";
  return `./cards/${card.type}/${card.id}.${extension}`;
}

function getCardSectionTitle(type) {
  if (type === "special") {
    return "Special Cards";
  }

  if (type === "super") {
    return "Super Cards";
  }

  return "Normal Cards";
}

function openCardDetail(card) {
  cardDetailModalEl.classList.remove("opening");
  void cardDetailModalEl.offsetWidth;
  cardDetailModalEl.classList.add("opening");
  cardDetailPreviewEl.className = `card-detail-preview ${card.collected ? card.type : "locked"}`;
  cardDetailPreviewEl.innerHTML = card.collected
    ? `<img class="card-image-media" src="${getCardImagePath(card)}" alt="${card.id}" />`
    : "?";
  cardDetailTitleEl.textContent = "";
  cardDetailTypeEl.textContent = "";
  cardDetailModalEl.classList.remove("hidden");
  cardDetailModalEl.hidden = false;

  if (card.collected && card.type === "super") {
    playRewardSound("super");
  }
}

function closeCardDetail() {
  cardDetailModalEl.classList.add("hidden");
  cardDetailModalEl.hidden = true;
  cardDetailModalEl.classList.remove("opening");
  cardDetailPreviewEl.innerHTML = "";
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

function playTone(startTime, frequency, duration, volume, type) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playSweep(startTime, fromFrequency, toFrequency, duration, volume, type) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(fromFrequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(toFrequency, startTime + duration);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playRewardSound(cardType) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  const start = context.currentTime + 0.01;

  if (cardType === "super") {
    playTone(start, 196, 0.2, 0.12, "triangle");
    playTone(start + 0.1, 293.66, 0.22, 0.13, "triangle");
    playTone(start + 0.2, 392, 0.26, 0.14, "sawtooth");
    playSweep(start + 0.16, 240, 620, 0.5, 0.12, "triangle");
    playTone(start + 0.42, 783.99, 0.48, 0.16, "sine");
    return;
  }

  if (cardType === "special") {
    playTone(start, 659.25, 0.16, 0.08, "sine");
    playTone(start + 0.08, 783.99, 0.2, 0.1, "triangle");
    playTone(start + 0.18, 987.77, 0.26, 0.08, "sine");
    return;
  }

  playTone(start, 880, 0.08, 0.05, "sine");
  playTone(start + 0.05, 1174.66, 0.1, 0.04, "triangle");
}

function clearRewardEffects() {
  if (rewardEffectTimerId) {
    window.clearTimeout(rewardEffectTimerId);
    rewardEffectTimerId = null;
  }

  revealStageTimerIds.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  revealStageTimerIds = [];

  document.body.classList.remove("reward-shake");
  rewardModalEl.classList.remove(
    "reward-normal",
    "reward-special",
    "reward-super",
    "glow-start",
    "shake-start",
    "burst-start",
    "reveal-start",
    "screen-glow",
    "screen-flash"
  );
  rewardCardEl.classList.remove("reward-card-reveal");
  rewardCardEl.classList.remove("reveal-normal", "reveal-special", "reveal-super");
  cardRevealStageEl.classList.remove("reward-card-reveal");
  rewardGlowEl.classList.remove("active");
  rewardBurstEl.classList.add("hidden");
  rewardBurstEl.classList.remove("active");
  rewardSparklesEl.classList.add("hidden");
  rewardSparklesEl.classList.remove("super");
}

function getRevealTimings(cardType) {
  if (cardType === "super") {
    return {
      glowDelay: 0,
      shakeDelay: 110,
      burstDelay: 180,
      revealDelay: 30,
      cleanupDelay: 620
    };
  }

  if (cardType === "special") {
    return {
      glowDelay: 0,
      shakeDelay: null,
      burstDelay: 160,
      revealDelay: 24,
      cleanupDelay: 560
    };
  }

  return {
    glowDelay: 0,
    shakeDelay: null,
    burstDelay: 140,
    revealDelay: 20,
    cleanupDelay: 480
  };
}

function startRevealAnimation(cardType) {
  clearRewardEffects();

  const timings = getRevealTimings(cardType);
  rewardModalEl.classList.add(`reward-${cardType}`);
  rewardBurstEl.classList.remove("hidden");

  const queueStage = (className, delay, callback) => {
    const timerId = window.setTimeout(() => {
      rewardModalEl.classList.add(className);
      if (callback) {
        callback();
      }
    }, delay);
    revealStageTimerIds.push(timerId);
  };

  queueStage("glow-start", timings.glowDelay, () => {
    rewardGlowEl.classList.add("active");
    if (cardType !== "normal") {
      rewardSparklesEl.classList.remove("hidden");
      rewardSparklesEl.classList.toggle("super", cardType === "super");
    }
    if (cardType === "special") {
      rewardModalEl.classList.add("screen-glow");
    }
    if (cardType === "super") {
      rewardModalEl.classList.add("screen-flash");
    }
  });

  if (typeof timings.shakeDelay === "number") {
    queueStage("shake-start", timings.shakeDelay, () => {
      if (cardType === "super") {
        document.body.classList.add("reward-shake");
      }
    });
  }

  queueStage("burst-start", timings.burstDelay, () => {
    rewardBurstEl.classList.add("active");
  });

  queueStage("reveal-start", timings.revealDelay, () => {
    rewardCardEl.classList.add("reward-card-reveal");
    rewardCardEl.classList.add(`reveal-${cardType}`);
    cardRevealStageEl.classList.add("reward-card-reveal");
  });

  const cleanupTimerId = window.setTimeout(() => {
    document.body.classList.remove("reward-shake");
    rewardModalEl.classList.remove("screen-glow", "screen-flash");
  }, timings.cleanupDelay);
  revealStageTimerIds.push(cleanupTimerId);
}

function openRewardModal(card) {
  if (!hasInitialized || !card) {
    return;
  }

  rewardCardEl.className = `modal-card reward-card ${card.type}`;
  rewardPreviewEl.className = `card-detail-preview ${card.type}`;
  rewardPreviewEl.innerHTML = `<img class="card-image-media" src="${getCardImagePath(card)}" alt="${card.id}" />`;
  rewardCardIdEl.textContent = card.id;
  rewardCardTypeEl.textContent = `Type: ${card.type}`;
  rewardModalEl.classList.remove("hidden");
  rewardModalEl.hidden = false;
  startRevealAnimation(card.type);
  playRewardSound(card.type);
}

function closeRewardModal() {
  clearRewardEffects();
  rewardModalEl.classList.add("hidden");
  rewardModalEl.hidden = true;
  rewardCardEl.className = "modal-card reward-card";
  rewardPreviewEl.className = "card-detail-preview";
  rewardPreviewEl.innerHTML = "";
  rewardSparklesEl.classList.add("hidden");
}

function renderCardBox() {
  cardSectionsEl.innerHTML = "";

  ["normal", "special", "super"].forEach((type) => {
    const section = document.createElement("section");
    const title = document.createElement("h3");
    const grid = document.createElement("div");

    section.className = `card-section ${type}`;
    title.className = "card-section-title";
    title.textContent = getCardSectionTitle(type);
    grid.className = `card-grid ${type}-grid`;

    getOrderedCardSlotsByType(type)
      .forEach((card) => {
        const button = document.createElement("button");
        const isVisible = state.testMode || card.collected;
        button.type = "button";
        button.className = `${getCardClass(card.type)}${isVisible ? "" : " locked"}`;
        button.innerHTML = `
          <span class="card-tile-image">${
            isVisible
              ? `<img class="card-image-media" src="${getCardImagePath(card)}" alt="${card.id}" />`
              : "?"
          }</span>
        `;
        button.addEventListener("click", () => {
          openCardDetail({ ...card, collected: isVisible });
        });
        grid.appendChild(button);
      });

    section.appendChild(title);
    section.appendChild(grid);
    cardSectionsEl.appendChild(section);
  });
}

function updateMeaningVisibility() {
  const phrase = getCurrentPhrase();
  const meaningUnlocked = phrase ? getPhraseProgress(phrase.id) >= PHRASE_TARGET : false;

  meaningBtn.disabled = !meaningUnlocked;
  koreanEl.classList.toggle("hidden", !meaningVisible || !meaningUnlocked);
  meaningBtn.textContent = meaningUnlocked
    ? (meaningVisible ? "Hide Meaning" : "Show Meaning")
    : "Meaning Locked";
}

function updateNextButton() {
  const phrase = getCurrentPhrase();
  const canMoveNext = phrase ? getPhraseProgress(phrase.id) >= PHRASE_TARGET : false;

  nextBtn.disabled = !canMoveNext;
}

function renderSuccessSlots() {
  const phrase = getCurrentPhrase();
  const progress = phrase ? getPhraseProgress(phrase.id) : 0;

  successSlotsEl.innerHTML = "";

  for (let index = 0; index < PHRASE_TARGET; index += 1) {
    const slot = document.createElement("span");
    const isComplete = index < progress;
    slot.className = `success-slot${isComplete ? " filled" : ""}`;
    slot.textContent = isComplete ? "V" : String(index + 1);
    successSlotsEl.appendChild(slot);
  }
}

function renderReviewSlots() {
  const progress = reviewProgress[currentReviewIndex] || 0;
  reviewSlotsEl.innerHTML = "";

  for (let index = 0; index < REVIEW_TARGET; index += 1) {
    const slot = document.createElement("span");
    const isComplete = index < progress;
    slot.className = `success-slot${isComplete ? " filled" : ""}`;
    slot.textContent = isComplete ? "V" : String(index + 1);
    reviewSlotsEl.appendChild(slot);
  }
}

function setFeedback(message, tone) {
  feedbackTextEl.textContent = message;
  feedbackTextEl.className = `feedback-text${tone ? ` ${tone}` : ""}`;
}

function setReviewFeedback(message, tone) {
  reviewFeedbackEl.textContent = message;
  reviewFeedbackEl.className = `feedback-text${tone ? ` ${tone}` : ""}`;
}

function setStepsMessage(message) {
  stepsMessageEl.textContent = message;
  stepsMessageEl.classList.toggle("hidden", !message);
}

function updateTestModeUI() {
  testModeBannerEl.classList.toggle("hidden", !state.testMode);
  testModeBtn.classList.toggle("active", state.testMode);
  testModeBtn.textContent = state.testMode ? "Test On" : "Test";
}

function updateRecordButtons() {
  if (!SpeechRecognition) {
    recordBtn.disabled = true;
    recordBtn.textContent = "Mic Unavailable";
    reviewRecordBtn.disabled = true;
    reviewRecordBtn.textContent = "Mic Unavailable";
    return;
  }

  const micLocked = !hasListened;

  recordBtn.disabled = micLocked || isListening;
  reviewRecordBtn.disabled = micLocked || isListening;
  recordBtn.classList.toggle("locked", micLocked);
  reviewRecordBtn.classList.toggle("locked", micLocked);
  recordBtn.textContent = isListening ? "Listening..." : micLocked ? "Listen First" : "Start Mic";
  reviewRecordBtn.textContent = isListening
    ? "Listening..."
    : micLocked
      ? "Listen First"
      : "Start Mic";
}

function stopRecognition() {
  if (recognition && isListening) {
    recognition.stop();
  }
}

function clearAdvanceTimer() {
  if (advanceTimerId) {
    window.clearTimeout(advanceTimerId);
    advanceTimerId = null;
  }
}

function showStepsScreen() {
  clearAdvanceTimer();
  stopRecognition();
  closeRewardModal();
  currentMode = "steps";
  currentStep = null;
  currentPhraseIndex = 0;
  meaningVisible = false;
  pendingStep = null;
  reviewQueue = [];
  currentReviewIndex = 0;
  reviewProgress = [];
  resetListenGate();
  stepsScreenEl.classList.remove("hidden");
  cardBoxScreenEl.classList.add("hidden");
  reviewScreenEl.classList.add("hidden");
  learningScreenEl.classList.add("hidden");
}

function showCardBoxScreen() {
  clearAdvanceTimer();
  stopRecognition();
  currentMode = "cards";
  resetListenGate();
  stepsScreenEl.classList.add("hidden");
  cardBoxScreenEl.classList.remove("hidden");
  reviewScreenEl.classList.add("hidden");
  learningScreenEl.classList.add("hidden");
  renderCardBox();
}

function showReviewScreen() {
  setStepsMessage("");
  currentMode = "review";
  stepsScreenEl.classList.add("hidden");
  cardBoxScreenEl.classList.add("hidden");
  reviewScreenEl.classList.remove("hidden");
  learningScreenEl.classList.add("hidden");
}

function showLearningScreen() {
  setStepsMessage("");
  currentMode = "learning";
  stepsScreenEl.classList.add("hidden");
  cardBoxScreenEl.classList.add("hidden");
  reviewScreenEl.classList.add("hidden");
  learningScreenEl.classList.remove("hidden");
}

function findFirstIncompletePhraseIndex(stepPhrases) {
  const incompleteIndex = stepPhrases.findIndex(
    (phrase) => getPhraseProgress(phrase.id) < PHRASE_TARGET
  );

  return incompleteIndex === -1 ? 0 : incompleteIndex;
}

function getReviewTargets(stepNumber) {
  return [stepNumber - 1, stepNumber - 5, stepNumber - 10]
    .filter((targetStep) => targetStep >= 1)
    .map((targetStep) => {
      const phrasesForStep = getStepPhrases(targetStep);
      return phrasesForStep.length > 0 ? { stepNumber: targetStep, phrase: phrasesForStep[0] } : null;
    })
    .filter(Boolean);
}

function getStepRewardType(stepNumber) {
  if (stepNumber % 10 === 0) {
    return "super";
  }

  if (stepNumber % 3 === 0) {
    return "special";
  }

  return "normal";
}

function startSelectedStep(step) {
  clearAdvanceTimer();
  currentStep = step;
  currentPhraseIndex = findFirstIncompletePhraseIndex(getStepPhrases(step));
  renderLearningCard();
  showLearningScreen();
}

function beginStep(step) {
  if (isStepCompleted(step) || step === 1) {
    startSelectedStep(step);
    return;
  }

  pendingStep = step;
  reviewQueue = getReviewTargets(step);
  reviewProgress = reviewQueue.map(() => 0);
  currentReviewIndex = 0;

  if (reviewQueue.length === 0) {
    startSelectedStep(step);
    return;
  }

  renderReviewCard();
  showReviewScreen();
}

function renderSteps() {
  stepsGridEl.innerHTML = "";
  updateTestModeUI();

  for (let step = 1; step <= TOTAL_STEPS; step += 1) {
    const button = document.createElement("button");
    const hasEnoughPhrases = getStepPhrases(step).length === PHRASES_PER_STEP;
    const unlocked = isStepUnlocked(step) && hasEnoughPhrases;
    const completed = isStepCompleted(step);
    const rewardType = getStepRewardType(step);

    button.type = "button";
    button.className = `step-btn reward-${rewardType}${completed ? " completed" : ""}`;
    button.disabled = !unlocked;
    button.innerHTML = `
      <span class="step-btn-label">Step ${step}</span>
      ${completed ? '<span class="step-badge" aria-hidden="true"></span>' : ""}
    `;

    if (!hasEnoughPhrases) {
      button.classList.add("missing");
    }

    if (unlocked) {
      button.addEventListener("click", () => {
        beginStep(step);
      });
    }

    stepsGridEl.appendChild(button);
  }
}

function renderReviewCard() {
  const item = getCurrentReviewItem();

  if (!item) {
    reviewStepLabelEl.textContent = "Review Clear";
    reviewStatusEl.textContent = "Ready";
    reviewEnglishEl.textContent = "All review items are done.";
    reviewKoreanEl.textContent = "";
    renderReviewSlots();
    setReviewFeedback("Nice! You can start the new step.", "success");
    reviewRecordBtn.classList.add("hidden");
    reviewListenBtn.classList.add("hidden");
    reviewStartBtn.classList.remove("hidden");
    return;
  }

  resetListenGate();
  reviewStepLabelEl.textContent = `Review Step ${item.stepNumber}`;
  reviewStatusEl.textContent = `Item ${currentReviewIndex + 1} / ${reviewQueue.length}`;
  reviewEnglishEl.textContent = item.phrase.en;
  reviewKoreanEl.textContent = item.phrase.ko;
  renderReviewSlots();
  setReviewFeedback(`Listen first, then say the sentence ${REVIEW_TARGET} times.`, "");
  reviewRecordBtn.classList.remove("hidden");
  reviewListenBtn.classList.remove("hidden");
  reviewStartBtn.classList.add("hidden");
  updateRecordButtons();
}

function renderLearningCard() {
  const stepPhrases = getStepPhrases(currentStep);
  const phrase = stepPhrases[currentPhraseIndex];

  if (!phrase) {
    stepLabelEl.textContent = `Step ${currentStep}`;
    phraseStatusEl.textContent = "Phrase data missing";
    englishEl.textContent = "This step does not have 3 phrases yet.";
    koreanEl.textContent = "";
    meaningVisible = false;
    renderSuccessSlots();
    setFeedback("This step needs more phrase data.", "error");
    speakBtn.disabled = true;
    recordBtn.disabled = true;
    nextBtn.disabled = true;
    updateMeaningVisibility();
    return;
  }

  resetListenGate();
  stepLabelEl.textContent = `Step ${currentStep}`;
  phraseStatusEl.textContent = `Phrase ${currentPhraseIndex + 1} / ${stepPhrases.length}`;
  englishEl.textContent = phrase.en;
  koreanEl.textContent = phrase.ko;
  meaningVisible = false;
  speakBtn.disabled = false;
  renderSuccessSlots();
  updateMeaningVisibility();
  updateNextButton();
  updateRecordButtons();

  if (!SpeechRecognition) {
    setFeedback("This browser does not support microphone speech practice.", "error");
  } else {
    setFeedback("Listen first to unlock the mic.", "");
  }
}

function speakPhrase(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function speakCurrentPhrase() {
  const phrase = getCurrentPhrase();
  if (phrase) {
    unlockMicAfterListen();
    setFeedback("Great! Now tap the mic and say the sentence.", "");
    speakPhrase(phrase.en);
  }
}

function speakCurrentReviewPhrase() {
  const item = getCurrentReviewItem();
  if (item) {
    unlockMicAfterListen();
    setReviewFeedback(`Great! Now tap the mic and say it ${REVIEW_TARGET} times.`, "");
    speakPhrase(item.phrase.en);
  }
}

function toggleMeaning() {
  if (!meaningBtn.disabled) {
    meaningVisible = !meaningVisible;
    updateMeaningVisibility();
  }
}

function completeStep(stepNumber) {
  return awardCardForCompletedStep(stepNumber);
}

function moveToNextPhraseOrFinishStep() {
  const stepPhrases = getStepPhrases(currentStep);
  const nextPhraseIndex = stepPhrases.findIndex(
    (item) => getPhraseProgress(item.id) < PHRASE_TARGET
  );

  if (nextPhraseIndex === -1) {
    const nextStep = currentStep + 1;
    const awardedCard = completeStep(currentStep);
    saveState();
    renderSteps();
    renderCardBox();

    if (nextStep <= TOTAL_STEPS && !isStepUnlocked(nextStep)) {
      setStepsMessage("Step clear! Come back tomorrow for a new step.");
    } else {
      setStepsMessage("");
    }

    showStepsScreen();

    if (awardedCard) {
      openRewardModal(awardedCard);
    }
    return;
  }

  currentPhraseIndex = nextPhraseIndex;
  renderLearningCard();
}

function moveForward() {
  const phrase = getCurrentPhrase();

  if (!phrase || getPhraseProgress(phrase.id) < PHRASE_TARGET) {
    return;
  }

  moveToNextPhraseOrFinishStep();
}

function advanceReview() {
  currentReviewIndex += 1;
  renderReviewCard();
}

function handleSpeechSuccess() {
  if (currentMode === "review") {
    reviewProgress[currentReviewIndex] = Math.min(
      REVIEW_TARGET,
      (reviewProgress[currentReviewIndex] || 0) + 1
    );
    renderReviewSlots();

    if (reviewProgress[currentReviewIndex] >= REVIEW_TARGET) {
      setReviewFeedback("Nice review! Let's go on.", "success");
      clearAdvanceTimer();
      advanceTimerId = window.setTimeout(() => {
        advanceReview();
      }, AUTO_ADVANCE_DELAY);
    } else {
      setReviewFeedback("Good job! Say it again.", "success");
    }
    return;
  }

  const phrase = getCurrentPhrase();
  if (!phrase) {
    return;
  }

  const nextProgress = getPhraseProgress(phrase.id) + 1;
  setPhraseProgress(phrase.id, nextProgress);
  saveState();
  renderSuccessSlots();

  if (getPhraseProgress(phrase.id) >= PHRASE_TARGET) {
    meaningVisible = false;
    updateMeaningVisibility();
    updateNextButton();
    setFeedback("Great job! Phrase cleared! Press Next.", "success");
    return;
  }

  setFeedback("Nice! That was a match.", "success");
}

function handleSpeechResult(transcript) {
  const targetText =
    currentMode === "review" ? getCurrentReviewItem()?.phrase.en : getCurrentPhrase()?.en;

  if (!targetText) {
    return;
  }

  if (isSpeechMatch(transcript, targetText)) {
    handleSpeechSuccess();
  } else if (currentMode === "review") {
    setReviewFeedback(`Good try! We heard: "${transcript}"`, "error");
  } else {
    setFeedback(`Good try! We heard: "${transcript}"`, "error");
  }
}

function startRecognition() {
  if (!recognition || isListening) {
    return;
  }

  clearAdvanceTimer();

  if (!hasListened) {
    if (currentMode === "review") {
      setReviewFeedback("Listen first to unlock the mic.", "error");
    } else {
      setFeedback("Listen first to unlock the mic.", "error");
    }
    updateRecordButtons();
    return;
  }

  if (currentMode === "learning") {
    meaningVisible = false;
    updateMeaningVisibility();
  }

  try {
    recognition.start();
  } catch {
    if (currentMode === "review") {
      setReviewFeedback("Tap the mic again in a moment.", "error");
    } else {
      setFeedback("Tap the mic again in a moment.", "error");
    }
  }
}

function resetProgress() {
  const password = window.prompt("Enter reset password:");

  if (password === null) {
    return;
  }

  if (password !== "0523") {
    window.alert("Wrong password.");
    return;
  }

  state.cardOrder = {};
  Object.values(STORAGE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
  window.location.reload();
}

function enableTestMode() {
  const password = window.prompt("Enter test mode password:");

  if (password === null) {
    return;
  }

  if (password !== "0628") {
    window.alert("Wrong password.");
    return;
  }

  state.testMode = true;
  saveState();
  renderSteps();
  renderCardBox();
  setStepsMessage("Test mode is active.");
}

cardBoxBtn.addEventListener("click", () => {
  showCardBoxScreen();
});
cardBoxBackBtn.addEventListener("click", () => {
  showStepsScreen();
});
reviewBackBtn.addEventListener("click", () => {
  renderSteps();
  showStepsScreen();
});
backBtn.addEventListener("click", () => {
  renderSteps();
  showStepsScreen();
});
testModeBtn.addEventListener("click", enableTestMode);
resetBtn.addEventListener("click", resetProgress);
reviewListenBtn.addEventListener("click", speakCurrentReviewPhrase);
reviewRecordBtn.addEventListener("click", startRecognition);
reviewStartBtn.addEventListener("click", () => {
  if (pendingStep) {
    startSelectedStep(pendingStep);
  }
});
speakBtn.addEventListener("click", speakCurrentPhrase);
recordBtn.addEventListener("click", startRecognition);
meaningBtn.addEventListener("click", toggleMeaning);
nextBtn.addEventListener("click", moveForward);
cardDetailCloseBtn.addEventListener("click", closeCardDetail);
cardDetailModalEl.addEventListener("click", (event) => {
  if (event.target === cardDetailModalEl || event.target.classList.contains("modal-backdrop")) {
    closeCardDetail();
  }
});
rewardCloseBtn.addEventListener("click", closeRewardModal);
rewardModalEl.addEventListener("click", (event) => {
  if (event.target === rewardModalEl || event.target.classList.contains("modal-backdrop")) {
    closeRewardModal();
  }
});

applyMissedDailyUnlocks();
saveState();
renderSteps();
showStepsScreen();
hasInitialized = true;
