/**
 * MEDIANA D500
 * ENERGY CONTROL MODULE
 *
 * Початкове значення: 125 J
 * Мінімум: 1 J
 * Максимум: 200 J
 *
 * За годинниковою стрілкою — збільшення.
 * Проти годинникової стрілки — зменшення.
 * Коротке натискання — підтвердження.
 *
 * Після підтвердження екран енергії залишається відкритим.
 * Закриття відбувається окремою командою close().
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

  if (!deviceImage || !deviceWrap) {
    throw new Error("MEDIANA: не знайдено елементи пристрою");
  }

  if (stepAngle <= 0 || !Number.isFinite(stepAngle)) {
    throw new Error("MEDIANA: неправильний кут кроку");
  }

  let selectedIndex = ENERGY_STEPS.indexOf(INITIAL_ENERGY);

  let enabled = false;
  let confirmed = false;

  let pointerActive = false;
  let pointerMoved = false;
  let activePointerId = null;

  let startX = 0;
  let startY = 0;

  let lastAngle = 0;
  let accumulatedAngle = 0;

  const energyDisplay = document.createElement("div");

  energyDisplay.id = "energyValue";
  energyDisplay.textContent = INITIAL_ENERGY + " J";

  Object.assign(energyDisplay.style, {
    position: "absolute",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    background: "#050a12",
    color: "#ffd34e",
    fontFamily: "Arial, sans-serif",
    fontWeight: "bold",
    whiteSpace: "nowrap",
    zIndex: "5",
    pointerEvents: "none",
    userSelect: "none"
  });

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

    if (nextIndex < 0 || nextIndex >= ENERGY_STEPS.length) {
      return;
    }

    selectedIndex = nextIndex;
    confirmed = false;

    updateDisplay();
  }

  // Відкриття екрана вибору енергії
  function open() {
    if (enabled) return;

    enabled = true;
    confirmed = false;

    deviceImage.src = energyImage;
    energyDisplay.style.display = "flex";

    updateDisplay();
  }

  // Закриття екрана. Викликатиметься кнопкою ЗАРЯД.
  function close() {
    enabled = false;

    pointerActive = false;
    activePointerId = null;
    accumulatedAngle = 0;

    energyDisplay.style.display = "none";
  }

  function pointerDown(event) {
    if (!enabled || pointerActive || confirmed) return;

    if (event.button !== undefined && event.button !== 0) {
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

    while (accumulatedAngle >= stepAngle) {
      changeIndex(1);
      accumulatedAngle -= stepAngle;
    }

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
    accumulatedAngle = 0;

    if (enabled && !pointerMoved) {
      confirm();
    }
  }

  function pointerCancel(event) {
    if (event.pointerId !== activePointerId) return;

    pointerActive = false;
    activePointerId = null;
    accumulatedAngle = 0;
  }

  // Підтвердження НЕ закриває екран енергії
  function confirm() {
    if (!enabled || pointerActive || confirmed) return;

    confirmed = true;

    const value = getCurrentValue();
    const index = selectedIndex;

    onConfirm(value, index);

    return value;
  }

  function setValue(value) {
    const index = ENERGY_STEPS.indexOf(value);

    if (index === -1) return;

    selectedIndex = index;
    confirmed = false;

    updateDisplay();
  }

  // Координати дисплея налаштуємо окремо
  function setDisplayPosition({ x, y, width, height }) {
    energyDisplay.style.left = x + "%";
    energyDisplay.style.top = y + "%";
    energyDisplay.style.width = width + "%";
    energyDisplay.style.height = height + "%";
  }

  function destroy() {
    close();

    knob.removeEventListener("pointerdown", pointerDown);
    knob.removeEventListener("pointermove", pointerMove);
    knob.removeEventListener("pointerup", pointerUp);
    knob.removeEventListener("pointercancel", pointerCancel);

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
