
/**
 * MEDIANA D500
 * ENERGY CONTROL MODULE
 *
 * Екран енергії — окремий шар поверх корпусу.
 * У режимі редагування можна переміщувати та змінювати його розмір.
 * Координати зберігаються у localStorage браузера.
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
  if (!knob) throw new Error("MEDIANA: зону dial не знайдено");
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

  const STORAGE_KEY = "mediana-energy-position";

  const energyLayer = document.createElement("div");
  energyLayer.id = "energyScreenLayer";

  Object.assign(energyLayer.style, {
    position: "absolute",
    left: "0%",
    top: "0%",
    width: "100%",
    height: "100%",
    display: "none",
    zIndex: "4",
    pointerEvents: "none"
  });

  const screenImage = document.createElement("img");
  screenImage.src = energyImage;
  screenImage.alt = "Екран вибору енергії";

  Object.assign(screenImage.style, {
    position: "absolute",
    left: "48%",
    top: "22%",
    width: "12%",
    height: "10%",
    objectFit: "fill",
    pointerEvents: "none",
    userSelect: "none"
  });

  energyLayer.appendChild(screenImage);
  deviceWrap.appendChild(energyLayer);

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

  let editing = false;
  let dragging = false;
  let resizing = false;
  let activeHandle = null;
  let dragStart = null;

  const editor = document.createElement("div");
  editor.id = "energyScreenEditor";

  Object.assign(editor.style, {
    position: "absolute",
    inset: "0",
    display: "none",
    pointerEvents: "none",
    zIndex: "20"
  });

  const outline = document.createElement("div");

  Object.assign(outline.style, {
    position: "absolute",
    border: "2px dashed #00aaff",
    boxSizing: "border-box",
    pointerEvents: "auto",
    cursor: "move",
    touchAction: "none"
  });

  editor.appendChild(outline);

  const handles = {};

  ["nw", "ne", "sw", "se"].forEach(name => {
    const handle = document.createElement("div");

    Object.assign(handle.style, {
      position: "absolute",
      width: "12px",
      height: "12px",
      background: "#00aaff",
      border: "2px solid white",
      borderRadius: "50%",
      boxSizing: "border-box",
      pointerEvents: "auto",
      touchAction: "none",
      cursor: name + "-resize"
    });

    outline.appendChild(handle);
    handles[name] = handle;
  });

  Object.assign(handles.nw.style, { left: "-7px", top: "-7px" });
  Object.assign(handles.ne.style, { right: "-7px", top: "-7px" });
  Object.assign(handles.sw.style, { left: "-7px", bottom: "-7px" });
  Object.assign(handles.se.style, { right: "-7px", bottom: "-7px" });

  energyLayer.appendChild(editor);

  let position = {
    x: 48,
    y: 22,
    width: 12,
    height: 10
  };

  function loadPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (
        saved &&
        ["x", "y", "width", "height"].every(
          key => Number.isFinite(saved[key])
        )
      ) {
        position = saved;
      }
    } catch (_) {}
  }

  function savePosition() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }

  function applyPosition() {
    screenImage.style.left = position.x + "%";
    screenImage.style.top = position.y + "%";
    screenImage.style.width = position.width + "%";
    screenImage.style.height = position.height + "%";

    energyDisplay.style.left = position.x + "%";
    energyDisplay.style.top = position.y + "%";
    energyDisplay.style.width = position.width + "%";
    energyDisplay.style.height = position.height + "%";

    outline.style.left = position.x + "%";
    outline.style.top = position.y + "%";
    outline.style.width = position.width + "%";
    outline.style.height = position.height + "%";
  }

  loadPosition();
  applyPosition();

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

    if (nextIndex < 0 || nextIndex >= ENERGY_STEPS.length) return;

    selectedIndex = nextIndex;
    confirmed = false;
    updateDisplay();
  }

  function open() {
    if (enabled) return;

    enabled = true;
    confirmed = false;

    energyLayer.style.display = "block";
    energyDisplay.style.display = "flex";

    updateDisplay();
  }

  function close() {
    enabled = false;
    pointerActive = false;
    activePointerId = null;
    accumulatedAngle = 0;

    energyLayer.style.display = "none";
    energyDisplay.style.display = "none";
    editing = false;
    editor.style.display = "none";
  }

  function pointerDown(event) {
    if (!enabled || pointerActive || confirmed || editing) return;
    if (event.button !== undefined && event.button !== 0) return;

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
    ) return;

    const distance = Math.hypot(
      event.clientX - startX,
      event.clientY - startY
    );

    if (distance >= movementThreshold) pointerMoved = true;
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
    if (!pointerActive || event.pointerId !== activePointerId) return;

    pointerActive = false;
    activePointerId = null;
    accumulatedAngle = 0;

    if (enabled && !pointerMoved) confirm();
  }

  function pointerCancel(event) {
    if (event.pointerId !== activePointerId) return;

    pointerActive = false;
    activePointerId = null;
    accumulatedAngle = 0;
  }

  function confirm() {
    if (!enabled || pointerActive || confirmed) return;

    confirmed = true;
    const value = getCurrentValue();

    onConfirm(value, selectedIndex);
    return value;
  }

  function setValue(value) {
    const index = ENERGY_STEPS.indexOf(value);
    if (index === -1) return;

    selectedIndex = index;
    confirmed = false;
    updateDisplay();
  }

  function setDisplayPosition({ x, y, width, height }) {
    position = { x, y, width, height };
    applyPosition();
    savePosition();
  }

  function setEditing(value) {
    editing = Boolean(value);
    editor.style.display = editing ? "block" : "none";
    energyLayer.style.pointerEvents = editing ? "auto" : "none";
    screenImage.style.pointerEvents = editing ? "none" : "none";
  }

  function beginEdit(event, type, handle = null) {
    if (!editing) return;

    event.preventDefault();
    event.stopPropagation();

    dragging = type === "move";
    resizing = type === "resize";
    activeHandle = handle;

    dragStart = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      ...position
    };

    outline.setPointerCapture(event.pointerId);
  }

  outline.addEventListener("pointerdown", event => {
    if (event.target !== outline) return;
    beginEdit(event, "move");
  });

  Object.entries(handles).forEach(([name, handle]) => {
    handle.addEventListener("pointerdown", event => {
      beginEdit(event, "resize", name);
    });
  });

  outline.addEventListener("pointermove", event => {
    if (!editing || (!dragging && !resizing) || !dragStart) return;

    const rect = deviceWrap.getBoundingClientRect();
    const dx = (event.clientX - dragStart.pointerX) / rect.width * 100;
    const dy = (event.clientY - dragStart.pointerY) / rect.height * 100;

    if (dragging) {
      position.x = dragStart.x + dx;
      position.y = dragStart.y + dy;
    }

    if (resizing) {
      const right = dragStart.x + dragStart.width;
      const bottom = dragStart.y + dragStart.height;

      if (activeHandle.includes("e")) {
        position.width = Math.max(1, dragStart.width + dx);
      }
      if (activeHandle.includes("s")) {
        position.height = Math.max(1, dragStart.height + dy);
      }
      if (activeHandle.includes("w")) {
        position.x = dragStart.x + dx;
        position.width = Math.max(1, right - position.x);
      }
      if (activeHandle.includes("n")) {
        position.y = dragStart.y + dy;
        position.height = Math.max(1, bottom - position.y);
      }
    }

    applyPosition();
  });

  function endEdit() {
    if (!dragging && !resizing) return;

    dragging = false;
    resizing = false;
    activeHandle = null;
    dragStart = null;

    savePosition();
  }

  outline.addEventListener("pointerup", endEdit);
  outline.addEventListener("pointercancel", endEdit);

  function destroy() {
    close();

    knob.removeEventListener("pointerdown", pointerDown);
    knob.removeEventListener("pointermove", pointerMove);
    knob.removeEventListener("pointerup", pointerUp);
    knob.removeEventListener("pointercancel", pointerCancel);

    energyLayer.remove();
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
    setEditing,
    getPosition: () => ({ ...position }),
    destroy
  };
}
