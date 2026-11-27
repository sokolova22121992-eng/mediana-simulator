/**
 * MEDIANA D500
 * ECG RHYTHMS MODULE
 *
 * Відповідає за:
 * - 7 форм ЕКГ;
 * - рух кривої зліва направо;
 * - маскування оригінальної лінії на фото;
 * - редактор області ЕКГ;
 * - зміну масштабу й амплітуди;
 * - автоматичне збереження координат.
 *
 * Не керує клінічними сценаріями.
 * Не змінює device-state.js.
 */

const STORAGE_KEY = "mediana-ecg-layout-v1";

const DEFAULT_LAYOUT = {
  // Початкові приблизні координати.
  // Область вузька за висотою, її можна налаштувати редактором.
  x: 19,
  y: 23,
  w: 44,
  h: 2,
  scale: 1,
  amplitude: 1
};


/* =========================================
   1. БІБЛІОТЕКА РИТМІВ
========================================= */

const RHYTHMS = {
  vt_monomorphic: {
    name: "ШТ мономорфна",
    type: "vt_monomorphic",
    rate: 180
  },

  vt_polymorphic: {
    name: "ШТ поліморфна",
    type: "vt_polymorphic",
    rate: 180
  },

  torsades: {
    name: "Веретеноподібна ШТ",
    type: "torsades",
    rate: 180
  },

  asystole: {
    name: "Асистолія",
    type: "asystole"
  },

  vf_fine: {
    name: "ФШ дрібнохвильова",
    type: "vf_fine"
  },

  vf_coarse: {
    name: "ФШ великохвильова",
    type: "vf_coarse"
  },

  sinus: {
    name: "Звичайний синусовий ритм",
    type: "sinus",
    rate: 75
  }
};


/* =========================================
   2. ДОПОМІЖНІ ФУНКЦІЇ
========================================= */

function gaussian(x, center, width) {
  const d = (x - center) / width;
  return Math.exp(-0.5 * d * d);
}

function normalizePhase(value) {
  return ((value % 1) + 1) % 1;
}

function sinusWave(phase) {
  return (
    0.12 * gaussian(phase, 0.16, 0.035) -
    0.18 * gaussian(phase, 0.38, 0.012) +
    1.45 * gaussian(phase, 0.42, 0.022) -
    0.35 * gaussian(phase, 0.48, 0.018) +
    0.34 * gaussian(phase, 0.70, 0.075)
  );
}

function monomorphicVT(phase) {
  return (
    -0.30 * gaussian(phase, 0.32, 0.035) +
    1.15 * gaussian(phase, 0.43, 0.065) -
    0.45 * gaussian(phase, 0.55, 0.045)
  );
}

function polymorphicVT(phase, beatNumber) {
  const variation = Math.sin(beatNumber * 1.7);

  const amplitude = 0.75 + 0.35 * variation;
  const width = 0.045 + 0.018 * Math.cos(beatNumber * 1.3);

  return amplitude * (
    -0.25 * gaussian(phase, 0.32, width) +
    1.2 * gaussian(phase, 0.43, width * 1.5) -
    0.4 * gaussian(phase, 0.56, width)
  );
}

function torsadesWave(phase, beatNumber) {
  const envelope =
    0.12 + 0.95 *
    Math.pow(
      Math.sin(beatNumber * 0.42 + 0.7),
      2
    );

  const changingPolarity =
    Math.sin(beatNumber * 0.42 + 0.7);

  return envelope * changingPolarity * (
    -0.28 * gaussian(phase, 0.31, 0.045) +
    1.15 * gaussian(phase, 0.43, 0.065) -
    0.42 * gaussian(phase, 0.56, 0.045)
  );
}


/* =========================================
   3. ГЕНЕРАТОР ЕКГ-СИГНАЛУ
========================================= */

function getSignal(type, time, rate) {
  if (type === "asystole") {
    return (
      0.004 * Math.sin(time * 7.2) +
      0.002 * Math.sin(time * 13.1)
    );
  }

  if (type === "vf_coarse") {
    return (
      0.62 * Math.sin(time * 17.1) +
      0.43 * Math.sin(time * 23.7) +
      0.28 * Math.sin(time * 31.4) +
      0.17 * Math.sin(time * 11.8) +
      0.08 * Math.sin(time * 39.2)
    );
  }

  if (type === "vf_fine") {
    return (
      0.19 * Math.sin(time * 25.3) +
      0.14 * Math.sin(time * 37.1) +
      0.10 * Math.sin(time * 43.7) +
      0.07 * Math.sin(time * 18.4) +
      0.04 * Math.sin(time * 52.2)
    );
  }

  const period = 60 / rate;
  const beatNumber = Math.floor(time / period);
  const phase = normalizePhase(time / period);

  switch (type) {
    case "sinus":
      return sinusWave(phase);

    case "vt_monomorphic":
      return monomorphicVT(phase);

    case "vt_polymorphic":
      return polymorphicVT(phase, beatNumber);

    case "torsades":
      return torsadesWave(phase, beatNumber);

    default:
      return 0;
  }
}


/* =========================================
   4. СТВОРЕННЯ МОДУЛЯ
========================================= */

export function createEcgRhythms({
  deviceWrap,
  coordinatePanel = null,
  selectedName = null,
  defaultLayout = DEFAULT_LAYOUT,
  maskColor = "#101010",
  speed = 180,
  onPositionChange = () => {}
} = {}) {

  if (!deviceWrap) {
    throw new Error(
      "ECG: не передано deviceWrap."
    );
  }

  if (typeof onPositionChange !== "function") {
    throw new TypeError(
      "ECG: onPositionChange має бути функцією."
    );
  }

  let layout = loadLayout();

  let active = false;
  let editorEnabled = false;
  let currentRhythm = null;

  let animationFrame = null;
  let animationStart = null;

  let dragging = null;

  let currentSpeed = speed;


  /* ---------- СТВОРЕННЯ МАСКИ ---------- */

  const layer = document.createElement("div");

  layer.className = "ecg-layer";

  Object.assign(layer.style, {
    position: "absolute",
    display: "none",
    overflow: "hidden",
    background: maskColor,
    zIndex: "20",
    pointerEvents: "none",
    boxSizing: "border-box"
  });

  const canvas = document.createElement("canvas");

  Object.assign(canvas.style, {
    display: "block",
    width: "100%",
    height: "100%"
  });

  layer.appendChild(canvas);


  /* ---------- СТВОРЕННЯ РЕДАКТОРА ---------- */

  const editor = document.createElement("div");

  editor.className = "ecg-editor";

  Object.assign(editor.style, {
    position: "absolute",
    display: "none",
    border: "2px dashed #00d5ff",
    boxSizing: "border-box",
    zIndex: "30",
    cursor: "move",
    touchAction: "none"
  });

  const resizeHandle = document.createElement("div");

  Object.assign(resizeHandle.style, {
    position: "absolute",
    width: "14px",
    height: "14px",
    right: "-7px",
    bottom: "-7px",
    background: "#ffd34e",
    border: "2px solid #111820",
    borderRadius: "3px",
    cursor: "nwse-resize",
    touchAction: "none"
  });

  editor.appendChild(resizeHandle);

  deviceWrap.appendChild(layer);
  deviceWrap.appendChild(editor);

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "ECG: не вдалося створити Canvas-контекст."
    );
  }


  /* =========================================
     5. ЗБЕРЕЖЕННЯ КООРДИНАТ
  ========================================= */

  function loadLayout() {
    const fallback = {
      ...DEFAULT_LAYOUT,
      ...(defaultLayout || {})
    };

    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      const result = {
        ...fallback,
        ...(saved || {})
      };

      for (const key of [
        "x", "y", "w", "h", "scale", "amplitude"
      ]) {
        if (!Number.isFinite(result[key])) {
          result[key] = fallback[key];
        }
      }

      // Захист від некоректних збережених координат.
      if (
        result.x < 0 ||
        result.y < 0 ||
        result.w <= 0 ||
        result.h <= 0 ||
        result.x + result.w > 100 ||
        result.y + result.h > 100
      ) {
        return { ...fallback };
      }

      if (result.scale <= 0) {
        result.scale = fallback.scale;
      }

      if (result.amplitude <= 0) {
        result.amplitude = fallback.amplitude;
      }

      return result;

    } catch (error) {
      return { ...fallback };
    }
  }

  function saveLayout() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(layout)
      );
    } catch (error) {
      console.error(
        "ECG: не вдалося зберегти координати.",
        error
      );
    }
  }


  /* =========================================
     6. ЗАСТОСУВАННЯ РОЗТАШУВАННЯ
  ========================================= */

  function applyLayout() {
    const styles = {
      left: layout.x + "%",
      top: layout.y + "%",
      width: layout.w + "%",
      height: layout.h + "%"
    };

    Object.assign(layer.style, styles);
    Object.assign(editor.style, styles);

    updateCoordinates();

    if (active) {
      resizeCanvas();
    }
  }

  function updateCoordinates() {
    const coordinates =
      `X: ${layout.x.toFixed(4)}% · ` +
      `Y: ${layout.y.toFixed(4)}% · ` +
      `W: ${layout.w.toFixed(4)}% · ` +
      `H: ${layout.h.toFixed(4)}%`;

    if (coordinatePanel) {
      coordinatePanel.textContent =
        coordinates +
        ` · Масштаб: ${layout.scale.toFixed(2)}` +
        ` · Амплітуда: ${layout.amplitude.toFixed(2)}`;
    }

    if (selectedName) {
      selectedName.textContent = "Область ЕКГ";
    }

    onPositionChange({ ...layout });
  }


  /* =========================================
     7. РОЗМІР CANVAS
  ========================================= */

  function resizeCanvas() {
    const rect = layer.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    context.setTransform(
      dpr, 0, 0, dpr, 0, 0
    );
  }


  /* =========================================
     8. МАЛЮВАННЯ РИТМУ
  ========================================= */

  function draw(elapsedSeconds) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height || !currentRhythm) {
      return;
    }

    context.clearRect(0, 0, width, height);

    const rhythm = RHYTHMS[currentRhythm];

    const centerY = height / 2;

    const amplitude =
      height * 0.36 *
      layout.amplitude *
      layout.scale;

    context.beginPath();

    context.strokeStyle = "#39ff72";
    context.lineWidth = Math.max(1, height * 0.009);
    context.lineJoin = "round";
    context.lineCap = "round";

    const samples = Math.max(
      200,
      Math.ceil(width * 2)
    );

    for (let i = 0; i <= samples; i++) {
      const x = width * i / samples;

      // Забезпечує рух кривої зліва направо.
      const signalTime =
        elapsedSeconds - x / currentSpeed;

      const value = getSignal(
        rhythm.type,
        signalTime,
        rhythm.rate
      );

      const y = centerY - value * amplitude;

      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.stroke();
  }


  /* =========================================
     9. АНІМАЦІЯ
  ========================================= */

  function animate(timestamp) {
    if (!active) return;

    if (animationStart === null) {
      animationStart = timestamp;
    }

    const elapsedSeconds =
      (timestamp - animationStart) / 1000;

    draw(elapsedSeconds);

    animationFrame =
      requestAnimationFrame(animate);
  }


  /* =========================================
     10. ЗАПУСК РИТМУ
  ========================================= */

  function start(rhythmId) {
    if (!RHYTHMS[rhythmId]) {
      throw new Error(
        "ECG: невідомий ритм " + rhythmId
      );
    }

    stop();

    currentRhythm = rhythmId;
    active = true;
    animationStart = null;

    layer.style.display = "block";

    resizeCanvas();

    animationFrame =
      requestAnimationFrame(animate);
  }


  /* =========================================
     11. ЗУПИНКА РИТМУ
  ========================================= */

  function stop() {
    active = false;

    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    animationStart = null;
    currentRhythm = null;

    // Приховуємо маску.
    // Оригінальна лінія на фото знову видима.
    layer.style.display = "none";
  }


  /* =========================================
     12. РЕДАКТОР ОБЛАСТІ
  ========================================= */

  function setEditorEnabled(enabled) {
    editorEnabled = Boolean(enabled);

    if (!editorEnabled) {
      dragging = null;
    }

    editor.style.display =
      editorEnabled ? "block" : "none";

    // Під час редагування відображається лише рамка.
    // Маска та ЕКГ з'являються під час активної оцінки.
    layer.style.display =
      active ? "block" : "none";
  }


  /* ---------- ПОЧАТОК ПЕРЕМІЩЕННЯ / ЗМІНИ РОЗМІРУ ---------- */

  editor.addEventListener(
    "pointerdown",
    event => {
      if (!editorEnabled) return;

      event.preventDefault();

      const rect =
        deviceWrap.getBoundingClientRect();

      dragging = {
        resize: event.target === resizeHandle,
        startX: event.clientX,
        startY: event.clientY,
        original: { ...layout },
        rect
      };

      editor.setPointerCapture(event.pointerId);
    }
  );


  /* ---------- ПЕРЕМІЩЕННЯ / ЗМІНА РОЗМІРУ ---------- */

  editor.addEventListener(
    "pointermove",
    event => {
      if (!editorEnabled || !dragging) return;

      const dx =
        (event.clientX - dragging.startX) /
        dragging.rect.width * 100;

      const dy =
        (event.clientY - dragging.startY) /
        dragging.rect.height * 100;

      const original = dragging.original;

      if (dragging.resize) {
        layout.w = Math.max(
          0.5,
          Math.min(
            100 - layout.x,
            original.w + dx
          )
        );

        layout.h = Math.max(
          0.5,
          Math.min(
            100 - layout.y,
            original.h + dy
          )
        );

      } else {
        layout.x = Math.max(
          0,
          Math.min(
            100 - layout.w,
            original.x + dx
          )
        );

        layout.y = Math.max(
          0,
          Math.min(
            100 - layout.h,
            original.y + dy
          )
        );
      }

      applyLayout();
    }
  );


  /* ---------- ЗАВЕРШЕННЯ РЕДАГУВАННЯ ---------- */

  function finishEditing() {
    if (!dragging) return;

    dragging = null;

    saveLayout();
    resizeCanvas();
    updateCoordinates();
  }

  editor.addEventListener(
    "pointerup",
    finishEditing
  );

  editor.addEventListener(
    "pointercancel",
    finishEditing
  );

  editor.addEventListener(
    "lostpointercapture",
    finishEditing
  );


  /* =========================================
     13. НАЛАШТУВАННЯ МАСШТАБУ
  ========================================= */

  function setScale(value) {
    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      throw new RangeError(
        "ECG: некоректний масштаб."
      );
    }

    layout.scale = value;

    saveLayout();
    updateCoordinates();
  }

  function setAmplitude(value) {
    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      throw new RangeError(
        "ECG: некоректна амплітуда."
      );
    }

    layout.amplitude = value;

    saveLayout();
    updateCoordinates();
  }

  function setSpeed(value) {
    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      throw new RangeError(
        "ECG: некоректна швидкість."
      );
    }

    currentSpeed = value;
  }


  /* =========================================
     14. ВСТАНОВЛЕННЯ КООРДИНАТ
  ========================================= */

  function setLayout(newLayout) {
    const next = {
      ...layout,
      ...newLayout
    };

    for (const key of ["x", "y", "w", "h"]) {
      if (!Number.isFinite(next[key])) {
        throw new TypeError(
          "ECG: некоректна координата " + key
        );
      }
    }

    if (
      next.x < 0 ||
      next.y < 0 ||
      next.w <= 0 ||
      next.h <= 0 ||
      next.x + next.w > 100 ||
      next.y + next.h > 100
    ) {
      throw new RangeError(
        "ECG: область виходить за межі пристрою."
      );
    }

    layout = next;

    applyLayout();
    saveLayout();
  }


  /* =========================================
     15. ОТРИМАННЯ ДАНИХ
  ========================================= */

  function getLayout() {
    return { ...layout };
  }

  function getRhythms() {
    return Object.fromEntries(
      Object.entries(RHYTHMS).map(
        ([id, rhythm]) => [
          id,
          { ...rhythm }
        ]
      )
    );
  }

  function getCurrentRhythm() {
    return currentRhythm;
  }

  function isActive() {
    return active;
  }


  /* =========================================
     16. ІНІЦІАЛІЗАЦІЯ
  ========================================= */

  applyLayout();

  const resizeObserver =
    new ResizeObserver(() => {
      if (active) {
        resizeCanvas();
      }
    });

  resizeObserver.observe(deviceWrap);


  /* =========================================
     17. ЗНИЩЕННЯ МОДУЛЯ
  ========================================= */

  function destroy() {
    stop();

    resizeObserver.disconnect();

    layer.remove();
    editor.remove();
  }


  /* =========================================
     18. ПУБЛІЧНИЙ API МОДУЛЯ
  ========================================= */

  return {
    start,
    stop,

    setEditorEnabled,

    setScale,
    setAmplitude,
    setSpeed,

    setLayout,

    getLayout,
    getRhythms,
    getCurrentRhythm,
    isActive,

    destroy
  };
}
