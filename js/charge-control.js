/**
 * MEDIANA D500 Simulator
 * Модуль екрана та процесу заряджання.
 *
 * 4 незалежні елементи:
 * 1. Фото mediana-charge.png
 * 2. Індикатор процесу заряджання
 * 3. Основні цифри J
 * 4. Малий індикатор підтвердженої енергії J
 *
 * Координати та розміри зберігаються в localStorage.
 */

import {
  getState,
  subscribe,
  setCharging,
  setCharged,
  setMessage
} from "./device-state.js";


const STORAGE_KEY = "mediana-charge-layout-v1";

const DEFAULT_POSITIONS = {
  screen: {
    x: 48,
    y: 22,
    width: 12,
    height: 10
  },

  progress: {
    x: 49,
    y: 30,
    width: 10,
    height: 2
  },

  mainEnergy: {
    x: 49,
    y: 32,
    width: 10,
    height: 5
  },

  smallEnergy: {
    x: 55,
    y: 23,
    width: 4,
    height: 2
  }
};


const ELEMENT_NAMES = {
  screen: "Екран mediana-charge",
  progress: "Індикатор заряджання",
  mainEnergy: "Основні цифри J",
  smallEnergy: "Малий індикатор підтвердженої енергії J"
};


export function createChargeControl({
  deviceWrap,
  coordinatePanel = document.getElementById("coordText"),
  selectedName = document.getElementById("selectedName"),
  duration = 5000,
  image = "mediana-charge.png",
  onProgress = () => {},
  onComplete = () => {},
  onCancel = () => {}
} = {}) {

  if (!deviceWrap) {
    throw new Error("Не знайдено область deviceWrap.");
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Некоректна тривалість заряджання.");
  }

  let timer = null;
  let startTime = null;
  let targetEnergy = null;
  let editingElement = null;

  const positions = loadPositions();
  const elements = {};
  const buttons = {};

  // --------------------------------------------------
  // ЗАВАНТАЖЕННЯ ТА ЗБЕРЕЖЕННЯ КООРДИНАТ
  // --------------------------------------------------

  function loadPositions() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      const result = {};

      Object.keys(DEFAULT_POSITIONS).forEach(id => {
        result[id] = {
          ...DEFAULT_POSITIONS[id],
          ...(saved?.[id] || {})
        };
      });

      return result;

    } catch {
      return JSON.parse(
        JSON.stringify(DEFAULT_POSITIONS)
      );
    }
  }


  function savePositions() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(positions)
    );
  }


  // --------------------------------------------------
  // СТВОРЕННЯ ЕЛЕМЕНТІВ
  // --------------------------------------------------

  function createBaseElement(id, className) {
    const element = document.createElement("div");

    element.className = className;
    element.dataset.chargeElement = id;

    Object.assign(element.style, {
      position: "absolute",
      boxSizing: "border-box",
      left: positions[id].x + "%",
      top: positions[id].y + "%",
      width: positions[id].width + "%",
      height: positions[id].height + "%",
      display: "none",
      zIndex: "15"
    });

    deviceWrap.appendChild(element);
    elements[id] = element;

    return element;
  }


  function createScreen() {
    const screen = createBaseElement(
      "screen",
      "charge-screen-image"
    );

    const img = document.createElement("img");

    img.src = image;
    img.alt = "Екран заряджання MEDIANA";
    img.draggable = false;

    Object.assign(img.style, {
      width: "100%",
      height: "100%",
      objectFit: "fill",
      display: "block",
      pointerEvents: "none",
      userSelect: "none"
    });

    screen.appendChild(img);

    return screen;
  }


  function createProgress() {
    const outer = createBaseElement(
      "progress",
      "charge-progress"
    );

    Object.assign(outer.style, {
      overflow: "hidden",
      background: "rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.8)"
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


  function createEnergyText(id, className) {
    const element = createBaseElement(id, className);

    Object.assign(element.style, {
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontWeight: "bold",
      textAlign: "center",
      whiteSpace: "nowrap",
      textShadow: "0 1px 3px #000000",
      overflow: "hidden",
      userSelect: "none"
    });

    return element;
  }


  // --------------------------------------------------
  // КООРДИНАТИ
  // --------------------------------------------------

  function applyPosition(id) {
    const element = elements[id];
    const p = positions[id];

    element.style.left = p.x + "%";
    element.style.top = p.y + "%";
    element.style.width = p.width + "%";
    element.style.height = p.height + "%";
  }


  function updateCoordinatePanel(id) {
    if (!coordinatePanel) return;

    const p = positions[id];

    if (selectedName) {
      selectedName.textContent = ELEMENT_NAMES[id];
    }

    coordinatePanel.textContent =
      `X: ${p.x.toFixed(4)}% | ` +
      `Y: ${p.y.toFixed(4)}% | ` +
      `W: ${p.width.toFixed(4)}% | ` +
      `H: ${p.height.toFixed(4)}%`;
  }


  // --------------------------------------------------
  // РЕДАГУВАННЯ ТА ПЕРЕМІЩЕННЯ
  // --------------------------------------------------

  function makeEditable(id) {
    const element = elements[id];

    const handle = document.createElement("div");

    Object.assign(handle.style, {
      position: "absolute",
      right: "-5px",
      bottom: "-5px",
      width: "12px",
      height: "12px",
      background: "#00a8ff",
      border: "1px solid white",
      boxSizing: "border-box",
      cursor: "nwse-resize",
      display: "none",
      zIndex: "30"
    });

    element.appendChild(handle);

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let original = null;
    let resizing = false;


    function pointerDown(event, resize) {
      if (editingElement !== id) return;

      event.preventDefault();
      event.stopPropagation();

      pointerId = event.pointerId;
      resizing = resize;

      startX = event.clientX;
      startY = event.clientY;

      original = { ...positions[id] };

      handle.setPointerCapture?.(event.pointerId);
    }


    function pointerMove(event) {
      if (pointerId !== event.pointerId || !original) {
        return;
      }

      const rect = deviceWrap.getBoundingClientRect();

      const dx =
        (event.clientX - startX) / rect.width * 100;

      const dy =
        (event.clientY - startY) / rect.height * 100;

      const p = positions[id];

      if (resizing) {
        p.width = Math.max(
          0.5,
          Math.min(100 - p.x, original.width + dx)
        );

        p.height = Math.max(
          0.5,
          Math.min(100 - p.y, original.height + dy)
        );

      } else {
        p.x = Math.max(
          0,
          Math.min(100 - p.width, original.x + dx)
        );

        p.y = Math.max(
          0,
          Math.min(100 - p.height, original.y + dy)
        );
      }

      applyPosition(id);
      updateCoordinatePanel(id);
      savePositions();
    }


    function pointerUp(event) {
      if (pointerId !== event.pointerId) return;

      pointerId = null;
      original = null;

      savePositions();
    }


    element.addEventListener("pointerdown", event => {
      if (event.target === handle) return;
      pointerDown(event, false);
    });

    handle.addEventListener("pointerdown", event => {
      pointerDown(event, true);
    });

    element.addEventListener("pointermove", pointerMove);
    element.addEventListener("pointerup", pointerUp);
    element.addEventListener("pointercancel", pointerUp);

    element._editorHandle = handle;
  }


  function setEditing(id = null) {
    editingElement = id;

    Object.keys(elements).forEach(key => {
      const element = elements[key];
      const active = key === id;

      element.style.outline = active
        ? "2px dashed #00a8ff"
        : "none";

      element.style.cursor = active
        ? "move"
        : "default";

      element._editorHandle.style.display =
        active ? "block" : "none";

      if (buttons[key]) {
        buttons[key].style.background =
          active ? "#1677d2" : "";
      }
    });

    if (id) {
      elements[id].style.display = "block";
      updateCoordinatePanel(id);
    }

    return id;
  }


  // --------------------------------------------------
  // КНОПКИ РЕДАГУВАННЯ
  // --------------------------------------------------

  const editorPanel = document.createElement("div");

  editorPanel.className = "charge-editor-controls";

  Object.assign(editorPanel.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "8px"
  });


  function createEditorButton(id) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "tool-button";
    button.textContent = "Редагувати: " + ELEMENT_NAMES[id];

    button.addEventListener("click", () => {
      const nextId = editingElement === id ? null : id;

      setEditing(nextId);

      if (nextId) {
        showScreen();
      }
    });

    buttons[id] = button;
    editorPanel.appendChild(button);
  }


  // --------------------------------------------------
  // ВІДОБРАЖЕННЯ ПІДТВЕРДЖЕНОЇ ЕНЕРГІЇ
  // --------------------------------------------------

  function updateConfirmedEnergy(value) {
    if (!elements.smallEnergy) return;

    elements.smallEnergy.textContent =
      Number.isFinite(value) && value > 0
        ? `${value} J`
        : "";
  }


  // --------------------------------------------------
  // ПРОГРЕС ЗАРЯДЖАННЯ
  // --------------------------------------------------

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


  function showScreen() {
    elements.screen.style.display = "block";
    elements.smallEnergy.style.display = "flex";
  }


  function hideScreen() {
    if (isCharging()) {
      cancel();
    }

    Object.values(elements).forEach(element => {
      element.style.display = "none";
    });

    setEditing(null);
  }


  // --------------------------------------------------
  // ЗАПУСК ЗАРЯДЖАННЯ
  // --------------------------------------------------

  function start() {
    const state = getState();

    if (!state.power) {
      throw new Error("Спочатку увімкніть пристрій.");
    }

    if (state.mode !== "manual") {
      throw new Error(
        "Заряджання доступне лише в ручному режимі."
      );
    }

    if (!Number.isFinite(state.energy) || state.energy <= 0) {
      throw new Error(
        "Спочатку виберіть і підтвердьте енергію."
      );
    }

    if (isCharging()) {
      return false;
    }

    targetEnergy = state.energy;
    startTime = Date.now();

    showScreen();

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


  // --------------------------------------------------
  // ЗАВЕРШЕННЯ ЗАРЯДЖАННЯ
  // --------------------------------------------------

  function finish() {
    if (!isCharging()) return;

    clearInterval(timer);
    timer = null;

    setCharged(true);
    setMessage("Заряджання завершено");

    elements.progress._fill.style.width = "100%";
    elements.mainEnergy.textContent =
      `${targetEnergy} J`;

    onComplete({
      energy: targetEnergy
    });
  }


  // --------------------------------------------------
  // СКАСУВАННЯ ЗАРЯДЖАННЯ
  // --------------------------------------------------

  function cancel(reason = "Заряджання скасовано") {
    if (!isCharging()) return false;

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


  // --------------------------------------------------
  // СТВОРЕННЯ ВСІХ ЧОТИРЬОХ ЕЛЕМЕНТІВ
  // --------------------------------------------------

  createScreen();

  elements.progress = createProgress();

  elements.mainEnergy = createEnergyText(
    "mainEnergy",
    "charge-main-energy"
  );

  elements.smallEnergy = createEnergyText(
    "smallEnergy",
    "charge-small-energy"
  );

  elements.mainEnergy.style.fontSize = "min(5vw, 32px)";
  elements.smallEnergy.style.fontSize = "min(2vw, 14px)";

  Object.keys(elements).forEach(id => {
    applyPosition(id);
    makeEditable(id);
    createEditorButton(id);
  });

  deviceWrap.parentEleconst workspace = document.querySelector(".workspace");

if (!workspace) {
  throw new Error("Не знайдено праву робочу панель.");
}

workspace.appendChild(editorPanel);ment.appendChild(editorPanel);

  Object.values(elements).forEach(element => {
    element.style.display = "none";
  });

  updateConfirmedEnergy(getState().energy);


  // --------------------------------------------------
  // РЕАКЦІЯ НА ЗМІНИ СТАНУ ПРИСТРОЮ
  // --------------------------------------------------

  const unsubscribe = subscribe(state => {
    updateConfirmedEnergy(state.energy);

    if (
      isCharging() &&
      (!state.power || state.mode !== "manual")
    ) {
      cancel("Заряджання скасовано");
    }

    if (!state.power) {
      hideScreen();
    }
  });


  // --------------------------------------------------
  // ЗНИЩЕННЯ МОДУЛЯ
  // --------------------------------------------------

  function destroy() {
    cancel();
    unsubscribe();

    Object.values(elements).forEach(element => {
      element.remove();
    });

    editorPanel.remove();
  }


  return {
    start,
    cancel,
    show: showScreen,
    hide: hideScreen,
    isCharging,
    setEditing,
    getPositions() {
      return JSON.parse(JSON.stringify(positions));
    },
    destroy
  };
}
