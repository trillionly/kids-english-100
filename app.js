import { phrases } from "./data/phrases.js";

const PHRASES_PER_STEP = 3;
const PHRASE_TARGET = 5;
const REVIEW_TARGET = 1;
const TOTAL_STEPS = 50;
const AUTO_ADVANCE_DELAY = 1200;

const CARD_TOTALS = {
  normal: TOTAL_STEPS,
  special: Math.floor(TOTAL_STEPS / 3),
  super: Math.floor(TOTAL_STEPS / 10)
};

const STORAGE_KEYS = {
  unlockedSteps: "kids-english-steps-unlocked",
  completedSteps: "kids-english-steps-completed",
  phraseProgress: "kids-english-steps-phrase-progress",
  lastUnlockDate: "kids-english-steps-last-unlock-date",
  cards: "kids-english-cards"
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const stepsScreenEl = document.getElementById("steps-screen");
const cardBoxScreenEl = document.getElementById("card-box-screen");
const reviewScreenEl = document.getElementById("review-screen");
const learningScreenEl = document.getElementById("learning-screen");
const stepsGridEl = document.getElementById("steps-grid");
const stepsMessageEl = document.getElementById("steps-message");
const cardGridEl = document.getElementById("card-grid");

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
const resetBtn = document.getElementById("reset-btn");
const reviewListenBtn = document.getElementById("review-listen-btn");
const reviewRecordBtn = document.getElementById("review-record-btn");
const reviewStartBtn = document.getElementById("review-start-btn");
const speakBtn = document.getElementById("speak-btn");
const recordBtn = document.getElementById("record-btn");
const meaningBtn = document.getElementById("meaning-btn");

const cardDetailModalEl = document.getElementById("card-detail-modal");
const cardDetailPreviewEl = document.getElementById("card-detail-preview");
const cardDetailTitleEl = document.getElementById("card-detail-title");
const cardDetailTypeEl = document.getElementById("card-detail-type");
const cardDetailCloseBtn = document.getElementById("card-detail-close-btn");

let currentStep = null;
let currentPhraseIndex = 0;
let meaningVisible = false;
let advanceTimerId = null;
let recognition = null;
let isListening = false;

let currentMode = "learning";
let pendingStep = null;
let reviewQueue = [];
let currentReviewIndex = 0;
let reviewProgress = [];

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
    cards: []
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
  nextState.cards = readStoredArray(STORAGE_KEYS.cards)
    .filter((card) => card && typeof card === "object")
    .map((card) => ({
      id: String(card.id || ""),
      type: String(card.type || "normal")
    }))
    .filter((card) => card.id);

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
  window.localStorage.setItem(STORAGE_KEYS.cards, JSON.stringify(state.cards));
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

function isStepUnlocked(stepNumber) {
  return state.unlockedSteps.includes(stepNumber);
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

function addCard(type, id) {
  if (state.cards.some((card) => card.id === id)) {
    return;
  }

  state.cards.push({ id, type });
}

function giveStepRewards(stepNumber) {
  addCard("normal", `normal-${stepNumber}`);

  if (stepNumber % 3 === 0) {
    addCard("special", `special-${stepNumber / 3}`);
  }

  if (stepNumber % 10 === 0) {
    addCard("super", `super-${stepNumber / 10}`);
  }
}

function getAllCardSlots() {
  const slots = [];

  Object.entries(CARD_TOTALS).forEach(([type, total]) => {
    for (let index = 1; index <= total; index += 1) {
      slots.push({
        id: `${type}-${index}`,
        type,
        label: `${type} card ${index}`,
        collected: state.cards.some((card) => card.id === `${type}-${index}`)
      });
    }
  });

  return slots;
}

function getCardClass(type) {
  return `card-tile ${type}`;
}

function openCardDetail(card) {
  cardDetailPreviewEl.className = `card-detail-preview ${card.collected ? card.type : "locked"}`;
  cardDetailPreviewEl.textContent = card.collected ? card.type.toUpperCase() : "?";
  cardDetailTitleEl.textContent = card.collected ? card.label : "Locked Card";
  cardDetailTypeEl.textContent = card.collected ? `Type: ${card.type}` : "Type: locked";
  cardDetailModalEl.classList.remove("hidden");
}

function closeCardDetail() {
  cardDetailModalEl.classList.add("hidden");
}

function renderCardBox() {
  cardGridEl.innerHTML = "";

  getAllCardSlots().forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${getCardClass(card.type)}${card.collected ? "" : " locked"}`;
    button.innerHTML = `
      <span class="card-tile-image">${card.collected ? card.type.toUpperCase() : "?"}</span>
      <span class="card-tile-label">${card.collected ? card.label : "Locked"}</span>
    `;
    button.addEventListener("click", () => {
      openCardDetail(card);
    });
    cardGridEl.appendChild(button);
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

  const slot = document.createElement("span");
  slot.className = `success-slot${progress >= REVIEW_TARGET ? " filled" : ""}`;
  slot.textContent = progress >= REVIEW_TARGET ? "V" : "1";
  reviewSlotsEl.appendChild(slot);
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

function updateRecordButtons() {
  if (!SpeechRecognition) {
    recordBtn.disabled = true;
    recordBtn.textContent = "🎤 Mic Unavailable";
    reviewRecordBtn.disabled = true;
    reviewRecordBtn.textContent = "🎤 Mic Unavailable";
    return;
  }

  recordBtn.disabled = false;
  reviewRecordBtn.disabled = false;
  recordBtn.textContent = isListening ? "🎤 Listening..." : "🎤 Start Mic";
  reviewRecordBtn.textContent = isListening ? "🎤 Listening..." : "🎤 Start Mic";
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
  currentMode = "steps";
  currentStep = null;
  currentPhraseIndex = 0;
  meaningVisible = false;
  pendingStep = null;
  reviewQueue = [];
  currentReviewIndex = 0;
  reviewProgress = [];
  stepsScreenEl.classList.remove("hidden");
  cardBoxScreenEl.classList.add("hidden");
  reviewScreenEl.classList.add("hidden");
  learningScreenEl.classList.add("hidden");
}

function showCardBoxScreen() {
  clearAdvanceTimer();
  stopRecognition();
  currentMode = "cards";
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

  for (let step = 1; step <= TOTAL_STEPS; step += 1) {
    const button = document.createElement("button");
    const hasEnoughPhrases = getStepPhrases(step).length === PHRASES_PER_STEP;
    const unlocked = isStepUnlocked(step) && hasEnoughPhrases;
    const completed = isStepCompleted(step);

    button.type = "button";
    button.className = `step-btn${completed ? " completed" : ""}`;
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

  reviewStepLabelEl.textContent = `Review Step ${item.stepNumber}`;
  reviewStatusEl.textContent = `Item ${currentReviewIndex + 1} / ${reviewQueue.length}`;
  reviewEnglishEl.textContent = item.phrase.en;
  reviewKoreanEl.textContent = item.phrase.ko;
  renderReviewSlots();
  setReviewFeedback("Press the mic and say the sentence once.", "");
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
    updateMeaningVisibility();
    return;
  }

  stepLabelEl.textContent = `Step ${currentStep}`;
  phraseStatusEl.textContent = `Phrase ${currentPhraseIndex + 1} / ${stepPhrases.length}`;
  englishEl.textContent = phrase.en;
  koreanEl.textContent = phrase.ko;
  meaningVisible = false;
  speakBtn.disabled = false;
  renderSuccessSlots();
  updateMeaningVisibility();
  updateRecordButtons();

  if (!SpeechRecognition) {
    setFeedback("This browser does not support microphone speech practice.", "error");
  } else {
    setFeedback("Press the mic and say the sentence.", "");
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
    speakPhrase(phrase.en);
  }
}

function speakCurrentReviewPhrase() {
  const item = getCurrentReviewItem();
  if (item) {
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
  if (!state.completedSteps.includes(stepNumber)) {
    state.completedSteps.push(stepNumber);
    giveStepRewards(stepNumber);
  }

  const nextStep = stepNumber + 1;
  const today = new Date().toISOString().slice(0, 10);

  if (
    nextStep <= TOTAL_STEPS &&
    !state.unlockedSteps.includes(nextStep) &&
    state.lastUnlockDate !== today
  ) {
    state.unlockedSteps.push(nextStep);
    state.lastUnlockDate = today;
  }
}

function moveToNextPhraseOrFinishStep() {
  const stepPhrases = getStepPhrases(currentStep);
  const nextPhraseIndex = stepPhrases.findIndex(
    (item) => getPhraseProgress(item.id) < PHRASE_TARGET
  );

  if (nextPhraseIndex === -1) {
    const nextStep = currentStep + 1;
    const today = new Date().toISOString().slice(0, 10);
    const canUnlockNextStep =
      nextStep <= TOTAL_STEPS &&
      !state.unlockedSteps.includes(nextStep) &&
      state.lastUnlockDate !== today;

    completeStep(currentStep);
    saveState();
    renderSteps();
    renderCardBox();

    if (nextStep <= TOTAL_STEPS && !canUnlockNextStep) {
      setStepsMessage("Step clear! Come back tomorrow for a new step.");
    } else {
      setStepsMessage("");
    }

    showStepsScreen();
    return;
  }

  currentPhraseIndex = nextPhraseIndex;
  renderLearningCard();
}

function advanceReview() {
  currentReviewIndex += 1;
  renderReviewCard();
}

function handleSpeechSuccess() {
  if (currentMode === "review") {
    reviewProgress[currentReviewIndex] = REVIEW_TARGET;
    renderReviewSlots();
    setReviewFeedback("Nice review! Let's go on.", "success");
    clearAdvanceTimer();
    advanceTimerId = window.setTimeout(() => {
      advanceReview();
    }, AUTO_ADVANCE_DELAY);
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
    setFeedback("Great job! Phrase cleared!", "success");
    clearAdvanceTimer();
    advanceTimerId = window.setTimeout(() => {
      moveToNextPhraseOrFinishStep();
    }, AUTO_ADVANCE_DELAY);
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

  Object.values(STORAGE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
  window.location.reload();
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
cardDetailCloseBtn.addEventListener("click", closeCardDetail);
cardDetailModalEl.addEventListener("click", (event) => {
  if (event.target === cardDetailModalEl || event.target.classList.contains("modal-backdrop")) {
    closeCardDetail();
  }
});

renderSteps();
renderCardBox();
showStepsScreen();
