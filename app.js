import { phrases } from "./data/phrases.js";

let currentIndex = 0;
let meaningVisible = false;
let activeCategory = "all";

const englishEl = document.getElementById("english");
const koreanEl = document.getElementById("korean");
const phraseNumberEl = document.getElementById("phrase-number");
const phraseCategoryEl = document.getElementById("phrase-category");
const categoryFiltersEl = document.getElementById("category-filters");

const speakBtn = document.getElementById("speak-btn");
const meaningBtn = document.getElementById("meaning-btn");
const nextBtn = document.getElementById("next-btn");

const categories = ["all", ...new Set(phrases.map((phrase) => phrase.category))];

function getVisiblePhrases() {
  if (activeCategory === "all") {
    return phrases;
  }

  return phrases.filter((phrase) => phrase.category === activeCategory);
}

function formatCategory(category) {
  if (category === "all") {
    return "All";
  }

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
  const visiblePhrases = getVisiblePhrases();
  const phrase = visiblePhrases[currentIndex];

  englishEl.textContent = phrase.en;
  koreanEl.textContent = phrase.ko;
  phraseNumberEl.textContent = `${currentIndex + 1} / ${visiblePhrases.length}`;
  phraseCategoryEl.textContent = formatCategory(phrase.category);

  meaningVisible = false;
  updateMeaningVisibility();
}

function speakCurrentPhrase() {
  const phrase = getVisiblePhrases()[currentIndex];
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
  const visiblePhrases = getVisiblePhrases();
  currentIndex = (currentIndex + 1) % visiblePhrases.length;
  renderCard();
}

function renderCategoryFilters() {
  categoryFiltersEl.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `filter-btn${category === activeCategory ? " active" : ""}`;
    button.textContent = formatCategory(category);
    button.addEventListener("click", () => {
      activeCategory = category;
      currentIndex = 0;
      renderCategoryFilters();
      renderCard();
    });

    categoryFiltersEl.appendChild(button);
  });
}

speakBtn.addEventListener("click", speakCurrentPhrase);
meaningBtn.addEventListener("click", toggleMeaning);
nextBtn.addEventListener("click", nextCard);

renderCategoryFilters();
renderCard();
