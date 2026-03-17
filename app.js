const phrases = [
  { en: "I'm hungry.", ko: "배고파요." },
  { en: "Let's play!", ko: "같이 놀자!" },
  { en: "Good job!", ko: "잘했어!" },
  { en: "Come here.", ko: "이리 와." },
  { en: "It's fun!", ko: "재밌다!" }
];

let currentIndex = 0;

function showCard() {
  document.getElementById("english").innerText = phrases[currentIndex].en;
  document.getElementById("korean").innerText = phrases[currentIndex].ko;
}

function nextCard() {
  currentIndex = (currentIndex + 1) % phrases.length;
  showCard();
}

function speak() {
  const text = phrases[currentIndex].en;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
}

// 초기 실행
showCard();
