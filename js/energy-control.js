
/**
 * MEDIANA D500
 * ENERGY CONTROL MODULE
 *
 * Екран енергії та напис джоулів мають незалежні координати.
 * Обидва елементи можна переміщувати та змінювати їхній розмір.
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
  onConfirm = () => {},
  onPositionChange = () => {},
  onValuePositionChange = () => {}
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

  const SCREEN_STORAGE_KEY = "mediana-energy-position";
  const VALUE_STORAGE_KEY = "mediana-energy-value-position";

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
    background: "transparent",
    color: "#ffd34e",
    fontFamily: "Arial, sans-serif",
    fontWeight: "bold",
    whiteSpace: "nowrap",
    zIndex: "5",
    pointerEvents: "none",
    userSelect: "none"
  });

  deviceWrap.appendChild(energyDisplay);

  let screenPosition = {
    x: 48,
    y: 22,
    width: 12,
    height: 10
  };

  let valuePosition = {
    x: 48,
    y: 22,
    width: 12,
    height: 10
  };

  function loadPosition(key, current) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));

      if (
        saved &&
        ["x", "y", "width", "height"].every(
          name => Number.isFinite(saved[name])
        )
      ) {
        return { ...saved };
      }
    } catch (_) {}

    return { ...current };
  }

  function savePosition(key, position) {
    try {
      localStorage.setItem(key, JSON.stringify(position));
    } catch (error) {
      console.error("Не вдалося зберегти координати:", error);
    }
  }

  screenPosition = loadPosition(SCREEN_STORAGE_KEY, screenPosition);
  valuePosition = loadPosition(VALUE_STORAGE_KEY, valuePosition);

  function createPositionEditor({
    id,
    position,
    storageKey,
    callback,
    zIndex
  }) {
    const editor = document.createElement("div");
    editor.id = id;

    Object.assign(editor.style, {
      position: "absolute",
      inset: "0",
      display: "none",
      pointerEvents: "none",
      zIndex: String(zIndex)
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

    deviceWrap.appendChild(editor);

    let editing = false;
    let dragging = false;
    let resizing = false;
    let activeHandle = null;
    let dragStart = null;

    function applyPosition() {
      outline.style.left = position.x + "%";
      outline.style.top = position.y + "%";
      outline.style.width = position.width + "%";
      outline.style.height = position.height + "%";

      callback({ ...position });
    }

    function setEditing(value) {
      editing = Boolean(value);
      editor.style.display = editing ? "block" : "none";
      editor.style.pointerEvents = editing ? "auto" : "none";
      applyPosition();
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

      const dx =
        (event.clientX - dragStart.pointerX) / rect.width * 100;

      const dy =
        (event.clientY - dragStart.pointerY) / rect.height * 100;

      if (dragging) {
        position.x = Math.max(
          0,
          Math.min(100 - position.width, dragStart.x + dx)
        );

        position.y = Math.max(
          0,
          Math.min(100 - position.height, dragStart.y + dy)
        );
      }

      if (resizing) {
        const right = dragStart.x + dragStart.width;
        const bottom = dragStart.y + dragStart.height;

        if (activeHandle.includes("e")) {
          position.width = Math.max(
            1,
            Math.min(100 - position.x, dragStart.width + dx)
          );
        }

        if (activeHandle.includes("s")) {
          position.height = Math.max(
            1,
            Math.min(100 - position.y, dragStart.height + dy)
          );
        }

        if (activeHandle.includes("w")) {
          const newX = Math.max(0, dragStart.x + dx);
          position.width = Math.max(1, right - newX);
          position.x = newX;
        }

        if (activeHandle.includes("n")) {
          const newY = Math.max(0, dragStart.y + dy);
          position.height = Math.max(1, bottom - newY);
          position.y = newY;
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

      savePosition(storageKey, position);
    }

    outline.addEventListener("pointerup", endEdit);
    outline.addEventListener("pointercancel", endEdit);

    applyPosition();

    return {
      setEditing,
      getPosition: () => ({ ...position }),
      applyPosition
    };
  }

  const screenEditor = createPositionEditor({
    id: "energyScreenEditor",
    position: screenPosition,
    storageKey: SCREEN_STORAGE_KEY,
    callback: onPositionChange,
    zIndex: 20
  });

  const valueEditor = createPositionEditor({
    id: "energyValueEditor",
    position: valuePosition,
    storageKey: VALUE_STORAGE_KEY,
    callback: onValuePositionChange,
    zIndex: 21
  });

  function applyScreenPosition() {
    screenImage.style.left = screenPosition.x + "%";
    screenImage.style.top = screenPosition.y + "%";
    screenImage.style.width = screenPosition.width + "%";
    screenImage.style.height = screenPosition.height + "%";

    screenEditor.applyPosition();
  }

  function applyValuePosition() {
    energyDisplay.style.left = valuePosition.x + "%";
    energyDisplay.style.top = valuePosition.y + "%";
    energyDisplay.style.width = valuePosition.width + "%";
    energyDisplay.style.height = valuePosition.height + "%";

    valueEditor.applyPosition();
  }

  applyScreenPosition();
  applyValuePosition();

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

    screenEditor.setEditing(false);
    valueEditor.setEditing(false);
  }

  function pointerDown(event) {
    if (!enabled || pointerActive || confirmed) return;
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
    screenPosition = { x, y, width, height };
    applyScreenPosition();
    savePosition(SCREEN_STORAGE_KEY, screenPosition);
  }

  function setValuePosition({ x, y, width, height }) {
    valuePosition = { x, y, width, height };
    applyValuePosition();
    savePosition(VALUE_STORAGE_KEY, valuePosition);
  }

  function setEditing(value) {
    screenEditor.setEditing(value);
    energyLayer.style.pointerEvents = value ? "auto" : "none";
  }

  function setValueEditing(value) {
    valueEditor.setEditing(value);
  }

  function destroy() {
    close();

    knob.removeEventListener("pointerdown", pointerDown);
    knob.removeEventListener("pointermove", pointerMove);
    knob.removeEventListener("pointerup", pointerUp);
    knob.removeEventListener("pointercancel", pointerCancel);

    energyLayer.remove();
    energyDisplay.remove();

    document.getElementById("energyScreenEditor")?.remove();
    document.getElementById("energyValueEditor")?.remove();
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
    setValuePosition,
    setEditing,
    setValueEditing,
    getPosition: () => ({ ...screenPosition }),
    getValuePosition: () => ({ ...valuePosition }),
    destroy
  };
}
