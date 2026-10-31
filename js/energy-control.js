
/**
 * MEDIANA D500
 * ENERGY CONTROL
 *
 * Окремий модуль керування регулятором енергії.
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
    throw new Error("MEDIANA: регулятор не знайдено");
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("MEDIANA: не задані значення енергії");
  }

  let selectedIndex = Math.max(
    0,
    Math.min(initialIndex, steps.length - 1)
  );

  let rotation = 0;
  let accumulatedAngle = 0;

  let dragging = false;
  let lastPointerAngle = 0;

  const originalTransform = knob.style.transform;

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
    knob.style.transform =
      `rotate(${rotation}deg)`;

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

    dragging = true;
    accumulatedAngle = 0;
    lastPointerAngle = getPointerAngle(event);

    knob.setPointerCapture(event.pointerId);

    event.preventDefault();
  }

  function pointerMove(event) {
    if (!dragging) return;

    const currentAngle = getPointerAngle(event);

    let difference = currentAngle - lastPointerAngle;

    if (difference > 180) difference -= 360;
    if (difference < -180) difference += 360;

    accumulatedAngle += difference;
    rotation += difference;

    lastPointerAngle = currentAngle;

    while (accumulatedAngle >= stepAngle) {
      changeIndex(1);
      accumulatedAngle -= stepAngle;
    }

    while (accumulatedAngle <= -stepAngle) {
      changeIndex(-1);
      accumulatedAngle += stepAngle;
    }

    knob.style.transform =
      `rotate(${rotation}deg)`;
  }

  function pointerUp() {
    dragging = false;
    accumulatedAngle = 0;
  }

  function confirm() {
    onConfirm(getCurrentValue(), selectedIndex);
  }

  knob.addEventListener("pointerdown", pointerDown);
  knob.addEventListener("pointermove", pointerMove);
  knob.addEventListener("pointerup", pointerUp);
  knob.addEventListener("pointercancel", pointerUp);

  return {
    getCurrentValue,

    confirm,

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
      knob.removeEventListener("pointercancel", pointerUp);

      knob.style.transform = originalTransform;
    }
  };
}
