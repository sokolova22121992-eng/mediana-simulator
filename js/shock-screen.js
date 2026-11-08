
import {
  subscribe
} from "./device-state.js";

const STORAGE_KEY = "mediana-shock-layout-v1";

const DEFAULT_POSITIONS = {
  timer: {
    x: 49,
    y: 19,
    width: 6,
    height: 3.1
  },
  mainEnergy: {
    x: 33,
    y: 43,
    width: 10,
    height: 5
  },
  smallEnergy: {
    x: 27,
    y: 21,
    width: 5,
    height: 2
  }
};

const NAMES = {
  timer: "Таймер — екран готовності",
  mainEnergy: "Великі джоулі — екран готовності",
  smallEnergy: "Малі джоулі — екран готовності"
};

export function createShockScreen({
  deviceWrap,
  runtimeDisplay,
  coordinatePanel,
  selectedName,
  image = "mediana-schock.PNG"
} = {}) {
  if (!deviceWrap || !runtimeDisplay) {
    throw new Error("Не знайдено елементи екрана.");
  }

  let positions = loadPositions();
  let elements = {};
  let editingElement = null;
  let editorEnabled = false;
  let visible = false;

  const originalTimerStyle = {
    left: runtimeDisplay.style.left,
    top: runtimeDisplay.style.top,
    width: runtimeDisplay.style.width,
    height: runtimeDisplay.style.height
  };

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
      return JSON.parse(JSON.stringify(DEFAULT_POSITIONS));
    }
  }

  function savePositions() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(positions)
    );
  }

  function applyPosition(id) {
    const element = elements[id];
    const p = positions[id];

    element.style.left = p.x + "%";
    element.style.top = p.y + "%";
    element.style.width = p.width + "%";
    element.style.height = p.height + "%";

    if (id !== "timer") {
      const rect = deviceWrap.getBoundingClientRect();

      const fontSize = Math.max(
        4,
        Math.min(
          rect.height * p.height / 100 * 0.8,
          rect.width * p.width / 100 / 5
        )
      );

      element.style.setProperty(
        "font-size",
        fontSize + "px",
        "important"
      );
    }
  }

  function updateCoordinates(id) {
    const p = positions[id];

    if (selectedName) {
      selectedName.textContent = NAMES[id];
    }

    if (coordinatePanel) {
      coordinatePanel.textContent =
        `X: ${p.x.toFixed(4)}% | ` +
        `Y: ${p.y.toFixed(4)}% | ` +
        `W: ${p.width.toFixed(4)}% | ` +
        `H: ${p.height.toFixed(4)}%`;
    }
  }

  function createEnergyElement(id) {
    const element = document.createElement("div");

    element.style.position = "absolute";
    element.style.boxSizing = "border-box";
    element.style.display = "flex";
    element.style.alignItems = "center";
    element.style.justifyContent = "center";
    element.style.color = "#ffcc00";
    element.style.fontFamily = "Arial, sans-serif";
    element.style.fontWeight = "bold";
    element.style.textAlign = "center";
    element.style.whiteSpace = "nowrap";
    element.style.textShadow = "0 1px 3px #000";
    element.style.overflow = "hidden";
    element.style.userSelect = "none";
    element.style.zIndex = "2147483646";

    deviceWrap.appendChild(element);
    elements[id] = element;

    return element;
  }

  function createScreen() {
    const screen = document.createElement("div");

    screen.style.position = "absolute";
    screen.style.overflow = "hidden";
    screen.style.zIndex = "15";
    screen.style.pointerEvents = "none";

    const img = document.createElement("img");
    img.src = image;
    img.alt = "Екран готовності до розряду MEDIANA";
    img.draggable = false;

    Object.assign(img.style, {
      width: "100%",
      height: "100%",
      objectFit: "fill",
      display: "block"
    });

    screen.appendChild(img);
    deviceWrap.appendChild(screen);
    elements.screen = screen;
  }

  function createEditor() {
    const panel = document.createElement("div");

    panel.className = "shock-editor-controls";

    Object.assign(panel.style, {
      display: "none",
      flexWrap: "wrap",
      gap: "6px",
      marginTop: "8px",
      width: "100%"
    });

    Object.keys(NAMES).forEach(id => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "tool-button";
      button.textContent = "Редагувати: " + NAMES[id];

      button.addEventListener("click", () => {
        setEditing(
          editingElement === id ? null : id
        );
      });

      panel.appendChild(button);
      buttons[id] = button;
    });

    const workspace = document.querySelector(".workspace");

    if (workspace) {
      workspace.appendChild(panel);
    }

    editorPanel = panel;
  }

  let editorPanel = null;
  const buttons = {};

  function makeEditable(id) {
    const element = elements[id];

    const handle = document.createElement("div");

    Object.assign(handle.style, {
      position: "absolute",
      width: "16px",
      height: "16px",
      background: "#ffcc00",
      border: "2px solid white",
      boxSizing: "border-box",
      cursor: "nwse-resize",
      touchAction: "none",
      transform: "translate(-50%, -50%)",
      display: "none",
      zIndex: "2147483647"
    });

    deviceWrap.appendChild(handle);

    let pointerId = null;
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let original = null;

    function updateHandle() {
      const p = positions[id];

      handle.style.left = (p.x + p.width) + "%";
      handle.style.top = (p.y + p.height) + "%";
    }

    function pointerDown(event, resize) {
      if (editingElement !== id) return;

      event.preventDefault();
      event.stopPropagation();

      pointerId = event.pointerId;
      resizing = resize;
      startX = event.clientX;
      startY = event.clientY;
      original = { ...positions[id] };

      event.currentTarget.setPointerCapture(event.pointerId);
    }

    function pointerMove(event) {
      if (pointerId !== event.pointerId || !original) return;

      const rect = deviceWrap.getBoundingClientRect();

      const dx = (event.clientX - startX) / rect.width * 100;
      const dy = (event.clientY - startY) / rect.height * 100;

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
      updateHandle();
      updateCoordinates(id);
      savePositions();
    }

    function pointerUp(event) {
      if (pointerId !== event.pointerId) return;

      pointerId = null;
      original = null;
      savePositions();
    }

    element.addEventListener("pointerdown", event => {
      pointerDown(event, false);
    });

    handle.addEventListener("pointerdown", event => {
      pointerDown(event, true);
    });

    [element, handle].forEach(target => {
      target.addEventListener("pointermove", pointerMove);
      target.addEventListener("pointerup", pointerUp);
      target.addEventListener("pointercancel", pointerUp);
    });

    element._editorHandle = handle;
    updateHandle();
  }

  function setEditing(id = null) {
  if (!editorEnabled) {
    id = null;
  }

  editingElement = id;

  Object.keys(NAMES).forEach(key => {
    const active = key === id;
    const element = elements[key];

    element.style.outline = active ? "2px dashed #00a8ff" : "none";
    element.style.cursor = active ? "move" : "default";
    element.style.pointerEvents = active ? "auto" : "none";
    element._editorHandle.style.display = active ? "block" : "none";
    buttons[key].style.background = active ? "#1677d2" : "";
  });

  if (id) updateCoordinates(id);
}
  function show(energy) {
    if (!Number.isFinite(energy) || energy <= 0) return;

    hide();

    visible = true;

    createScreen();

    const timer = createEnergyElement("timer");
    timer.textContent = runtimeDisplay.textContent;

    // Таймер продовжує працювати у своєму початковому елементі.
    // На екрані готовності відображається його актуальне значення.
    elements.timerMirror = timer;

    const mainEnergy = createEnergyElement("mainEnergy");
    mainEnergy.textContent = `${energy} J`;

    const smallEnergy = createEnergyElement("smallEnergy");
    smallEnergy.textContent = `${energy} J`;

    Object.keys(NAMES).forEach(id => {
      applyPosition(id);
      makeEditable(id);
    });

    const screenPosition = {
      x: 48,
      y: 22,
      width: 12,
      height: 10
    };

    Object.assign(elements.screen.style, {
      left: screenPosition.x + "%",
      top: screenPosition.y + "%",
      width: screenPosition.width + "%",
      height: screenPosition.height + "%",
      display: "block"
    });

    createEditor();

    if (editorPanel) {
      editorPanel.style.display = "flex";
    }

    syncTimer();
  }

  let timerSync = null;

  function syncTimer() {
    if (timerSync) clearInterval(timerSync);

    timerSync = setInterval(() => {
      if (visible && elements.timerMirror) {
        elements.timerMirror.textContent =
          runtimeDisplay.textContent;
      }
    }, 250);
  }

  function hide() {
    visible = false;

    if (timerSync) {
      clearInterval(timerSync);
      timerSync = null;
    }

    Object.values(elements).forEach(element => {
      if (element._editorHandle) {
        element._editorHandle.remove();
      }

      element.remove();
    });

    elements = {};

    if (editorPanel) {
      editorPanel.remove();
      editorPanel = null;
    }

    editingElement = null;
  }

  const unsubscribe = subscribe(state => {
    if (!state.power) {
      hide();
    }
  });

  function destroy() {
    hide();
    unsubscribe();
  }

 return {
  show,
  hide,
  destroy,

setEditorEnabled(enabled) {
  editorEnabled = Boolean(enabled);

  if (!editorEnabled) {
    setEditing(null);
  }

  if (editorPanel) {
    editorPanel.style.display =
      editorEnabled && visible ? "flex" : "none";
  }
}
};
}
