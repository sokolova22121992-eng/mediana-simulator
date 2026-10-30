
/**
 * MEDIANA D500 Simulator
 * Керування перемикачем режимів і живленням.
 */

import {
  getState,
  setPower,
  setMode,
  setMessage
} from "./device-state.js";

export const MODES = {
  OFF: "off",
  MONITOR: "monitor",
  MANUAL: "manual",
  AED: "aed",
  PACING: "pacing"
};

export const MODE_NAMES = {
  off: "ВИМКНЕНО",
  monitor: "МОНІТОРИНГ",
  manual: "РУЧНИЙ РЕЖИМ",
  aed: "АВТОМАТИЧНА ДЕФІБРИЛЯЦІЯ",
  pacing: "КАРДІОСТИМУЛЯЦІЯ"
};

/**
 * Повертає пристрій у вимкнений стан.
 */
export function turnOff() {
  setPower(false);

  return getState();
}

/**
 * Вибирає режим роботи пристрою.
 */
export function selectMode(mode) {
  if (!Object.values(MODES).includes(mode)) {
    throw new Error("Невідомий режим: " + mode);
  }

  // Положення OFF
  if (mode === MODES.OFF) {
    return turnOff();
  }

  // Перевіряємо живлення
  const state = getState();

  // Перехід із OFF автоматично вмикає пристрій
  if (!state.power) {
    setPower(true);
  }

  // Встановлюємо вибраний режим
  setMode(mode);

  setMessage(
    "Пристрій увімкнений. Режим: " + MODE_NAMES[mode]
  );

  return getState();
}

/**
 * Інформація про поточний режим.
 */
export function getCurrentMode() {
  const state = getState();

  return {
    power: state.power,
    mode: state.mode,
    name: MODE_NAMES[state.mode] || "Невідомий режим"
  };
}
