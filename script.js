const STORAGE_KEY = "random-picker-wheel-categories-v1";
const DEFAULT_CATEGORIES = Array.from({ length: 9 }, (_, index) => `Category ${index + 1}`);
const SEGMENT_COLORS = [
  "#ea5f36",
  "#f28d3d",
  "#f4bf4d",
  "#d96d45",
  "#61a67f",
  "#4f91b8",
  "#4574c1",
  "#dd845e",
  "#8a9f4d"
];
const FULL_TURN = Math.PI * 2;
const SEGMENT_ANGLE = FULL_TURN / DEFAULT_CATEGORIES.length;

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinButton = document.getElementById("spinButton");
const resetButton = document.getElementById("resetButton");
const defaultsButton = document.getElementById("defaultsButton");
const categoryForm = document.getElementById("categoryForm");
const categoryInputs = Array.from(categoryForm.querySelectorAll("input"));
const roundMessage = document.getElementById("roundMessage");
const resultText = document.getElementById("resultText");
const remainingCount = document.getElementById("remainingCount");
const roundCount = document.getElementById("roundCount");
const progressBadges = document.getElementById("progressBadges");
const historyList = document.getElementById("historyList");

let categories = loadCategories();
let availableIndices = [];
let roundNumber = 1;
let roundComplete = false;
let recentHistory = [];
let lastPickedIndex = null;
let currentRotation = -Math.PI / 2;
let spinning = false;

syncInputs();
resetState("Round 1 is ready. Every category is available.");

spinButton.addEventListener("click", spinWheel);
resetButton.addEventListener("click", () => resetState("Round reset. All categories are available again."));
defaultsButton.addEventListener("click", restoreDefaults);
categoryForm.addEventListener("submit", applyCategoryChanges);

function loadCategories() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [...DEFAULT_CATEGORIES];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed) || parsed.length !== DEFAULT_CATEGORIES.length) {
      return [...DEFAULT_CATEGORIES];
    }

    return parsed.map((value, index) => sanitizeCategory(value, index));
  } catch (error) {
    return [...DEFAULT_CATEGORIES];
  }
}

function saveCategories() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch (error) {
    return;
  }
}

function sanitizeCategory(value, index) {
  const trimmed = String(value ?? "").trim();
  return trimmed || DEFAULT_CATEGORIES[index];
}

function syncInputs() {
  categoryInputs.forEach((input, index) => {
    input.value = categories[index];
  });
}

function setInteractiveState(disabled) {
  spinning = disabled;
  spinButton.disabled = disabled;
  resetButton.disabled = disabled;
  defaultsButton.disabled = disabled;
  categoryInputs.forEach((input) => {
    input.disabled = disabled;
  });
}

function applyCategoryChanges(event) {
  event.preventDefault();
  categories = categoryInputs.map((input, index) => sanitizeCategory(input.value, index));
  saveCategories();
  syncInputs();
  resetState("Categories updated. The no-repeat cycle restarted.");
}

function restoreDefaults() {
  categories = [...DEFAULT_CATEGORIES];
  saveCategories();
  syncInputs();
  resetState("Default categories restored. Round 1 is ready.");
}

function resetState(message) {
  availableIndices = categories.map((_, index) => index);
  roundNumber = 1;
  roundComplete = false;
  recentHistory = [];
  lastPickedIndex = null;
  currentRotation = -Math.PI / 2;
  resultText.textContent = "Waiting for the first spin";
  renderWheel();
  updateStatus(message);
}

function startNextRound() {
  roundNumber += 1;
  availableIndices = categories.map((_, index) => index);
  roundComplete = false;
  lastPickedIndex = null;
}

function spinWheel() {
  if (spinning) {
    return;
  }

  if (roundComplete) {
    startNextRound();
  }

  const selectionIndex = Math.floor(Math.random() * availableIndices.length);
  const chosenIndex = availableIndices.splice(selectionIndex, 1)[0];
  const chosenLabel = categories[chosenIndex];
  const startRotation = currentRotation;
  const targetRotation = computeTargetRotation(chosenIndex);
  const duration = 3600;
  const startTime = performance.now();

  setInteractiveState(true);
  roundMessage.textContent = `Spinning through Round ${roundNumber}...`;

  function animate(timestamp) {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    currentRotation = startRotation + (targetRotation - startRotation) * eased;
    renderWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    currentRotation = normalizeAngle(targetRotation);
    lastPickedIndex = chosenIndex;
    recentHistory.unshift({ round: roundNumber, label: chosenLabel });
    recentHistory = recentHistory.slice(0, 12);
    roundComplete = availableIndices.length === 0;
    renderWheel();
    updateStatus();
    setInteractiveState(false);
  }

  requestAnimationFrame(animate);
}

function computeTargetRotation(chosenIndex) {
  const targetCenterAngle = -Math.PI / 2 - chosenIndex * SEGMENT_ANGLE;
  const currentNormalized = normalizeAngle(currentRotation);
  const targetNormalized = normalizeAngle(targetCenterAngle);
  let delta = targetNormalized - currentNormalized;

  if (delta <= 0) {
    delta += FULL_TURN;
  }

  const extraTurns = 5 + Math.floor(Math.random() * 2);
  return currentRotation + delta + extraTurns * FULL_TURN;
}

function normalizeAngle(value) {
  return ((value % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

function updateStatus(messageOverride) {
  const remaining = availableIndices.length;
  const nextRound = roundNumber + 1;

  if (messageOverride) {
    roundMessage.textContent = messageOverride;
  } else if (roundComplete) {
    roundMessage.textContent = `Round ${roundNumber} is complete. The next spin starts Round ${nextRound}.`;
  } else if (lastPickedIndex === null) {
    roundMessage.textContent = `Round ${roundNumber} is ready. Every category is available.`;
  } else {
    roundMessage.textContent = `${remaining} ${remaining === 1 ? "pick" : "picks"} remain before the wheel resets into a new round.`;
  }

  resultText.textContent = lastPickedIndex === null ? "Waiting for the first spin" : categories[lastPickedIndex];
  remainingCount.textContent = roundComplete
    ? "0 picks left. All categories have been used."
    : `${remaining} ${remaining === 1 ? "pick" : "picks"} left in Round ${roundNumber}`;
  roundCount.textContent = `Round ${roundNumber}`;

  renderProgressBadges();
  renderHistory();
}

function renderProgressBadges() {
  progressBadges.replaceChildren();

  categories.forEach((category, index) => {
    const badge = document.createElement("div");
    const usedThisRound = !availableIndices.includes(index);

    badge.className = `progress-badge${usedThisRound ? " used" : ""}`;
    badge.textContent = category;
    progressBadges.appendChild(badge);
  });
}

function renderHistory() {
  historyList.replaceChildren();
  const existingEmpty = historyList.parentElement.querySelector(".history-empty");

  if (existingEmpty) {
    existingEmpty.remove();
  }

  if (recentHistory.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No categories have been selected yet.";
    historyList.after(empty);
    return;
  }

  recentHistory.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = `Round ${entry.round}: ${entry.label}`;
    historyList.appendChild(item);
  });
}

function renderWheel() {
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.45;
  const innerRing = radius * 0.15;

  ctx.clearRect(0, 0, width, height);

  const outerGlow = ctx.createRadialGradient(centerX, centerY, innerRing, centerX, centerY, radius + 40);
  outerGlow.addColorStop(0, "rgba(255, 255, 255, 0.1)");
  outerGlow.addColorStop(1, "rgba(104, 69, 28, 0.12)");
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 18, 0, FULL_TURN);
  ctx.fillStyle = outerGlow;
  ctx.fill();

  categories.forEach((category, index) => {
    const startAngle = currentRotation + index * SEGMENT_ANGLE - SEGMENT_ANGLE / 2;
    const endAngle = startAngle + SEGMENT_ANGLE;
    const midAngle = startAngle + SEGMENT_ANGLE / 2;
    const isSelected = index === lastPickedIndex;
    const segmentColor = SEGMENT_COLORS[index % SEGMENT_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = segmentColor;
    ctx.fill();

    ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 248, 239, 0.7)";
    ctx.lineWidth = isSelected ? 6 : 3;
    ctx.stroke();

    drawLabel(category, midAngle, centerX, centerY, radius);
  });

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, FULL_TURN);
  ctx.strokeStyle = "rgba(67, 49, 24, 0.18)";
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRing, 0, FULL_TURN);
  ctx.fillStyle = "rgba(255, 250, 241, 0.95)";
  ctx.fill();
  ctx.strokeStyle = "rgba(67, 49, 24, 0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawLabel(label, angle, centerX, centerY, radius) {
  const lines = splitLabel(label);
  const textX = centerX + Math.cos(angle) * radius * 0.63;
  const textY = centerY + Math.sin(angle) * radius * 0.63;
  const lineHeight = 28;

  ctx.save();
  ctx.translate(textX, textY);
  ctx.fillStyle = "#fffaf5";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 24px Aptos, Segoe UI, sans-serif";
  ctx.shadowColor = "rgba(52, 32, 12, 0.16)";
  ctx.shadowBlur = 8;

  lines.forEach((line, index) => {
    const offset = (index - (lines.length - 1) / 2) * lineHeight;
    ctx.fillText(line, 0, offset, 148);
  });

  ctx.restore();
}

function splitLabel(label) {
  const maxLineLength = 12;
  const words = label.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return ["Category"];
  }

  if (words.length === 1 && words[0].length > maxLineLength) {
    return [
      words[0].slice(0, maxLineLength),
      shorten(words[0].slice(maxLineLength), maxLineLength)
    ];
  }

  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxLineLength || currentLine.length === 0) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length > 2) {
    return [lines[0], shorten(lines.slice(1).join(" "), maxLineLength)];
  }

  return lines;
}

function shorten(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
