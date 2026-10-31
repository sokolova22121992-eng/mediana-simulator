
/**
 * MEDIANA D500
 * ENERGY CONTROL MODULE
 *
 * Регулятор на фото нерухомий.
 * Рух мишки по колу змінює енергію.
 * Коротке натискання підтверджує вибір.
 */

export function createEnergyControl({
  knob,
  steps,
  initialIndex = 0,
  stepAngle = 25,
  onChange = () => {},
  onConfirm = () => {}
}) {
  if (!knob) {
    throw new Error("MEDIANA: зону регулятора dial не знайдено");
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("MEDIANA: не задана шкала енергії");
  }

  if (!Number.isFinite(stepAngle) || stepAngle <= 0) {
    throw new Error("MEDIANA: неправильний кут кроку");
  }

  let selectedIndex = Math.max(
    0,
    Math.min(initialIndex, steps.length - 1)
  );

  let dragging = false;
  let pointerMoved = false;
  let accumulatedAngle = 0;
  let lastPointerAngle = 0;
  let activePointerId = null;
  let confirmed = false;

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

  function update() {
    confirmed = false;
    onChange(getCurrentValue(), selectedIndex);
  }

  function changeIndex(direction) {
    const nextIndex = selectedIndex + direction;

    if (nextIndex < 0 || nextIndex >= steps.length) {
      return;
    }

    selectedIndex = nextIndex;
    update();
  }

  function pointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    if (dragging) return;

    dragging = true;
    pointerMoved = false;
    accumulatedAngle = 0;
    activePointerId = event.pointerId;
    lastPointerAngle = getPointerAngle(event);

    knob.setPointerCapture(event.pointerId);

    event.preventDefault();
  }

  function pointerMove(event) {
    if (!dragging || event.pointerId !== activePointerId) {
      return;
    }

    const currentAngle = getPointerAngle(event);

    let difference = currentAngle - lastPointerAngle;

    if (difference > 180) difference -= 360;
    if (difference < -180) difference += 360;

    if (Math.abs(difference) > 0.5) {
      pointerMoved = true;
    }

    accumulatedAngle += difference;
    lastPointerAngle = currentAngle;

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
    if (!dragging || event.pointerId !== activePointerId) {
      return;
    }

    dragging = false;
    activePointerId = null;

    if (!pointerMoved && !confirmed) {
      confirmed = true;
      onConfirm(getCurrentValue(), selectedIndex);
    }

    accumulatedAngle = 0;
  }

  function pointerCancel(event) {
    if (event.pointerId !== activePointerId) return;

    dragging = false;
    activePointerId = null;
    accumulatedAngle = 0;
  }

  knob.addEventListener("pointerdown", pointerDown);
  knob.addEventListener("pointermove", pointerMove);
  knob.addEventListener("pointerup", pointerUp);
  knob.addEventListener("pointercancel", pointerCancel);

  return {
    getCurrentValue,

    confirm() {
      if (dragging || confirmed) return;

      confirmed = true;
      onConfirm(getCurrentValue(), selectedIndex);
    },

    setValue(index) {
      if (!Number.isInteger(index)) return;
      if (index < 0 || index >= steps.length) return;

      selectedIndex = index;
      update();
    },

    destroy() {
      knob.removeEventListener("pointerdown", pointerDown);
      knob.removeEventListener("pointermove", pointerMove);
      knob.removeEventListener("pointerup", pointerUp);
      knob.removeEventListener("pointercancel", pointerCancel);

      dragging = false;
      activePointerId = null;
    }
  };
}
