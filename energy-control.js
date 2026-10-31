
/**
 * MEDIANA D500
 * ENERGY CONTROL MODULE
 *
 * Логіка вибору енергії:
 * - обертання в зоні dial змінює значення;
 * - коротке натискання підтверджує вибір;
 * - зображення ручки залишається нерухомим.
 */

export function createEnergyControl({
  knob,
  steps,
  initialIndex = 0,
  stepAngle = 25,
  movementThreshold = 5,
  onChange = () => {},
  onConfirm = () => {}
}) {
  if (!knob) {
    throw new Error("MEDIANA: зону dial не знайдено");
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("MEDIANA: не задана шкала енергії");
  }

  if (!Number.isFinite(stepAngle) || stepAngle <= 0) {
    throw new Error("MEDIANA: неправильний кут кроку");
  }

  let selectedIndex = Math.max(
    0,
    Math.min(Math.round(initialIndex), steps.length - 1)
  );

  let pointerActive = false;
  let pointerMoved = false;
  let activePointerId = null;

  let startX = 0;
  let startY = 0;

  let lastAngle = 0;
  let accumulatedAngle = 0;

  function getCurrentValue() {
    return steps[selectedIndex];
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

  function notifyChange() {
    onChange(getCurrentValue(), selectedIndex);
  }

  function changeIndex(direction) {
    const nextIndex = selectedIndex + direction;

    if (nextIndex < 0 || nextIndex >= steps.length) {
      return;
    }

    selectedIndex = nextIndex;
    notifyChange();
  }

  function pointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    if (pointerActive) return;

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
    if (!pointerActive || event.pointerId !== activePointerId) {
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
    if (!pointerActive || event.pointerId !== activePointerId) {
      return;
    }

    pointerActive = false;
    activePointerId = null;

    if (!pointerMoved) {
      onConfirm(getCurrentValue(), selectedIndex);
    }

    accumulatedAngle = 0;
  }

  function pointerCancel(event) {
    if (event.pointerId !== activePointerId) return;

    pointerActive = false;
    activePointerId = null;
    accumulatedAngle = 0;
  }

  function setValue(index) {
    if (!Number.isInteger(index)) return;

    if (index < 0 || index >= steps.length) return;

    selectedIndex = index;
    notifyChange();
  }

  function confirm() {
    if (pointerActive) return;

    onConfirm(getCurrentValue(), selectedIndex);
  }

  function destroy() {
    knob.removeEventListener("pointerdown", pointerDown);
    knob.removeEventListener("pointermove", pointerMove);
    knob.removeEventListener("pointerup", pointerUp);
    knob.removeEventListener("pointercancel", pointerCancel);

    pointerActive = false;
    activePointerId = null;
    accumulatedAngle = 0;
  }

  knob.addEventListener("pointerdown", pointerDown);
  knob.addEventListener("pointermove", pointerMove);
  knob.addEventListener("pointerup", pointerUp);
  knob.addEventListener("pointercancel", pointerCancel);

  return {
    getCurrentValue,
    getCurrentIndex: () => selectedIndex,
    setValue,
    confirm,
    destroy
  };
}
