import { phrases } from "./data/phrases.js";

let currentIndex = 0;
let meaningVisible = false;

const englishEl = document.getElementById("english");
const koreanEl = document.getElementById("korean");
const phraseNumberEl = document.getElementById("phrase-number");
const phraseCategoryEl = document.getElementById("phrase-category");

const speakBtn = document.getElementById("speak-btn");
const meaningBtn = document.getElementById("meaning-btn");
const nextBtn = document.getElementById("next-btn");

function formatCategory(category) {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function updateMeaningVisibility() {
  koreanEl.classList.toggle("hidden", !meaningVisible);
  meaningBtn.textContent = meaningVisible ? "Hide Meaning" : "Show Meaning";
}

function renderCard() {
  const phrase = phrases[currentIndex];

  englishEl.textContent = phrase.en;
  koreanEl.textContent = phrase.ko;
  phraseNumberEl.textContent = `${currentIndex + 1} / ${phrases.length}`;
  phraseCategoryEl.textContent = formatCategory(phrase.category);

  meaningVisible = false;
  updateMeaningVisibility();
}

function speakCurrentPhrase() {
  const phrase = phrases[currentIndex];
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

function nextCard() {
  currentIndex = (currentIndex + 1) % phrases.length;
  renderCard();
}

speakBtn.addEventListener("click", speakCurrentPhrase);
meaningBtn.addEventListener("click", toggleMeaning);
nextBtn.addEventListener("click", nextCard);

renderCard();
