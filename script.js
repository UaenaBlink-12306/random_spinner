const STORAGE_KEY = "random-picker-wheel-categories-v2";
const DEFAULT_CATEGORY_COUNT = 9;
const DEFAULT_CATEGORIES = Array.from(
  { length: DEFAULT_CATEGORY_COUNT },
  (_, index) => `Category ${index + 1}`
);
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
const INITIAL_ROTATION = -Math.PI / 2;

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinButton = document.getElementById("spinButton");
const resetButton = document.getElementById("resetButton");
const defaultsButton = document.getElementById("defaultsButton");
const addCategoryButton = document.getElementById("addCategoryButton");
const categoryForm = document.getElementById("categoryForm");
const categoryEditor = document.getElementById("categoryEditor");
const roundMessage = document.getElementById("roundMessage");
const resultText = document.getElementById("resultText");
const remainingCount = document.getElementById("remainingCount");
const roundCount = document.getElementById("roundCount");
const progressBadges = document.getElementById("progressBadges");
const historyList = document.getElementById("historyList");
const wheelCount = document.getElementById("wheelCount");
const wheelCountLabel = document.getElementById("wheelCountLabel");
const confettiLayer = document.getElementById("confettiLayer");
const winnerOverlay = document.getElementById("winnerOverlay");
const winnerTitle = document.getElementById("winnerTitle");
const winnerSubtitle = document.getElementById("winnerSubtitle");
const winnerCloseButton = document.getElementById("winnerCloseButton");

let categories = loadCategories();
let activeCategories = [];
let roundNumber = 1;
let recentHistory = [];
let lastPickedLabel = null;
let currentRotation = INITIAL_ROTATION;
let spinning = false;
let nextCategoryId = 1;
let highlightedCategoryId = null;
let modalReturnFocusTarget = null;

renderCategoryEditor(categories);
resetState(`Round 1 is ready. ${categories.length} ${pluralize("category", categories.length)} are on the wheel.`);

spinButton.addEventListener("click", spinWheel);
resetButton.addEventListener("click", () => {
  resetState(`Round reset. ${categories.length} ${pluralize("category", categories.length)} are back on the wheel.`);
});
defaultsButton.addEventListener("click", restoreDefaults);
addCategoryButton.addEventListener("click", addCategoryField);
categoryForm.addEventListener("submit", applyCategoryChanges);
categoryEditor.addEventListener("click", handleCategoryEditorClick);
winnerCloseButton.addEventListener("click", () => {
  hideWinnerModal({ restoreFocus: true });
});
window.addEventListener("keydown", handleWindowKeydown);

function loadCategories() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [...DEFAULT_CATEGORIES];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed) || parsed.length === 0) {
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
  return trimmed || `Category ${index + 1}`;
}

function pluralize(word, count) {
  if (count === 1) {
    return word;
  }

  if (word.endsWith("y")) {
    return `${word.slice(0, -1)}ies`;
  }

  return `${word}s`;
}

function renderCategoryEditor(labels) {
  categoryEditor.replaceChildren();

  labels.forEach((label, index) => {
    categoryEditor.appendChild(buildCategoryRow(label, index));
  });

  renumberCategoryRows();
}

function buildCategoryRow(label, index) {
  const row = document.createElement("div");
  row.className = "category-row";

  const field = document.createElement("label");
  field.className = "category-field";

  const title = document.createElement("span");
  title.textContent = `Category ${index + 1}`;

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 28;
  input.autocomplete = "off";
  input.className = "category-input";
  input.value = label;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-category-button";
  removeButton.textContent = "Remove";

  field.append(title, input);
  row.append(field, removeButton);
  return row;
}

function renumberCategoryRows() {
  const rows = Array.from(categoryEditor.querySelectorAll(".category-row"));

  rows.forEach((row, index) => {
    const title = row.querySelector("span");
    const input = row.querySelector("input");
    const removeButton = row.querySelector("button");

    title.textContent = `Category ${index + 1}`;
    input.id = `category-${index + 1}`;
    input.placeholder = `Category ${index + 1}`;
    input.setAttribute("aria-label", `Category ${index + 1}`);
    removeButton.dataset.removeIndex = String(index);
    removeButton.setAttribute("aria-label", `Remove category ${index + 1}`);
    removeButton.disabled = spinning || rows.length === 1;
  });
}

function getEditorInputs() {
  return Array.from(categoryEditor.querySelectorAll(".category-input"));
}

function readEditorCategories() {
  return getEditorInputs().map((input, index) => sanitizeCategory(input.value, index));
}

function addCategoryField() {
  if (spinning) {
    return;
  }

  const labels = readEditorCategories();
  labels.push(`Category ${labels.length + 1}`);
  renderCategoryEditor(labels);

  const inputs = getEditorInputs();
  inputs[inputs.length - 1].focus();
  inputs[inputs.length - 1].select();
}

function handleCategoryEditorClick(event) {
  const removeButton = event.target.closest("[data-remove-index]");
  if (!removeButton || spinning) {
    return;
  }

  const labels = readEditorCategories();
  if (labels.length === 1) {
    return;
  }

  const index = Number(removeButton.dataset.removeIndex);
  labels.splice(index, 1);
  renderCategoryEditor(labels);

  const inputs = getEditorInputs();
  const nextIndex = Math.min(index, inputs.length - 1);
  inputs[nextIndex].focus();
}

function applyCategoryChanges(event) {
  event.preventDefault();
  categories = readEditorCategories();
  saveCategories();
  renderCategoryEditor(categories);
  resetState(`Categories updated. ${categories.length} ${pluralize("category", categories.length)} are on the wheel.`);
}

function restoreDefaults() {
  categories = [...DEFAULT_CATEGORIES];
  saveCategories();
  renderCategoryEditor(categories);
  resetState("Default 9 categories restored. Round 1 is ready.");
}

function createRoundCategories(labels) {
  return labels.map((label, index) => ({
    id: nextCategoryId++,
    label,
    color: SEGMENT_COLORS[index % SEGMENT_COLORS.length]
  }));
}

function resetState(message) {
  activeCategories = createRoundCategories(categories);
  roundNumber = 1;
  recentHistory = [];
  lastPickedLabel = null;
  highlightedCategoryId = null;
  currentRotation = INITIAL_ROTATION;
  hideWinnerModal();
  clearConfetti();
  renderWheel();
  updateStatus(message);
}

function startNextRound() {
  roundNumber += 1;
  activeCategories = createRoundCategories(categories);
  highlightedCategoryId = null;
  currentRotation = INITIAL_ROTATION;
}

function setInteractiveState(disabled) {
  spinning = disabled;
  spinButton.disabled = disabled;
  resetButton.disabled = disabled;

  Array.from(categoryForm.querySelectorAll("input, button")).forEach((element) => {
    element.disabled = disabled;
  });

  renumberCategoryRows();
}

function spinWheel() {
  if (spinning) {
    return;
  }

  if (activeCategories.length === 0) {
    startNextRound();
  }

  const segmentCount = activeCategories.length;
  const chosenIndex = Math.floor(Math.random() * segmentCount);
  const chosenCategory = activeCategories[chosenIndex];
  const startRotation = currentRotation;
  const targetRotation = computeTargetRotation(chosenIndex, segmentCount);
  const duration = 3400;
  const startTime = performance.now();

  hideWinnerModal();
  setInteractiveState(true);
  roundMessage.textContent = `Spinning Round ${roundNumber}...`;

  function animate(timestamp) {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    currentRotation = startRotation + (targetRotation - startRotation) * eased;
    highlightedCategoryId = chosenCategory.id;
    renderWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    currentRotation = normalizeAngle(targetRotation);
    lastPickedLabel = chosenCategory.label;
    recentHistory.unshift({ round: roundNumber, label: chosenCategory.label });
    recentHistory = recentHistory.slice(0, 12);
    activeCategories.splice(chosenIndex, 1);
    highlightedCategoryId = null;
    currentRotation = INITIAL_ROTATION;
    renderWheel();
    updateStatus();
    setInteractiveState(false);
    showWinnerModal(chosenCategory.label, buildWinnerSubtitle());
  }

  requestAnimationFrame(animate);
}

function buildWinnerSubtitle() {
  if (activeCategories.length === 0) {
    return `Round ${roundNumber} is clear. The next spin reloads all ${categories.length} ${pluralize("category", categories.length)}.`;
  }

  return `Removed from the wheel. ${activeCategories.length} ${pluralize("category", activeCategories.length)} ${activeCategories.length === 1 ? "remains" : "remain"} in Round ${roundNumber}.`;
}

function computeTargetRotation(chosenIndex, segmentCount) {
  const segmentAngle = FULL_TURN / segmentCount;
  const targetCenterAngle = -Math.PI / 2 - chosenIndex * segmentAngle;
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
  const remaining = activeCategories.length;
  const total = categories.length;

  if (messageOverride) {
    roundMessage.textContent = messageOverride;
  } else if (remaining === 0) {
    roundMessage.textContent = `Round ${roundNumber} is complete. The wheel is empty. Spin again to reload all ${total} ${pluralize("category", total)}.`;
  } else if (lastPickedLabel === null) {
    roundMessage.textContent = `Round ${roundNumber} is ready. ${remaining} ${pluralize("category", remaining)} are on the wheel.`;
  } else {
    roundMessage.textContent = `${remaining} ${pluralize("category", remaining)} ${remaining === 1 ? "remains" : "remain"} on the wheel in Round ${roundNumber}.`;
  }

  resultText.textContent = lastPickedLabel ?? "Waiting for the first spin";
  remainingCount.textContent = remaining === 0
    ? `Wheel empty. Next spin reloads all ${total} ${pluralize("category", total)}.`
    : `${remaining} ${pluralize("category", remaining)} remain on the wheel`;
  roundCount.textContent = `Round ${roundNumber} | ${total} total`;
  wheelCount.textContent = String(remaining);
  wheelCountLabel.textContent = remaining === 0 ? "empty" : "left";

  renderProgressBadges();
  renderHistory();
}

function renderProgressBadges() {
  progressBadges.replaceChildren();

  if (activeCategories.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-progress";
    empty.textContent = `No categories are left on the wheel. Spin again to reload the full set of ${categories.length}.`;
    progressBadges.appendChild(empty);
    return;
  }

  activeCategories.forEach((category) => {
    const badge = document.createElement("div");
    badge.className = "progress-badge";
    badge.textContent = category.label;
    badge.style.setProperty("--badge-color", category.color);
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

  if (activeCategories.length === 0) {
    drawEmptyWheel(centerX, centerY, radius, innerRing);
    return;
  }

  const segmentAngle = FULL_TURN / activeCategories.length;

  activeCategories.forEach((category, index) => {
    const startAngle = currentRotation + index * segmentAngle - segmentAngle / 2;
    const endAngle = startAngle + segmentAngle;
    const midAngle = startAngle + segmentAngle / 2;
    const isSelected = category.id === highlightedCategoryId;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = category.color;
    ctx.fill();

    ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 248, 239, 0.7)";
    ctx.lineWidth = isSelected ? 6 : 3;
    ctx.stroke();

    drawLabel(category.label, midAngle, centerX, centerY, radius, activeCategories.length);
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

function drawEmptyWheel(centerX, centerY, radius, innerRing) {
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, FULL_TURN);
  ctx.fillStyle = "rgba(255, 250, 241, 0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(67, 49, 24, 0.18)";
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.66, 0, FULL_TURN);
  ctx.strokeStyle = "rgba(67, 49, 24, 0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(106, 88, 72, 0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 28px Aptos, Segoe UI, sans-serif";
  ctx.fillText("Wheel cleared", centerX, centerY - 10);
  ctx.font = "400 18px Aptos, Segoe UI, sans-serif";
  ctx.fillText("Spin again to reload every category", centerX, centerY + 24, radius * 1.2);

  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRing, 0, FULL_TURN);
  ctx.fillStyle = "rgba(255, 250, 241, 0.95)";
  ctx.fill();
  ctx.strokeStyle = "rgba(67, 49, 24, 0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawLabel(label, angle, centerX, centerY, radius, segmentCount) {
  const lines = splitLabel(label, segmentCount);
  const fontSize = Math.max(13, 28 - Math.max(segmentCount - 4, 0));
  const lineHeight = fontSize * 1.08;
  const maxWidth = segmentCount > 12 ? 90 : segmentCount > 9 ? 112 : 148;
  const distance = segmentCount > 12 ? 0.71 : segmentCount > 9 ? 0.67 : 0.63;
  const textX = centerX + Math.cos(angle) * radius * distance;
  const textY = centerY + Math.sin(angle) * radius * distance;

  ctx.save();
  ctx.translate(textX, textY);
  ctx.fillStyle = "#fffaf5";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${fontSize}px Aptos, Segoe UI, sans-serif`;
  ctx.shadowColor = "rgba(52, 32, 12, 0.16)";
  ctx.shadowBlur = 8;

  lines.forEach((line, index) => {
    const offset = (index - (lines.length - 1) / 2) * lineHeight;
    ctx.fillText(line, 0, offset, maxWidth);
  });

  ctx.restore();
}

function splitLabel(label, segmentCount) {
  const maxLineLength = segmentCount > 12 ? 7 : segmentCount > 9 ? 9 : 12;
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

  return `${value.slice(0, Math.max(maxLength - 3, 1))}...`;
}

function handleWindowKeydown(event) {
  if (event.key !== "Escape" || winnerOverlay.hidden) {
    return;
  }

  hideWinnerModal({ restoreFocus: true });
}

function showWinnerModal(label, subtitle) {
  winnerTitle.textContent = label;
  winnerSubtitle.textContent = subtitle;
  modalReturnFocusTarget = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : spinButton;

  winnerOverlay.hidden = false;
  winnerOverlay.classList.remove("is-visible");
  void winnerOverlay.offsetWidth;
  winnerOverlay.classList.add("is-visible");
  document.body.classList.add("modal-open");
  launchConfetti();
  winnerCloseButton.focus();
}

function hideWinnerModal({ restoreFocus = false } = {}) {
  winnerOverlay.hidden = true;
  winnerOverlay.classList.remove("is-visible");
  document.body.classList.remove("modal-open");
  clearConfetti();

  if (restoreFocus) {
    (modalReturnFocusTarget ?? spinButton).focus();
  }

  modalReturnFocusTarget = null;
}

function launchConfetti() {
  clearConfetti();

  const pieceCount = Math.min(72, Math.max(28, categories.length * 4));

  for (let index = 0; index < pieceCount; index += 1) {
    const piece = document.createElement("span");
    const size = `${7 + Math.random() * 10}px`;
    const drift = `${-220 + Math.random() * 440}px`;
    const rotate = `${-360 + Math.random() * 720}deg`;
    const duration = `${2400 + Math.random() * 1200}ms`;
    const delay = `${-Math.random() * 3200}ms`;

    piece.className = `confetti-piece${Math.random() > 0.55 ? " square" : ""}`;
    piece.style.setProperty("--left", `${Math.random() * 100}%`);
    piece.style.setProperty("--size", size);
    piece.style.setProperty("--color", SEGMENT_COLORS[index % SEGMENT_COLORS.length]);
    piece.style.setProperty("--drift", drift);
    piece.style.setProperty("--rotate", rotate);
    piece.style.setProperty("--duration", duration);
    piece.style.setProperty("--delay", delay);
    confettiLayer.appendChild(piece);
  }
}

function clearConfetti() {
  confettiLayer.replaceChildren();
}
