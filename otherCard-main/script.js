const screens = new Map(
  [...document.querySelectorAll("[data-screen]")].map((el) => [el.dataset.screen, el])
);

let currentScreen = "screen-01";
let drawTimer;
let currentCard = null;
let isDrawing = false;

const cardPool = Array.from({ length: 60 }, (_, i) => ({
  image: `img/card/cardFront-${i + 1}.png`,
  quote: "修道真言",
}));

const resultCardImg = document.querySelector("[data-result-card]");
const resultQuote = document.querySelector("[data-result-quote]");
const saveBtn = document.querySelector("[data-save]");
const deck = document.querySelector("[data-deck]");
const overlay = document.querySelector(".draw-overlay");
const flipCardFront = document.querySelector("[data-flip-front]");
const drawingCard = document.querySelector(".drawing-card");
const totalCards = 52;
const resultMessage = "請細讀文字，感受當下的啟示。";

if (resultQuote) {
  resultQuote.textContent = resultMessage;
}

const renderDeck = () => {
  if (!deck) return;
  deck.innerHTML = "";
  const mid = (totalCards - 1) / 2;
  for (let i = 0; i < totalCards; i++) {
    const card = document.createElement("img");
    card.src = "img/card/cardBack.png";
    card.alt = "";
    card.draggable = false;
    card.oncontextmenu = () => false;
    card.style.setProperty("--offset", i - mid);
    card.style.setProperty("--order", i);
    card.addEventListener("mouseenter", () => card.classList.add("is-hovered"));
    card.addEventListener("mouseleave", () => card.classList.remove("is-hovered"));
    deck.appendChild(card);
  }
};

renderDeck();

const goToScreen = (id) => {
  if (!screens.has(id)) return;
  screens.forEach((el, key) => el.classList.toggle("active", key === id));
  currentScreen = id;
  if (id === "screen-03") {
    isDrawing = false;
    overlay.classList.remove("visible", "flipping", "zooming-out");
    deck.classList.remove("active");
  }
};

const autoAdvance = () => setTimeout(() => goToScreen("screen-02"), 2000);
autoAdvance();

document.querySelectorAll("[data-go]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.go) goToScreen(btn.dataset.go);
  });
});

const triggerDraw = () => {
  if (isDrawing || overlay.classList.contains("visible")) return;
  isDrawing = true;

  const chosenIndex = Math.floor(Math.random() * cardPool.length);
  const chosen = cardPool[chosenIndex];

  if (typeof gtag === "function") {
    gtag("event", "card_drawn", {
      card_number: chosenIndex + 1,
      card_filename: `cardFront-${chosenIndex + 1}.png`,
    });
  }

  currentCard = chosen;
  if (flipCardFront) flipCardFront.src = chosen.image;

  const finishFlip = () => {
    const flipCardInner = overlay.querySelector(".flip-card-inner");
    if (flipCardInner) flipCardInner.style.transform = "rotateY(180deg)";
    overlay.classList.remove("flipping");
    setTimeout(() => {
      overlay.classList.add("zooming-out");
      resultCardImg.src = chosen.image;
      if (resultQuote) resultQuote.textContent = resultMessage;
      goToScreen("screen-06");
      setTimeout(() => {
        overlay.classList.remove("visible", "zooming-out");
        deck.classList.remove("active");
        isDrawing = false;
      }, 1000);
    }, 1000);
  };

  deck.classList.add("active");

  if (drawingCard) {
    drawingCard.innerHTML = "";
    const cardImg = document.createElement("img");
    cardImg.src = "img/card/cardBack.png";
    cardImg.alt = "";
    cardImg.draggable = false;
    cardImg.oncontextmenu = () => false;
    drawingCard.appendChild(cardImg);
    drawingCard.classList.add("active");

    const isMobile = window.innerWidth <= 768;
    setTimeout(() => {
      drawingCard.classList.remove("active");
      overlay.classList.add("visible");
      requestAnimationFrame(() => overlay.classList.add("flipping"));
      clearTimeout(drawTimer);
      drawTimer = setTimeout(finishFlip, 4000);
    }, isMobile ? 2000 : 1000);
  } else {
    overlay.classList.add("visible");
    requestAnimationFrame(() => overlay.classList.add("flipping"));
    clearTimeout(drawTimer);
    drawTimer = setTimeout(finishFlip, 2000);
  }
};

const handleDeckInteraction = () => {
  if (currentScreen !== "screen-05") return;
  triggerDraw();
};

deck.addEventListener("click", handleDeckInteraction);
deck.addEventListener("keypress", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleDeckInteraction();
  }
});

saveBtn.addEventListener("click", () => {
  if (!currentCard) return;
  const link = document.createElement("a");
  link.href = currentCard.image;
  const fileName = (currentCard.quote || resultMessage).slice(0, 10).replace(/\s+/g, "");
  link.download = `修道真言-${fileName || "card"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
});

document.addEventListener("contextmenu", (e) => {
  if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
  if (e.target.closest("[data-save]") || e.target.closest(".actions")) return;
  if (e.target.tagName === "IMG" && !e.target.hasAttribute("data-result-card")) {
    e.preventDefault();
    return false;
  }
  if (e.target.classList.contains("screen") || e.target.classList.contains("stage")) {
    e.preventDefault();
    return false;
  }
});

document.addEventListener("dragstart", (e) => {
  if (e.target.tagName === "IMG" && !e.target.hasAttribute("data-result-card")) {
    e.preventDefault();
    return false;
  }
});

document.addEventListener("copy", (e) => {
  if (e.target.tagName === "IMG" && !e.target.hasAttribute("data-result-card")) {
    e.preventDefault();
    return false;
  }
});

document.addEventListener("selectstart", (e) => {
  if (
    e.target.tagName === "BUTTON" ||
    e.target.tagName === "INPUT" ||
    e.target.tagName === "TEXTAREA"
  ) return;
  if (e.target.tagName === "IMG" && !e.target.hasAttribute("data-result-card")) {
    e.preventDefault();
    return false;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    return false;
  }
});
