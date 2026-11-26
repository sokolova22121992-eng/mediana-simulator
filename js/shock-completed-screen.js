/**
 * MEDIANA D500 Simulator
 * Екран після виконання розряду.
 *
 * Файл: js/shock-completed-screen.js
 * Фонове зображення: ./shock-completed-screen.png
 *
 * ВАЖЛИВО:
 * - show(energy) викликати ОДИН раз на кожен фактично виконаний розряд.
 * - energy — підтверджена енергія розряду в Дж.
 * - лічильник збільшується лише при show().
 * - hide() лише приховує екран; OFF скидає клінічні показники.
 * - координати/розміри зберігаються окремо від стану пристрою.
 */

import { subscribe } from "./device-state.js";

const STORAGE_KEY = "mediana-shock-completed-layout-v1";
const BACKGROUND_IMAGE = "./shock-completed-screen.png";

const DEFAULT_LAYOUT = {
  screen: {
    x: 48,
    y: 22,
    width: 12,
    height: 10
  },

  smallEnergy: {
    x: 45.5,
    y: 7.0,
    width: 7.0,
    height: 2.8
  },

  shockCount: {
    x: 38.0,
    y: 68.0,
    width: 8.0,
    height: 5.0
  },

  consumedEnergy: {
    x: 48.0,
    y: 76.0,
    width: 13.0,
    height: 6.0
  },
manualCounter: {
  x: 20,
  y: 19,
  width: 2,
  height: 2,
  fontSize: 24
},
energyCounter: {
  x: 20.8913,
  y: 22.4306,
  width: 3.2852,
  height: 3.3224
},

chargeCounter: {
  x: 20.5570,
  y: 21.5393,
  width: 0.6114,
  height: 3.6195
},
  medianaChargeCounter: {
  x: 20.4456,
  y: 21.3908,
  width: 0.7228,
  height: 3.3224
},
completedCounter: {
  x: 21.4483,
  y: 23.1733,
  width: 2.9510,
  height: 3.0253
}
};

const LABELS = {
  screen: "Фоновий екран — після розряду",
  smallEnergy: "Малі джоулі біля DEFIB",
  shockCount: "Лічильник розрядів",
  consumedEnergy: "Витрачена енергія — великі Дж",
   manualCounter: "Лічильник розрядів — ручний режим",
  completedCounter: "Лічильник розрядів — екран ШОК ВИКОНАНО",
  energyCounter: "Лічильник розрядів — вибір енергії",
  chargeCounter: "Лічильник розрядів — заряджання",
medianaChargeCounter: "Лічильник розрядів — MEDIANA CHARGE"
};

const EDITABLE_IDS = Object.keys(LABELS);
const COUNTER_IDS = [
  "manualCounter",
  "energyCounter",
  "chargeCounter",
  "medianaChargeCounter",
  "completedCounter"
];
function cloneLayout(layout) {
  return Object.fromEntries(
    Object.entries(layout).map(([key, value]) => [
      key,
      { ...value }
    ])
  );
}

export function createShockCompletedScreen({
  deviceWrap,
  coordinatePanel = null,
  selectedName = null,
  workspace = document.querySelector(".workspace"),
  image = BACKGROUND_IMAGE,
  onReturn = null
} = {}) {
  if (!deviceWrap) {
    throw new Error(
      "createShockCompletedScreen: не передано deviceWrap."
    );
  }

  if (
    deviceWrap.dataset.shockCompletedScreen === "initialized"
  ) {
    throw new Error(
      "Екран після розряду вже ініціалізований для цього deviceWrap."
    );
  }

  deviceWrap.dataset.shockCompletedScreen = "initialized";

  let layout = loadLayout();
  let editorEnabled = false;
  let editingId = null;
  let visible = false;
  let shockCount = 0;
  let selectedEnergy = null;
  let manualMode = false;
let counterScreen = "manualCounter";
let medianaChargeActive = false;
let completionTimeout = null;

  const elements = {};
  const handles = {};
  const editorButtons = {};
  const cleanup = [];
 function syncCounterVisibility() {
  for (const id of COUNTER_IDS) {
    const element = elements[id];
    if (!element) continue;

    const isActiveCounter = visible
      ? id === "completedCounter"
      : id === "medianaChargeCounter"
        ? medianaChargeActive
        : shockCount > 0 &&
          (
            id === "manualCounter"
              ? manualMode && counterScreen === "manualCounter"
              : id === counterScreen
          );

    const isBeingEdited =
      editorEnabled && editingId === id;

    element.style.display =
      isActiveCounter || isBeingEdited
        ? "flex"
        : "none";
  }
}

  function loadLayout() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      const result = {};

      for (const id of EDITABLE_IDS) {
        const candidate = saved?.[id] || {};

        result[id] = {
          ...DEFAULT_LAYOUT[id]
        };

        for (const key of [
          "x",
          "y",
          "width",
          "height"
        ]) {
          const value = Number(candidate[key]);

          if (Number.isFinite(value)) {
            result[id][key] = value;
          }
        }

        result[id].x = clamp(result[id].x, 0, 100);
        result[id].y = clamp(result[id].y, 0, 100);

        result[id].width = clamp(
          result[id].width,
          0.5,
          100 - result[id].x
        );

        result[id].height = clamp(
          result[id].height,
          0.5,
          100 - result[id].y
        );
      }

      return result;

    } catch {
      return cloneLayout(DEFAULT_LAYOUT);
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function saveLayout() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(layout)
      );

    } catch (error) {
      console.error(
        "Не вдалося зберегти координати екрана після розряду:",
        error
      );
    }
  }

  function applyPosition(id) {
    const element = elements[id];
    const p = layout[id];

    if (!element || !p) return;

    element.style.left = p.x + "%";
    element.style.top = p.y + "%";
    element.style.width = p.width + "%";
    element.style.height = p.height + "%";

  if (id !== "screen") {
  const rect = deviceWrap.getBoundingClientRect();

  let fontSize;

   if (id === "manualCounter") {
    // Розмір цифри залежить від розміру рамки
    fontSize = Math.max(
      4,
      Math.min(
        rect.height * p.height / 100 * 0.75,
        rect.width * p.width / 100 * 1.5
      )
    );
  } else {
    fontSize = Math.max(
      4,
      Math.min(
        (rect.height * p.height / 100) * 0.78,
        (rect.width * p.width / 100) / 4.5
      )
    );
  }

  element.style.setProperty(
  "font-size",
  fontSize + "px",
  "important"
);

if (id === "manualCounter" && element._value) {
  element._value.style.setProperty(
    "font-size",
    fontSize + "px",
    "important"
  );

  element._value.style.setProperty(
    "color",
    "#FFFFFF",
    "important"
  );

  element._value.style.setProperty(
    "visibility",
    "visible",
    "important"
  );

  element._value.style.setProperty(
    "opacity",
    "1",
    "important"
  );
}
}

    updateHandle(id);
  }

  function updateCoordinates(id) {
    const p = layout[id];

    if (!p) return;

    if (selectedName) {
      selectedName.textContent = LABELS[id];
    }

    if (coordinatePanel) {
      coordinatePanel.textContent =
        `X: ${p.x.toFixed(4)}% · ` +
        `Y: ${p.y.toFixed(4)}% · ` +
        `W: ${p.width.toFixed(4)}% · ` +
        `H: ${p.height.toFixed(4)}%`;
    }
  }

  function createBaseElement(id) {
    const element = document.createElement("div");

    element.dataset.shockCompletedElement = id;

    element.style.position = "absolute";
    element.style.boxSizing = "border-box";
    element.style.zIndex =
      id === "screen" ? "15" : "16";

    element.style.pointerEvents = "none";
    element.style.userSelect = "none";
    element.style.touchAction = "none";
    element.style.overflow = "hidden";

    deviceWrap.appendChild(element);

    elements[id] = element;

    return element;
  }

  function createScreenBackground() {
    const screen = createBaseElement("screen");

    screen.style.background = "#000";
    screen.style.pointerEvents = "none";

    const img = document.createElement("img");

    img.src = image;
    img.alt = "Екран MEDIANA D500 — шок виконано";
    img.draggable = false;

    Object.assign(img.style, {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "fill",
      pointerEvents: "none"
    });

    screen.appendChild(img);
  }

  function createValueElement(
  id,
  color = "#FFC34D"
) {
  const element = createBaseElement(id);
    if (id === "manualCounter") {
  element.style.overflow = "visible";
  element.style.zIndex = "100";
}

  Object.assign(element.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color,
    fontFamily: "Arial, sans-serif",
    fontWeight: "bold",
    textAlign: "center",
    whiteSpace: "nowrap",
    lineHeight: "1",
    pointerEvents: "none",
    background: "transparent",
    overflow: "visible"
  });

  if (id === "manualCounter") {
    element.style.zIndex = "100";
    element.style.textShadow = "none";
  }

  return element;
}

  function createHandle(id) {
    const handle = document.createElement("div");

    Object.assign(handle.style, {
      position: "absolute",
      width: "16px",
      height: "16px",
      background: "#ffcc00",
      border: "2px solid #fff",
      boxSizing: "border-box",
      cursor: "nwse-resize",
      touchAction: "none",
      transform: "translate(-50%, -50%)",
      display: "none",
      zIndex: "2147483647"
    });

    handle.dataset.editorHandle = id;

    deviceWrap.appendChild(handle);

    handles[id] = handle;

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let original = null;
    let resizing = false;

    function onPointerDown(event, resize) {
      if (!editorEnabled || editingId !== id) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      pointerId = event.pointerId;
      resizing = resize;

      startX = event.clientX;
      startY = event.clientY;

      original = {
        ...layout[id]
      };

      try {
        event.currentTarget.setPointerCapture(
          event.pointerId
        );
      } catch {
        // Pointer capture is optional.
      }
    }

    function onPointerMove(event) {
      if (
        pointerId !== event.pointerId ||
        !original
      ) {
        return;
      }

      const rect = deviceWrap.getBoundingClientRect();

      if (!rect.width || !rect.height) return;

      const dx =
        (event.clientX - startX) / rect.width * 100;

      const dy =
        (event.clientY - startY) / rect.height * 100;

      const p = layout[id];

      if (resizing) {
        p.width = clamp(
          original.width + dx,
          0.5,
          100 - p.x
        );

        p.height = clamp(
          original.height + dy,
          0.5,
          100 - p.y
        );

      } else {
        p.x = clamp(
          original.x + dx,
          0,
          100 - p.width
        );

        p.y = clamp(
          original.y + dy,
          0,
          100 - p.height
        );
      }

      applyPosition(id);
      updateCoordinates(id);
      saveLayout();
    }

    function onPointerUp(event) {
      if (pointerId !== event.pointerId) return;

      pointerId = null;
      original = null;

      saveLayout();
    }

    const element = elements[id];

    const onElementDown = event =>
      onPointerDown(event, false);

    const onHandleDown = event =>
      onPointerDown(event, true);

    element.addEventListener(
      "pointerdown",
      onElementDown
    );

    handle.addEventListener(
      "pointerdown",
      onHandleDown
    );

    element.addEventListener(
      "pointermove",
      onPointerMove
    );

    handle.addEventListener(
      "pointermove",
      onPointerMove
    );

    element.addEventListener(
      "pointerup",
      onPointerUp
    );

    handle.addEventListener(
      "pointerup",
      onPointerUp
    );

    element.addEventListener(
      "pointercancel",
      onPointerUp
    );

    handle.addEventListener(
      "pointercancel",
      onPointerUp
    );

    cleanup.push(() => {
      element.removeEventListener(
        "pointerdown",
        onElementDown
      );

      handle.removeEventListener(
        "pointerdown",
        onHandleDown
      );

      element.removeEventListener(
        "pointermove",
        onPointerMove
      );

      handle.removeEventListener(
        "pointermove",
        onPointerMove
      );

      element.removeEventListener(
        "pointerup",
        onPointerUp
      );

      handle.removeEventListener(
        "pointerup",
        onPointerUp
      );

      element.removeEventListener(
        "pointercancel",
        onPointerUp
      );

      handle.removeEventListener(
        "pointercancel",
        onPointerUp
      );
    });

    updateHandle(id);
  }

  function updateHandle(id) {
    const handle = handles[id];
    const p = layout[id];

    if (!handle || !p) return;

    handle.style.left =
      (p.x + p.width) + "%";

    handle.style.top =
      (p.y + p.height) + "%";
  }

  function createEditorPanel() {
    if (!workspace) return;

    const panel = document.createElement("div");

    panel.className =
      "shock-completed-editor-controls";

    Object.assign(panel.style, {
      display: "none",
      flexWrap: "wrap",
      gap: "6px",
      marginTop: "8px",
      width: "100%"
    });

    for (const id of EDITABLE_IDS) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "tool-button";

      button.textContent =
        "Редагувати: " + LABELS[id];

      const onClick = () => {
        setEditing(
          editingId === id ? null : id
        );
      };

      button.addEventListener(
        "click",
        onClick
      );

      cleanup.push(() =>
        button.removeEventListener(
          "click",
          onClick
        )
      );

      panel.appendChild(button);

      editorButtons[id] = button;
    }

    const resetButton =
      document.createElement("button");

    resetButton.type = "button";
    resetButton.className = "tool-button";

    resetButton.textContent =
      "Скинути координати цього екрана";

    const onReset = () => {
      layout = cloneLayout(DEFAULT_LAYOUT);

      saveLayout();

      for (const id of EDITABLE_IDS) {
        applyPosition(id);
      }

      if (editingId) {
        updateCoordinates(editingId);
      }
    };

    resetButton.addEventListener(
      "click",
      onReset
    );

    cleanup.push(() =>
      resetButton.removeEventListener(
        "click",
        onReset
      )
    );

    panel.appendChild(resetButton);

    workspace.appendChild(panel);

    elements.editorPanel = panel;
  }
  function syncEditorPanel() {
    if (!elements.editorPanel) return;

    for (const id of EDITABLE_IDS) {
      const button = editorButtons[id];

      if (!button) continue;

  const available = visible
  ? true
  : (id === "manualCounter" && manualMode) ||
    (id === "medianaChargeCounter" && medianaChargeActive);

      button.style.display =
        available ? "" : "none";
    }

    elements.editorPanel.style.display =
      editorEnabled && (visible || manualMode)
        ? "flex"
        : "none";
  }
  function setEditing(id = null) {
    if (!editorEnabled) {
      id = null;
    }

    editingId = id;

    for (const key of EDITABLE_IDS) {
      const active = key === id;
      const element = elements[key];

      if (!element) continue;

      element.style.outline =
        active ? "2px dashed #00a8ff" : "none";

      element.style.cursor =
        active ? "move" : "default";

      element.style.pointerEvents =
        active ? "auto" : "none";

      if (handles[key]) {
        handles[key].style.display =
          active ? "block" : "none";
      }

      if (editorButtons[key]) {
        editorButtons[key].style.background =
          active ? "#1677d2" : "";
      }
    }

    if (id) {
      updateCoordinates(id);
    }
  }

  function renderValues() {
    if (elements.smallEnergy) {
      elements.smallEnergy.textContent =
        selectedEnergy == null
          ? ""
          : `${selectedEnergy} J`;
    }

    if (elements.shockCount) {
      elements.shockCount.textContent =
        String(shockCount);
    }
    if (elements.completedCounter?._value) {
  elements.completedCounter._value.textContent =
    shockCount > 0
      ? String(shockCount).padStart(3, "0")
      : "";
}
    if (elements.energyCounter?._value) {
  elements.energyCounter._value.textContent =
    shockCount > 0
      ? String(shockCount).padStart(3, "0")
      : "";
}

if (elements.chargeCounter?._value) {
  elements.chargeCounter._value.textContent =
    shockCount > 0
      ? String(shockCount).padStart(3, "0")
      : "";
}
    if (elements.medianaChargeCounter?._value) {
  elements.medianaChargeCounter._value.textContent =
    shockCount > 0
      ? String(shockCount).padStart(3, "0")
      : "";
}

if (elements.manualCounter) {
  elements.manualCounter._value.textContent =
    shockCount > 0
      ? String(shockCount).padStart(3, "0")
      : "";
}

    if (elements.consumedEnergy) {
      const consumed =
        selectedEnergy == null
          ? null
          : Math.max(0, selectedEnergy - 4);

      elements.consumedEnergy.textContent =
        consumed == null
          ? ""
          : `${consumed} J`;
    }
  }

  function build() {
  createScreenBackground();

  createValueElement(
    "smallEnergy",
    "#FFFFFF"
  );

  createValueElement(
    "shockCount",
    "#FFC34D"
  );
    const completedCounter = createValueElement(
  "completedCounter",
  "#FFFFFF"
);

completedCounter.style.zIndex = "1000";

const completedCounterValue = document.createElement("span");

Object.assign(completedCounterValue.style, {
  display: "inline-block",
  background: "#000000",
  color: "#FFFFFF",
  fontWeight: "900",
  padding: "2px 5px",
  lineHeight: "1",
  whiteSpace: "nowrap"
});

completedCounter.appendChild(completedCounterValue);
completedCounter._value = completedCounterValue;
  // Лічильники для екранів вибору енергії та заряджання
  for (const id of [
  "energyCounter",
  "chargeCounter",
  "medianaChargeCounter"
]) {
    const counter = createValueElement(id, "#FFFFFF");

    counter.style.zIndex = "1000";

    const value = document.createElement("span");

    Object.assign(value.style, {
      display: "inline-block",
      background: "#000000",
      color: "#FFFFFF",
      fontWeight: "900",
      padding: "2px 5px",
      lineHeight: "1",
      whiteSpace: "nowrap"
    });

    counter.appendChild(value);
    counter._value = value;
  }
    
  createValueElement(
    "consumedEnergy",
    "#FFC34D"
  );

  const manualCounter = createValueElement(
    "manualCounter",
    "#FFFFFF"
  );

  const counterValue = document.createElement("span");

  Object.assign(counterValue.style, {
    display: "inline-block",
    background: "#000000",
    padding: "2px 5px",
    borderRadius: "2px",
    lineHeight: "1",
    whiteSpace: "nowrap",
    fontWeight: "900",
    color: "#FFFFFF"
  });

  manualCounter.appendChild(counterValue);
  manualCounter._value = counterValue;

  for (const id of EDITABLE_IDS) {
    applyPosition(id);
    createHandle(id);
  }

  createEditorPanel();

  setEditing(null);
  renderValues();

  elements.screen.style.display = "none";

  for (const id of EDITABLE_IDS) {
    elements[id].style.display = "none";
  }
}
   function show(energy) {
    if (
      !Number.isFinite(energy) ||
      energy <= 0
    ) {
      throw new RangeError(
        "Для показу розряду потрібна коректна підтверджена енергія."
      );
    }

    if (completionTimeout !== null) {
      clearTimeout(completionTimeout);
      completionTimeout = null;
    }

    selectedEnergy = energy;
    shockCount += 1;
    visible = true;

      for (const id of EDITABLE_IDS) {
      if (!COUNTER_IDS.includes(id)) {
        elements[id].style.display = "flex";
      }
    }

    syncCounterVisibility();
    renderValues();
    syncEditorPanel();

 completionTimeout = setTimeout(() => {
  hide(true);

  if (typeof onReturn === "function") {
    onReturn();
  }
}, 2000);
}

function hide(keepCounter = false) {
    if (completionTimeout !== null) {
      clearTimeout(completionTimeout);
      completionTimeout = null;
    }

    visible = false;
editorEnabled = false;

for (const id of EDITABLE_IDS) {
  if (!elements[id]) continue;

  elements[id].style.display = "none";
}

    if (keepCounter && manualMode) {
      elements.manualCounter.style.display = "flex";
    }

    setEditing(null);
    syncEditorPanel();
  }

  function resetClinicalValues() {
  shockCount = 0;
  selectedEnergy = null;
  medianaChargeActive = false;

  renderValues();
  hide(false);
}
    function setManualMode(enabled) {
    manualMode = Boolean(enabled);

    if (!manualMode) {
      if (!visible && elements.manualCounter) {
        elements.manualCounter.style.display = "none";
      }

      setEditing(null);
    } else if (!visible && elements.manualCounter && shockCount > 0) {
  elements.manualCounter.style.display = "flex";
} else if (elements.manualCounter) {
  elements.manualCounter.style.display = "none";
}

    renderValues();
    syncEditorPanel();
  }

   function setEditorEnabled(enabled) {
    editorEnabled = Boolean(enabled);

    if (!editorEnabled) {
      setEditing(null);
    }

    syncEditorPanel();
  }

  build();

  const unsubscribe = subscribe(deviceState => {
    if (!deviceState.power) {
      resetClinicalValues();
    }
  });

  function destroy() {
    hide();

    unsubscribe();

    cleanup.splice(0).forEach(dispose => {
      dispose();
    });

    for (const element of Object.values(elements)) {
      if (element?.remove) {
        element.remove();
      }
    }

    for (const handle of Object.values(handles)) {
      handle.remove();
    }

    if (originalPosition) {
      deviceWrap.style.position = originalPosition;
    } else {
      deviceWrap.style.removeProperty("position");
    }

    delete deviceWrap.dataset.shockCompletedScreen;
  }
function setMedianaChargeActive(active) {
  medianaChargeActive = Boolean(active);
  syncCounterVisibility();
}
 return {
  show,
  hide,
  destroy,
  setEditorEnabled,
  setManualMode,
  setMedianaChargeActive,

    getShockCount: () => shockCount,

    getSelectedEnergy: () => selectedEnergy,

    getLayout: () => cloneLayout(layout)
  };
}
