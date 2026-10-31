
/**
 * MEDIANA D500
 * ENERGY CONTROL MODULE
 *
 * Шкала: 1–200 J
 * Початкове значення: 125 J
 *
 * Обертання за годинниковою стрілкою — збільшення.
 * Обертання проти годинникової стрілки — зменшення.
 * Коротке натискання — підтвердження.
 *
 * Зображення регулятора залишається нерухомим.
 */

export const ENERGY_STEPS = [
  1, 2, 4, 6, 8, 10, 12, 14, 16,
  20, 25, 50, 75, 100, 125, 150, 175, 200
];

export const INITIAL_ENERGY = 125;

export function createEnergyControl({
  knob,
  deviceImage,
  deviceWrap,

  energyImage = "mediana-energy.png",

  stepAngle = 25,
  movementThreshold = 5,

  onChange = () => {},
  onConfirm = () => {}
}) {
  if (!knob) {
    throw new Error("MEDIANA: зону dial не знайдено");
  }

  if (!deviceImage) {
    throw new Error("MEDIANA: зображення пристрою не знайдено");
  }

  if (!deviceWrap) {
    throw new Error("MEDIANA: контейнер пристрою не знайдено");
  }

  if (stepAngle <= 0 || !Number.isFinite(stepAngle)) {
    throw new Error("MEDIANA: неправильний кут кроку");
  }

  // Початкове значення 125 J.
  let selectedIndex = ENERGY_STEPS.indexOf(INITIAL_ENERGY);

  // Стан регулятора.
  let enabled = false;
  let pointerActive = false;
  let pointerMoved = false;
  let activePointerId = null;

  let startX = 0;
  let startY = 0;

  let lastAngle = 0;
  let accumulatedAngle = 0;

  // Збереження початкового зображення.
  const originalImage = deviceImage.getAttribute("src");

  // Створення динамічного відображення енергії.
  const energyDisplay = document.createElement("div");

  energyDisplay.id = "energyValue";
  energyDisplay.textContent = INITIAL_ENERGY + " J";

  energyDisplay.style.position = "absolute";
  energyDisplay.style.display = "none";
  energyDisplay.style.alignItems = "center";
  energyDisplay.style.justifyContent = "center";
  energyDisplay.style.background = "#050a12";
  energyDisplay.style.color = "#ffd34e";
  energyDisplay.style.fontFamily = "Arial, sans-serif";
  energyDisplay.style.fontWeight = "bold";
  energyDisplay.style.whiteSpace = "nowrap";
  energyDisplay.style.zIndex = "5";
  energyDisplay.style.pointerEvents = "none";
  energyDisplay.style.userSelect = "none";

  deviceWrap.appendChild(energyDisplay);

  function getCurrentValue() {
    return ENERGY_STEPS[selectedIndex];
  }

  function getCurrentIndex() {
    return selectedIndex;
  }

  function updateDisplay() {
    const value = getCurrentValue();

    energyDisplay.textContent = value + " J";

    onChange(value, selectedIndex);
  }

  function getPointerAngle(event) {
    const rect = knob.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    return Math.atan2(
      event.clientY - centerY,
      event.clientX - centerX
    ) * 180 / Math.PI;
  }

  function changeIndex(direction) {
    const nextIndex = selectedIndex + direction;

    // Без циклічного переходу через межі шкали.
    if (
      nextIndex < 0 ||
      nextIndex >= ENERGY_STEPS.length
    ) {
      return;
    }

    selectedIndex = nextIndex;
    updateDisplay();
  }

  // Відкриття вибору енергії.
  function open() {
    if (enabled) return;

    enabled = true;

    deviceImage.src = energyImage;

    energyDisplay.style.display = "flex";

    updateDisplay();
  }

  // Закриття без підтвердження.
  function close() {
    enabled = false;

    pointerActive = false;
    activePointerId = null;
    accumulatedAngle = 0;

    energyDisplay.style.display = "none";

    deviceImage.src = originalImage;
  }

  function pointerDown(event) {
    if (!enabled || pointerActive) return;

    if (
      event.button !== undefined &&
      event.button !== 0
    ) {
      return;
    }

    pointerActive = true;
    pointerMoved = false;
    activePointerId = event.pointerId;

    startX = event.clientX;
    startY = event.clientY;

    lastAngle = getPointerAngle(event);
    accumulatedAngle = 0;

    knob.setPointerCapture(event.pointerId);

    event.preventDefault();
  }

  function pointerMove(event) {
    if (
      !enabled ||
      !pointerActive ||
      event.pointerId !== activePointerId
    ) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - startX,
      event.clientY - startY
    );

    if (distance >= movementThreshold) {
      pointerMoved = true;
    }

    if (!pointerMoved) return;

    const currentAngle = getPointerAngle(event);

    let difference = currentAngle - lastAngle;

    if (difference > 180) difference -= 360;
    if (difference < -180) difference += 360;

    lastAngle = currentAngle;

    accumulatedAngle += difference;

    // Обертання за годинниковою стрілкою.
    while (accumulatedAngle >= stepAngle) {
      changeIndex(1);
      accumulatedAngle -= stepAngle;
    }

    // Обертання проти годинникової стрілки.
    while (accumulatedAngle <= -stepAngle) {
      changeIndex(-1);
      accumulatedAngle += stepAngle;
    }
  }

  function pointerUp(event) {
    if (
      !pointerActive ||
      event.pointerId !== activePointerId
    ) {
      return;
    }

    pointerActive = false;
    activePointerId = null;

    if (enabled && !pointerMoved) {
      confirm();
    }

    accumulatedAngle = 0;
  }

  function pointerCancel(event) {
    if (event.pointerId !== activePointerId) return;

    pointerActive = false;
    activePointerId = null;
    accumulatedAngle = 0;
  }

  // Підтвердження вибору.
  function confirm() {
    if (!enabled || pointerActive) return;

    const value = getCurrentValue();
    const index = selectedIndex;

    onConfirm(value, index);

    close();

    return value;
  }

  // Встановлення значення програмно.
  function setValue(value) {
    const index = ENERGY_STEPS.indexOf(value);

    if (index === -1) return;

    selectedIndex = index;
    updateDisplay();
  }

  // Налаштування розташування динамічного числа.
  function setDisplayPosition({
    x,
    y,
    width,
    height
  }) {
    energyDisplay.style.left = x + "%";
    energyDisplay.style.top = y + "%";
    energyDisplay.style.width = width + "%";
    energyDisplay.style.height = height + "%";
  }

  // Видалення обробників.
  function destroy() {
    close();

    knob.removeEventListener(
      "pointerdown",
      pointerDown
    );

    knob.removeEventListener(
      "pointermove",
      pointerMove
    );

    knob.removeEventListener(
      "pointerup",
      pointerUp
    );

    knob.removeEventListener(
      "pointercancel",
      pointerCancel
    );

    energyDisplay.remove();
  }

  knob.addEventListener("pointerdown", pointerDown);
  knob.addEventListener("pointermove", pointerMove);
  knob.addEventListener("pointerup", pointerUp);
  knob.addEventListener("pointercancel", pointerCancel);

  return {
    open,
    close,
    confirm,
    getCurrentValue,
    getCurrentIndex,
    setValue,
    setDisplayPosition,
    destroy
  };
}
