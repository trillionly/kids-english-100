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
  const labels = {
    play: "놀이",
    emotion: "감정",
    friends: "친구",
    hero: "히어로",
    daily: "일상",
    action: "행동",
    movement: "움직임",
    interaction: "상호작용",
    game: "게임",
    "daily-action": "생활"
  };

  return labels[category] || category;
}

function renderCard() {
  const phrase = phrases[currentIndex];

  englishEl.textContent = phrase.en;
  koreanEl.textContent = phrase.ko;
  phraseNumberEl.textContent = `${currentIndex + 1} / ${phrases.length}`;
  phraseCategoryEl.textContent = formatCategory(phrase.category);

  meaningVisible = false;
  koreanEl.classList.add("hidden");
  meaningBtn.textContent = "👀 뜻 보기";
}

function speakCurrentPhrase() {
  const phrase = phrases[currentIndex];
  const utterance = new SpeechSynthesisUtterance(phrase.en);

  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function toggleMeaning() {
  meaningVisible = !meaningVisible;

  if (meaningVisible) {
    koreanEl.classList.remove("hidden");
    meaningBtn.textContent = "🙈 뜻 숨기기";
  } else {
    koreanEl.classList.add("hidden");
    meaningBtn.textContent = "👀 뜻 보기";
  }
}

function nextCard() {
  currentIndex = (currentIndex + 1) % phrases.length;
  renderCard();
}

speakBtn.addEventListener("click", speakCurrentPhrase);
meaningBtn.addEventListener("click", toggleMeaning);
nextBtn.addEventListener("click", nextCard);

renderCard();
