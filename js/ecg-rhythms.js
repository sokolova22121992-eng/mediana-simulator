
/**
 * MEDIANA D500 — ECG RHYTHMS
 *
 * 7 навчальних форм ЕКГ:
 * - Синусовий ритм
 * - ШТ мономорфна
 * - ШТ поліморфна
 * - Torsades de pointes
 * - Асистолія
 * - ФШ дрібнохвильова
 * - ФШ великохвильова
 *
 * Повільніша анімація.
 * Збереження координат області.
 * Переміщення та зміна розміру області.
 *
 * Не керує клінічними сценаріями.
 * Не змінює device-state.js.
 */

const STORAGE_KEY = "mediana-ecg-layout-v1";

const DEFAULT_LAYOUT = {
  x: 19,
  y: 23,
  w: 44,
  h: 3.2,
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
    name: "Веретеноподібна ШТ (torsades de pointes)",
    type: "torsades",
    rate: 170
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
    rate: 50
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

/* =========================================
   3. СИНУСОВИЙ РИТМ

   Послідовність P — QRS — T.
   Вузький QRS, плавний зубець T.
========================================= */

function sinusWave(phase) {
  return (
    // P
    0.13 * gaussian(phase, 0.17, 0.035) +

    // Q
    -0.16 * gaussian(phase, 0.345, 0.012) +

    // R
    1.05 * gaussian(phase, 0.375, 0.014) +

    // S
    -0.32 * gaussian(phase, 0.405, 0.018) +

    // T
    0.30 * gaussian(phase, 0.64, 0.075)
  );
}


/* =========================================
   4. МОНОМОРФНА ШТ

   Регулярні широкі комплекси.
   Однакова форма кожного циклу.
   Без виражених зубців P.
========================================= */

function monomorphicVT(phase) {
  const mainHump =
    1.05 * gaussian(phase, 0.34, 0.115);

  const descendingPart =
    -0.28 * gaussian(phase, 0.57, 0.075);

  const secondaryHump =
    0.12 * gaussian(phase, 0.78, 0.065);

  return mainHump + descendingPart + secondaryHump;
}


/* =========================================
   5. ПОЛІМОРФНА ШТ

   Швидкий ритм.
   Морфологія, амплітуда та ширина
   комплексів змінюються від циклу до циклу.
========================================= */

function polymorphicVT(phase, beatNumber) {
  const variation = Math.sin(beatNumber * 1.73);
  const secondary = Math.cos(beatNumber * 0.91);

  const amplitude =
    0.65 + 0.30 * (variation + 1) / 2;

  const width =
    0.085 + 0.025 * (secondary + 1) / 2;

  const polarity =
    Math.sin(beatNumber * 0.57) > -0.75 ? 1 : -1;

  return amplitude * polarity * (
    0.95 * gaussian(phase, 0.34, width) -
    0.30 * gaussian(phase, 0.56, width * 0.8)
  );
}


/* =========================================
   6. TORSADES DE POINTES

   Циклічна зміна амплітуди та полярності.
   Характерне поступове наростання,
   зменшення та зміна напрямку комплексів.
========================================= */

function torsadesWave(phase, time) {
  const rotation = time * 0.85;

  const envelope =
    0.12 + 0.88 *
    Math.abs(Math.sin(rotation));

  const angle =
    phase * Math.PI * 2 + rotation;

  const waveform =
    Math.sin(angle) +
    0.28 * Math.sin(angle * 2 + 0.5);

  return envelope * waveform * 0.85;
}


/* =========================================
   7. ХАОТИЧНІ КОЛИВАННЯ ФШ

   Неперіодичне на вигляд поєднання
   хвиль різної частоти та фази.
========================================= */

function irregularVF(time) {
  const modulation1 =
    Math.sin(time * 1.7);

  const modulation2 =
    Math.sin(time * 0.83 + 1.2);

  return (
    0.42 * Math.sin(time * 13.7 + modulation1 * 1.4) +
    0.30 * Math.sin(time * 19.3 + modulation2 * 1.7) +
    0.22 * Math.sin(time * 27.1 + Math.sin(time * 2.3)) +
    0.13 * Math.sin(time * 34.7 + modulation1) +
    0.09 * Math.sin(time * 42.3 + modulation2 * 2)
  );
}


/* =========================================
   8. ГЕНЕРАТОР СИГНАЛУ
========================================= */

function getSignal(type, time, rate) {

  /* АСИСТОЛІЯ
     Майже рівна лінія.
     Ледь помітні нерегулярні коливання.
  */

if (type === "asystole") {
  return (
    0.045 * Math.sin(time * 5.7) +
    0.028 * Math.sin(time * 10.9 + 1.3) +
    0.015 * Math.sin(time * 17.6 + 2.1) +
    0.008 * Math.sin(time * 24.3 + 0.7)
  );
}


  /* ФШ ВЕЛИКОХВИЛЬОВА */

  if (type === "vf_coarse") {
    return irregularVF(time) * 0.90;
  }


  /* ФШ ДРІБНОХВИЛЬОВА */

  if (type === "vf_fine") {
    return irregularVF(time) * 0.20;
  }


  const period = 60 / rate;

  // Невелика зміна циклу для поліморфної ШТ
  const cyclePosition =
    type === "vt_polymorphic"
      ? time / period + 0.035 * Math.sin(time * 1.8)
      : time / period;

  const beatNumber = Math.floor(cyclePosition);
  const phase = normalizePhase(cyclePosition);


  switch (type) {

    case "sinus":
      return sinusWave(phase);

    case "vt_monomorphic":
      return monomorphicVT(phase);

    case "vt_polymorphic":
      return polymorphicVT(phase, beatNumber);

    case "torsades":
      return torsadesWave(phase, time);

    default:
      return 0;
  }
}


/* =========================================
   9. СТВОРЕННЯ МОДУЛЯ
========================================= */

export function createEcgRhythms({
  deviceWrap,
  coordinatePanel = null,
  selectedName = null,
  defaultLayout = DEFAULT_LAYOUT,
  maskColor = "#101010",
  speed = 10,
  onPositionChange = () => {}
} = {}) {

  if (!deviceWrap) {
    throw new Error("ECG: не передано deviceWrap.");
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


  /* ---------- МАСКА ТА CANVAS ---------- */

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


  /* ---------- РАМКА РЕДАКТОРА ---------- */

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
     10. ЗБЕРЕЖЕННЯ КООРДИНАТ
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
     11. РОЗТАШУВАННЯ ОБЛАСТІ
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
    if (!editorEnabled) return;

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
     12. РОЗМІР CANVAS
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
     13. МАЛЮВАННЯ ЕКГ
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

    const signalTime =
  currentRhythm === "vt_monomorphic"
    ? (elapsedSeconds * currentSpeed / 500) - x / 500
    : elapsedSeconds - x / currentSpeed;

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
     14. АНІМАЦІЯ
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
     15. ЗАПУСК РИТМУ
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
     16. ЗУПИНКА РИТМУ
  ========================================= */

  function stop() {
    active = false;

    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    animationStart = null;
    currentRhythm = null;

    layer.style.display = "none";
  }


  /* =========================================
     17. РЕДАКТОР ОБЛАСТІ
  ========================================= */

  function setEditorEnabled(enabled) {
    editorEnabled = Boolean(enabled);

    if (!editorEnabled) {
      dragging = null;
    }

    editor.style.display =
      editorEnabled ? "block" : "none";

    editor.hidden = !editorEnabled;

    editor.style.visibility =
      editorEnabled ? "visible" : "hidden";

    editor.style.pointerEvents =
      editorEnabled ? "auto" : "none";

    layer.style.display =
      active ? "block" : "none";

    if (editorEnabled) {
      applyLayout();
      updateCoordinates();
    }
  }


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


  /* =========================================
     18. НАЛАШТУВАННЯ МАСШТАБУ
  ========================================= */

  function setScale(value) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(
        "ECG: некоректний масштаб."
      );
    }

    layout.scale = value;

    saveLayout();
    updateCoordinates();
  }


  function setAmplitude(value) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(
        "ECG: некоректна амплітуда."
      );
    }

    layout.amplitude = value;

    saveLayout();
    updateCoordinates();
  }


  function setSpeed(value) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(
        "ECG: некоректна швидкість."
      );
    }

    currentSpeed = value;
  }


  /* =========================================
     19. ВСТАНОВЛЕННЯ КООРДИНАТ
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
     20. ОТРИМАННЯ ДАНИХ
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
     21. ІНІЦІАЛІЗАЦІЯ
  ========================================= */

  applyLayout();

  const resizeObserver =
    new ResizeObserver(() => {
      if (active) {
        resizeCanvas();
      }
    });

  resizeObserver.observe(deviceWrap);


  function destroy() {
    stop();

    resizeObserver.disconnect();

    layer.remove();
    editor.remove();
  }


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
