
/**
 * MEDIANA D500
 * ECG Rhythms Module
 *
 * Відповідає за:
 * - бібліотеку ЕКГ-ритмів;
 * - анімацію зліва направо;
 * - маскування початкової лінії на фото;
 * - редактор області ЕКГ;
 * - збереження координат і параметрів.
 *
 * Не керує клінічними сценаріями та станом пристрою.
 */

const STORAGE_KEY = "mediana-ecg-layout-v1";

const DEFAULT_LAYOUT = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  scale: 1,
  amplitude: 1
};

const RHYTHMS = {
  sinus: {
    name: "Синусовий ритм",
    rate: 75,
    type: "normal"
  },

  bradycardia: {
    name: "Синусова брадикардія",
    rate: 40,
    type: "normal"
  },

  tachycardia: {
    name: "Синусова тахікардія",
    rate: 150,
    type: "normal"
  },

  vt: {
    name: "Шлуночкова тахікардія",
    rate: 180,
    type: "wide"
  },

  vf_coarse: {
    name: "Фібриляція шлуночків — великохвильова",
    type: "vf_coarse"
  },

  vf_fine: {
    name: "Фібриляція шлуночків — дрібнохвильова",
    type: "vf_fine"
  },

  asystole: {
    name: "Асистолія",
    type: "flat"
  },

  af: {
    name: "Фібриляція передсердь",
    rate: 110,
    type: "irregular"
  }
};


/* =========================================
   МАТЕМАТИЧНІ ФОРМИ РИТМІВ
========================================= */

function gaussian(x, center, width) {
  const d = (x - center) / width;
  return Math.exp(-0.5 * d * d);
}

function normalWave(phase, wide = false) {
  const qrsWidth = wide ? 0.075 : 0.025;
  const qrsHeight = wide ? 1.1 : 1.5;

  return (
    0.12 * gaussian(phase, 0.16, 0.035) -
    0.18 * gaussian(phase, 0.38, 0.012) +
    qrsHeight * gaussian(phase, 0.42, qrsWidth) -
    0.35 * gaussian(phase, 0.48, 0.018) +
    0.34 * gaussian(phase, 0.70, 0.075)
  );
}

function getSignal(type, time, rate) {
  const phase = rate ? (time * rate / 60) % 1 : 0;

  switch (type) {
    case "normal":
      return normalWave(phase);

    case "wide":
      return normalWave(phase, true);

    case "vf_coarse":
      return (
        0.65 * Math.sin(time * 17) +
        0.42 * Math.sin(time * 23.7) +
        0.25 * Math.sin(time * 31.2) +
        0.18 * Math.sin(time * 11.4)
      );

    case "vf_fine":
      return (
        0.22 * Math.sin(time * 24) +
        0.15 * Math.sin(time * 37.2) +
        0.12 * Math.sin(time * 43.8) +
        0.08 * Math.sin(time * 17.5)
      );

    case "flat":
      return 0.006 * Math.sin(time * 8);

    case "irregular": {
      const irregularPhase =
        (time * rate / 60 + 0.12 * Math.sin(time * 2.1)) % 1;

      return (
        0.025 * Math.sin(time * 32) +
        normalWave(irregularPhase)
      );
    }

    default:
      return 0;
  }
}


/* =========================================
   ОСНОВНИЙ МОДУЛЬ
========================================= */

export function createEcgRhythms({
  deviceWrap,
  coordinatePanel,
  selectedName,
  defaultLayout = DEFAULT_LAYOUT,
  maskColor = "#07111d",
  speed = 180,
  onPositionChange = () => {}
} = {}) {

  if (!deviceWrap) {
    throw new Error("Не передано deviceWrap для ЕКГ.");
  }

  const layout = loadLayout();

  let currentRhythm = null;
  let animationFrame = null;
  let animationStart = null;
  let active = false;
  let editorEnabled = false;
  let dragging = null;

  const layer = document.createElement("div");
  layer.className = "ecg-layer";

  Object.assign(layer.style, {
    position: "absolute",
    display: "none",
    overflow: "hidden",
    background: maskColor,
    zIndex: "20",
    touchAction: "none"
  });

  const canvas = document.createElement("canvas");

  Object.assign(canvas.style, {
    width: "100%",
    height: "100%",
    display: "block"
  });

  layer.appendChild(canvas);

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
    cursor: "nwse-resize"
  });

  editor.appendChild(resizeHandle);

  deviceWrap.appendChild(layer);
  deviceWrap.appendChild(editor);

  const context = canvas.getContext("2d");

  /* ---------- ЗАВАНТАЖЕННЯ ---------- */

  function loadLayout() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      return {
        ...defaultLayout,
        ...(saved || {})
      };
    } catch {
      return { ...defaultLayout };
    }
  }

  function saveLayout() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(layout)
    );
  }

  /* ---------- ПОЗИЦІЯ ---------- */

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
  }

  function updateCoordinates() {
    const text =
      `X: ${layout.x.toFixed(4)}% · ` +
      `Y: ${layout.y.toFixed(4)}% · ` +
      `W: ${layout.w.toFixed(4)}% · ` +
      `H: ${layout.h.toFixed(4)}%`;

    if (coordinatePanel) {
      coordinatePanel.textContent =
        text +
        ` · Масштаб: ${layout.scale.toFixed(2)} · ` +
        `Амплітуда: ${layout.amplitude.toFixed(2)}`;
    }

    if (selectedName) {
      selectedName.textContent = "Область ЕКГ";
    }

    onPositionChange({ ...layout });
  }

  /* ---------- РОЗМІР CANVAS ---------- */

  function resizeCanvas() {
    const rect = layer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- МАЛЮВАННЯ ---------- */

  function draw(timeProgress) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height) return;

    context.clearRect(0, 0, width, height);

    context.beginPath();

    const centerY = height / 2;
    const amplitude =
      height * 0.36 * layout.amplitude * layout.scale;

    const samples = Math.max(100, Math.ceil(width));

    const rhythm = RHYTHMS[currentRhythm];

    const totalProgress = Math.min(
      1,
      timeProgress * speed / width
    );

    const visibleWidth = width * totalProgress;

    context.strokeStyle = "#39ff72";
    context.lineWidth = Math.max(1, height * 0.009);
    context.lineJoin = "round";
    context.lineCap = "round";

    for (let i = 0; i <= samples; i++) {
      const x = width * i / samples;

      if (x > visibleWidth) break;

      const time = x / speed;

      const value = getSignal(
        rhythm.type,
        time,
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

  /* ---------- АНІМАЦІЯ ---------- */

  function animate(timestamp) {
    if (!active) return;

    if (animationStart === null) {
      animationStart = timestamp;
    }

    const elapsed = timestamp - animationStart;

    draw(elapsed);

    if (elapsed >= canvas.clientWidth / speed * 1000) {
      animationStart = timestamp;
    }

    animationFrame = requestAnimationFrame(animate);
  }

  /* ---------- ЗАПУСК ---------- */

  function start(rhythmId) {
    if (!RHYTHMS[rhythmId]) {
      throw new Error("Невідомий ЕКГ-ритм: " + rhythmId);
    }

    stop();

    currentRhythm = rhythmId;
    active = true;
    animationStart = null;

    layer.style.display = "block";
    editor.style.display = editorEnabled ? "block" : "none";

    resizeCanvas();

    animationFrame = requestAnimationFrame(animate);
  }

  /* ---------- ЗУПИНКА ---------- */

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

  /* ---------- РЕДАКТОР ---------- */

  function setEditorEnabled(enabled) {
    editorEnabled = Boolean(enabled);

    editor.style.display =
      editorEnabled ? "block" : "none";

    if (!editorEnabled && !active) {
      layer.style.display = "none";
    }
  }

  editor.addEventListener("pointerdown", event => {
    if (!editorEnabled) return;

    event.preventDefault();

    const rect = deviceWrap.getBoundingClientRect();

    dragging = {
      resize: event.target === resizeHandle,
      startX: event.clientX,
      startY: event.clientY,
      original: { ...layout },
      rect
    };

    editor.setPointerCapture(event.pointerId);
  });

  editor.addEventListener("pointermove", event => {
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
        1,
        Math.min(100 - layout.x, original.w + dx)
      );

      layout.h = Math.max(
        1,
        Math.min(100 - layout.y, original.h + dy)
      );
    } else {
      layout.x = Math.max(
        0,
        Math.min(100 - layout.w, original.x + dx)
      );

      layout.y = Math.max(
        0,
        Math.min(100 - layout.h, original.y + dy)
      );
    }

    applyLayout();
  });

  function finishEditing() {
    if (!dragging) return;

    dragging = null;
    saveLayout();
    resizeCanvas();
  }

  editor.addEventListener("pointerup", finishEditing);
  editor.addEventListener("pointercancel", finishEditing);

  /* ---------- МАСШТАБ ---------- */

  function setScale(value) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError("Некоректний масштаб ЕКГ.");
    }

    layout.scale = value;
    saveLayout();
    updateCoordinates();
  }

  function setAmplitude(value) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError("Некоректна амплітуда ЕКГ.");
    }

    layout.amplitude = value;
    saveLayout();
    updateCoordinates();
  }

  function getLayout() {
    return { ...layout };
  }

  function getRhythms() {
    return Object.fromEntries(
      Object.entries(RHYTHMS).map(([id, rhythm]) => [
        id,
        { ...rhythm }
      ])
    );
  }

  /* ---------- ІНІЦІАЛІЗАЦІЯ ---------- */

  applyLayout();

  window.addEventListener("resize", () => {
    if (active) resizeCanvas();
  });

  return {
    start,
    stop,
    setEditorEnabled,
    setScale,
    setAmplitude,
    getLayout,
    getRhythms
  };
}

