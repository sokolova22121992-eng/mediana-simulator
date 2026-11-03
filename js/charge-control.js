/**
 * MEDIANA D500 Simulator
 * Керування візуальними елементами заряджання.
 *
 * Елементи:
 * 1. Індикатор процесу заряджання.
 * 2. Основні цифри енергії.
 * 3. Малий індикатор підтвердженої енергії.
 *
 * Координати та розміри зберігаються автоматично.
 */

import {
  getState,
  subscribe,
  setCharging,
  setCharged,
  setMessage
} from "./device-state.js";


const STORAGE_KEY = "mediana-charge-elements";

const DEFAULT_POSITIONS = {
  progress: {
    x: 45,
    y: 35,
    width: 20,
    height: 3
  },

  mainEnergy: {
    x: 45,
    y: 40,
    width: 20,
    height: 8
  },

  smallEnergy: {
    x: 70,
    y: 20,
    width: 8,
    height: 4
  }
};


export function createChargeControl({
  deviceWrap,
  coordinatePanel = document.getElementById("coordText"),
  selectedName = document.getElementById("selectedName"),
  duration = 5000,
  onProgress = () => {},
  onComplete = () => {},
  onCancel = () => {}
} = {}) {

  if (!deviceWrap) {
    throw new Error("Не знайдено область пристрою deviceWrap.");
  }

  let timer = null;
  let startTime = null;
  let targetEnergy = null;
  let currentElement = null;
  let editing = false;

  const savedPositions = loadPositions();

  const elements = {};
  const buttons = {};

  const unsubscribe = subscribe(state => {
    updateConfirmedEnergy(state.energy);

    if (
      isCharging() &&
      (!state.power || state.mode !== "manual")
    ) {
      cancel("Заряджання скасовано");
    }
  });


  function loadPositions() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      return {
        progress: {
          ...DEFAULT_POSITIONS.progress,
          ...(saved?.progress || {})
        },

        mainEnergy: {
          ...DEFAULT_POSITIONS.mainEnergy,
          ...(saved?.mainEnergy || {})
        },

        smallEnergy: {
          ...DEFAULT_POSITIONS.smallEnergy,
          ...(saved?.smallEnergy || {})
        }
      };
    } catch {
      return structuredClone(DEFAULT_POSITIONS);
    }
  }


  function savePositions() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(savedPositions)
    );
  }


  function createElement(id, className) {
    const element = document.createElement("div");

    element.className = className;
    element.dataset.chargeElement = id;

    Object.assign(element.style, {
      position: "absolute",
      boxSizing: "border-box",
      left: savedPositions[id].x + "%",
      top: savedPositions[id].y + "%",
      width: savedPositions[id].width + "%",
      height: savedPositions[id].height + "%",
      display: "none",
      zIndex: "15"
    });

    deviceWrap.appendChild(element);

    elements[id] = element;

    return element;
  }


  function createProgressElement() {
    const outer = createElement(
      "progress",
      "charge-progress"
    );

    Object.assign(outer.style, {
      border: "1px solid rgba(255,255,255,.8)",
      background: "rgba(0,0,0,.45)",
      overflow: "hidden",
      borderRadius: "2px",
      cursor: "default"
    });

    const fill = document.createElement("div");

    Object.assign(fill.style, {
      width: "0%",
      height: "100%",
      background: "#00a8ff",
      transition: "width 50ms linear"
    });

    outer.appendChild(fill);

    outer._fill = fill;

    return outer;
  }


  function createEnergyElement(id, className) {
    const element = createElement(id, className);

    Object.assign(element.style, {
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontWeight: "bold",
      textAlign: "center",
      alignItems: "center",
      justifyContent: "center",
      whiteSpace: "nowrap",
      textShadow: "0 1px 3px #000",
      overflow: "hidden"
    });

    element.style.display = "none";

    return element;
  }


  function createEditorButton(id, label) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.className = "tool-button";

    button.addEventListener("click", () => {
      setEditing(currentElement !== id, id);
    });

    buttons[id] = button;

    return button;
  }


  function createEditorControls() {
    const panel = document.createElement("div");

    panel.className = "charge-editor-controls";

    Object.assign(panel.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      marginTop: "8px"
    });

    panel.append(
      createEditorButton(
        "progress",
        "Редагувати індикатор заряджання"
      ),
      createEditorButton(
        "mainEnergy",
        "Редагувати основні цифри J"
      ),
      createEditorButton(
        "smallEnergy",
        "Редагувати малий індикатор J"
      )
    );

    deviceWrap.parentElement.appendChild(panel);
  }


  function applyPosition(id) {
    const element = elements[id];
    const position = savedPositions[id];

    element.style.left = position.x + "%";
    element.style.top = position.y + "%";
    element.style.width = position.width + "%";
    element.style.height = position.height + "%";
  }


  function updateCoordinatePanel(id) {
    if (!coordinatePanel) {
      return;
    }

    const position = savedPositions[id];

    if (selectedName) {
      selectedName.textContent = {
        progress: "Індикатор заряджання",
        mainEnergy: "Основні цифри J",
        smallEnergy: "Малий індикатор підтвердженої енергії"
      }[id];
    }

    coordinatePanel.textContent =
      `X: ${position.x.toFixed(4)}% | ` +
      `Y: ${position.y.toFixed(4)}% | ` +
      `W: ${position.width.toFixed(4)}% | ` +
      `H: ${position.height.toFixed(4)}%`;
  }


  function setEditing(enabled, id = currentElement) {
    editing = enabled;

    if (enabled && !elements[id]) {
      return;
    }

    currentElement = enabled ? id : null;

    Object.entries(elements).forEach(([key, element]) => {
      element.style.outline =
        enabled && key === id
          ? "2px dashed #00a8ff"
          : "none";

      element.style.cursor =
        enabled && key === id
          ? "move"
          : "default";
    });

    Object.entries(buttons).forEach(([key, button]) => {
      button.style.background =
        enabled && key === id
          ? "#1677d2"
          : "";
    });

    if (enabled) {
      updateCoordinatePanel(id);
    }
  }


  function makeDraggable(id) {
    const element = elements[id];

    let startX = 0;
    let startY = 0;
    let originalX = 0;
    let originalY = 0;
    let originalWidth = 0;
    let originalHeight = 0;
    let resizing = false;

    const handle = document.createElement("div");

    Object.assign(handle.style, {
      position: "absolute",
      width: "12px",
      height: "12px",
      right: "0",
      bottom: "0",
      background: "#00a8ff",
      border: "1px solid white",
      cursor: "nwse-resize",
      display: "none",
      zIndex: "20"
    });

    element.appendChild(handle);

    function begin(event, resize) {
      if (!editing || currentElement !== id) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      resizing = resize;

      const rect = deviceWrap.getBoundingClientRect();
      const position = savedPositions[id];

      startX = event.clientX;
      startY = event.clientY;

      originalX = position.x;
      originalY = position.y;
      originalWidth = position.width;
      originalHeight = position.height;

      element.setPointerCapture?.(event.pointerId);
    }

    element.addEventListener("pointerdown", event => {
      if (event.target === handle) {
        return;
      }

      begin(event, false);
    });

    handle.addEventListener("pointerdown", event => {
      begin(event, true);
    });

    element.addEventListener("pointermove", event => {
      if (!element.hasPointerCapture?.(event.pointerId)) {
        return;
      }

      const rect = deviceWrap.getBoundingClientRect();

      const dx =
        (event.clientX - startX) / rect.width * 100;

      const dy =
        (event.clientY - startY) / rect.height * 100;

      const position = savedPositions[id];

      if (resizing) {
        position.width = Math.max(
          1,
          originalWidth + dx
        );

        position.height = Math.max(
          1,
          originalHeight + dy
        );
      } else {
        position.x = Math.max(
          0,
          Math.min(100 - position.width, originalX + dx)
        );

        position.y = Math.max(
          0,
          Math.min(100 - position.height, originalY + dy)
        );
      }

      applyPosition(id);
      updateCoordinatePanel(id);
      savePositions();
    });

    element.addEventListener("pointerup", () => {
      if (editing && currentElement === id) {
        savePositions();
      }
    });

    element._editorHandle = handle;
  }


  function updateConfirmedEnergy(value) {
    if (!elements.smallEnergy) {
      return;
    }

    elements.smallEnergy.textContent =
      Number.isFinite(value) && value > 0
        ? `${value} J`
        : "";
  }


  function updateProgress(data) {
    elements.progress._fill.style.width =
      `${data.progress * 100}%`;

    elements.mainEnergy.textContent =
      `${data.energy} J`;

    onProgress(data);
  }


  function isCharging() {
    return timer !== null;
  }


  function start() {
    const state = getState();

    if (!state.power) {
      throw new Error("Спочатку увімкніть пристрій.");
    }

    if (state.mode !== "manual") {
      throw new Error("Заряджання доступне лише в ручному режимі.");
    }

    if (!Number.isFinite(state.energy) || state.energy <= 0) {
      throw new Error("Спочатку виберіть і підтвердьте енергію.");
    }

    if (isCharging()) {
      return false;
    }

    targetEnergy = state.energy;
    startTime = Date.now();

    elements.progress.style.display = "block";
    elements.mainEnergy.style.display = "flex";

    elements.progress._fill.style.width = "0%";
    elements.mainEnergy.textContent = "0 J";

    setCharging(true);
    setMessage("Виконується заряджання...");

    updateProgress({
      progress: 0,
      energy: 0,
      targetEnergy,
      elapsed: 0,
      duration
    });

    timer = setInterval(() => {
      const elapsed = Date.now() - startTime;

      const progress = Math.min(
        elapsed / duration,
        1
      );

      const energy = Math.round(
        targetEnergy * progress
      );

      updateProgress({
        progress,
        energy,
        targetEnergy,
        elapsed,
        duration
      });

      if (progress >= 1) {
        finish();
      }
    }, 50);

    return true;
  }


  function finish() {
    if (!isCharging()) {
      return;
    }

    clearInterval(timer);
    timer = null;

    setCharged(true);
    setMessage("Заряджання завершено");

    elements.mainEnergy.textContent =
      `${targetEnergy} J`;

    elements.progress._fill.style.width = "100%";

    onComplete({
      energy: targetEnergy
    });
  }


  function cancel(reason = "Заряджання скасовано") {
    if (!isCharging()) {
      return false;
    }

    clearInterval(timer);
    timer = null;

    const state = getState();

    setCharging(false);
    setCharged(false);

    if (state.power) {
      setMessage(reason);
    }

    elements.progress._fill.style.width = "0%";
    elements.mainEnergy.textContent = "0 J";

    onCancel({
      reason,
      energy: targetEnergy
    });

    targetEnergy = null;
    startTime = null;

    return true;
  }


  elements.progress = createProgressElement();

  elements.mainEnergy = createEnergyElement(
    "mainEnergy",
    "charge-main-energy"
  );

  elements.smallEnergy = createEnergyElement(
    "smallEnergy",
    "charge-small-energy"
  );

  elements.mainEnergy.style.fontSize = "min(5vw, 32px)";
  elements.smallEnergy.style.fontSize = "min(2vw, 14px)";

  Object.keys(elements).forEach(id => {
    applyPosition(id);
    makeDraggable(id);
  });

  createEditorControls();

  updateConfirmedEnergy(getState().energy);

  Object.values(elements).forEach(element => {
    element.style.display = "none";
  });

  function show() {
    elements.progress.style.display = "block";
    elements.mainEnergy.style.display = "flex";
    elements.smallEnergy.style.display = "flex";
  }

  function hide() {
    if (isCharging()) {
      cancel();
    }

    Object.values(elements).forEach(element => {
      element.style.display = "none";
    });
  }


  function destroy() {
    cancel();
    unsubscribe();

    Object.values(elements).forEach(element => {
      element.remove();
    });

    Object.values(buttons).forEach(button => {
      button.remove();
    });
  }


  return {
    start,
    cancel,
    show,
    hide,
    isCharging,
    setEditing,
    destroy,
    getPositions() {
      return structuredClone(savedPositions);
    }
  };
}
