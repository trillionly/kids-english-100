import { phrases } from "./data/phrases.js";

const PHRASES_PER_STEP = 3;
const PHRASE_TARGET = 5;
const TOTAL_STEPS = 50;

const STORAGE_KEYS = {
  unlockedSteps: "kids-english-steps-unlocked",
  completedSteps: "kids-english-steps-completed",
  phraseProgress: "kids-english-steps-phrase-progress"
};

const stepsScreenEl = document.getElementById("steps-screen");
const learningScreenEl = document.getElementById("learning-screen");
const stepsGridEl = document.getElementById("steps-grid");

const stepLabelEl = document.getElementById("step-label");
const phraseStatusEl = document.getElementById("phrase-status");
const englishEl = document.getElementById("english");
const koreanEl = document.getElementById("korean");
const repeatStatusEl = document.getElementById("repeat-status");

const backBtn = document.getElementById("back-btn");
const speakBtn = document.getElementById("speak-btn");
const meaningBtn = document.getElementById("meaning-btn");
const completeBtn = document.getElementById("complete-btn");

let currentStep = null;
let currentPhraseIndex = 0;
let meaningVisible = false;

const state = loadState();

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

function updateMeaningVisibility() {
  koreanEl.classList.toggle("hidden", !meaningVisible);
  meaningBtn.textContent = meaningVisible ? "Hide Meaning" : "Show Meaning";
}

function showStepsScreen() {
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
    englishEl.textContent = "This step does not have 3 phrases yet.";
    koreanEl.textContent = "";
    phraseStatusEl.textContent = `Step ${currentStep}`;
    repeatStatusEl.textContent = "Data missing";
    meaningVisible = false;
    updateMeaningVisibility();
    completeBtn.disabled = true;
    speakBtn.disabled = true;
    return;
  }

  const progress = getPhraseProgress(phrase.id);

  stepLabelEl.textContent = `Step ${currentStep}`;
  phraseStatusEl.textContent = `Phrase ${currentPhraseIndex + 1} / ${stepPhrases.length}`;
  englishEl.textContent = phrase.en;
  koreanEl.textContent = phrase.ko;
  repeatStatusEl.textContent = `Completed ${progress} / ${PHRASE_TARGET}`;

  meaningVisible = false;
  completeBtn.disabled = false;
  speakBtn.disabled = false;
  updateMeaningVisibility();
}

function speakCurrentPhrase() {
  const phrase = getStepPhrases(currentStep)[currentPhraseIndex];

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
  meaningVisible = !meaningVisible;
  updateMeaningVisibility();
}

function completeCurrentPhrase() {
  const stepPhrases = getStepPhrases(currentStep);
  const phrase = stepPhrases[currentPhraseIndex];

  if (!phrase) {
    return;
  }

  const nextProgress = getPhraseProgress(phrase.id) + 1;
  setPhraseProgress(phrase.id, nextProgress);

  if (getPhraseProgress(phrase.id) >= PHRASE_TARGET) {
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
  }

  saveState();
  renderLearningCard();
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

backBtn.addEventListener("click", () => {
  renderSteps();
  showStepsScreen();
});
speakBtn.addEventListener("click", speakCurrentPhrase);
meaningBtn.addEventListener("click", toggleMeaning);
completeBtn.addEventListener("click", completeCurrentPhrase);

renderSteps();
showStepsScreen();
