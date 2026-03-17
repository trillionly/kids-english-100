import { phrases } from "./data/phrases.js";

const PHRASES_PER_STEP = 3;
const PHRASE_TARGET = 5;
const TOTAL_STEPS = 50;
const AUTO_ADVANCE_DELAY = 1200;

const STORAGE_KEYS = {
  unlockedSteps: "kids-english-steps-unlocked",
  completedSteps: "kids-english-steps-completed",
  phraseProgress: "kids-english-steps-phrase-progress"
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const stepsScreenEl = document.getElementById("steps-screen");
const learningScreenEl = document.getElementById("learning-screen");
const stepsGridEl = document.getElementById("steps-grid");

const stepLabelEl = document.getElementById("step-label");
const phraseStatusEl = document.getElementById("phrase-status");
const englishEl = document.getElementById("english");
const koreanEl = document.getElementById("korean");
const successSlotsEl = document.getElementById("success-slots");
const feedbackTextEl = document.getElementById("feedback-text");

const backBtn = document.getElementById("back-btn");
const speakBtn = document.getElementById("speak-btn");
const recordBtn = document.getElementById("record-btn");
const meaningBtn = document.getElementById("meaning-btn");

let currentStep = null;
let currentPhraseIndex = 0;
let meaningVisible = false;
let advanceTimerId = null;
let recognition = null;
let isListening = false;

const state = loadState();

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    isListening = true;
    updateRecordButton();
    setFeedback("Listening... Say the sentence!", "");
  });

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    handleSpeechResult(transcript);
  });

  recognition.addEventListener("error", () => {
    isListening = false;
    updateRecordButton();
    setFeedback("Let's try again. Tap the mic and speak clearly.", "error");
  });

  recognition.addEventListener("end", () => {
    isListening = false;
    updateRecordButton();
  });
}

function createInitialState() {
  return {
    unlockedSteps: [1],
    completedSteps: [],
    phraseProgress: {}
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
    "a",
    "an",
    "the",
    "is",
    "are",
    "am",
    "to",
    "my",
    "your",
    "me",
    "i",
    "it",
    "this",
    "that",
    "we",
    "you",
    "now",
    "do",
    "be"
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

function setFeedback(message, tone) {
  feedbackTextEl.textContent = message;
  feedbackTextEl.className = `feedback-text${tone ? ` ${tone}` : ""}`;
}

function updateRecordButton() {
  if (!SpeechRecognition) {
    recordBtn.disabled = true;
    recordBtn.textContent = "Mic Unavailable";
    return;
  }

  recordBtn.disabled = false;
  recordBtn.textContent = isListening ? "Listening..." : "Start Mic";
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
  currentStep = null;
  currentPhraseIndex = 0;
  meaningVisible = false;
  stepsScreenEl.classList.remove("hidden");
  learningScreenEl.classList.add("hidden");
}

function showLearningScreen() {
  stepsScreenEl.classList.add("hidden");
  learningScreenEl.classList.remove("hidden");
}

function findFirstIncompletePhraseIndex(stepPhrases) {
  const incompleteIndex = stepPhrases.findIndex(
    (phrase) => getPhraseProgress(phrase.id) < PHRASE_TARGET
  );

  return incompleteIndex === -1 ? 0 : incompleteIndex;
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
        clearAdvanceTimer();
        currentStep = step;
        currentPhraseIndex = findFirstIncompletePhraseIndex(getStepPhrases(step));
        renderLearningCard();
        showLearningScreen();
      });
    }

    stepsGridEl.appendChild(button);
  }
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
  updateRecordButton();

  if (!SpeechRecognition) {
    setFeedback("This browser does not support microphone speech practice.", "error");
  } else {
    setFeedback("Press the mic and say the sentence.", "");
  }
}

function speakCurrentPhrase() {
  const phrase = getCurrentPhrase();

  if (!phrase) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(phrase.en);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function toggleMeaning() {
  if (meaningBtn.disabled) {
    return;
  }

  meaningVisible = !meaningVisible;
  meaningBtn.textContent = meaningVisible ? "Hide Meaning" : "Show Meaning";
  updateMeaningVisibility();
}

function completeStep(stepNumber) {
  if (!state.completedSteps.includes(stepNumber)) {
    state.completedSteps.push(stepNumber);
  }

  const nextStep = stepNumber + 1;
  if (nextStep <= TOTAL_STEPS && !state.unlockedSteps.includes(nextStep)) {
    state.unlockedSteps.push(nextStep);
  }
}

function moveToNextPhraseOrFinishStep() {
  const stepPhrases = getStepPhrases(currentStep);
  const nextPhraseIndex = stepPhrases.findIndex(
    (item) => getPhraseProgress(item.id) < PHRASE_TARGET
  );

  if (nextPhraseIndex === -1) {
    completeStep(currentStep);
    saveState();
    renderSteps();
    showStepsScreen();
    return;
  }

  currentPhraseIndex = nextPhraseIndex;
  renderLearningCard();
}

function handleSpeechSuccess() {
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
  const phrase = getCurrentPhrase();

  if (!phrase) {
    return;
  }

  if (isSpeechMatch(transcript, phrase.en)) {
    handleSpeechSuccess();
  } else {
    setFeedback(`Good try! We heard: "${transcript}"`, "error");
  }
}

function startRecognition() {
  if (!recognition || isListening) {
    return;
  }

  clearAdvanceTimer();
  meaningVisible = false;
  updateMeaningVisibility();

  try {
    recognition.start();
  } catch {
    setFeedback("Tap the mic again in a moment.", "error");
  }
}

backBtn.addEventListener("click", () => {
  renderSteps();
  showStepsScreen();
});
speakBtn.addEventListener("click", speakCurrentPhrase);
recordBtn.addEventListener("click", startRecognition);
meaningBtn.addEventListener("click", toggleMeaning);

renderSteps();
showStepsScreen();
