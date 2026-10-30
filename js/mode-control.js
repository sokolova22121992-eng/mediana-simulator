
/**
 * MEDIANA D500 Simulator
 * Модуль керування режимами роботи.
 */

import {
  getState,
  setMode
} from "./device-state.js";

// Доступні режими симулятора
export const MODES = {
  OFF: "off",
  MONITOR: "monitor",
  MANUAL: "manual",
  AED: "aed",
  PACING: "pacing"
};

// Назви режимів для інтерфейсу
export const MODE_NAMES = {
  off: "OFF",
  monitor: "MONITOR",
  manual: "MANUAL",
  aed: "AED",
  pacing: "PACING"
};

/**
 * Перемикання режиму.
 */
export function selectMode(mode) {
  if (!Object.values(MODES).includes(mode)) {
    throw new Error("Невідомий режим: " + mode);
  }

  const state = getState();

  if (mode !== MODES.OFF && !state.power) {
    throw new Error("Спочатку потрібно увімкнути пристрій");
  }

  setMode(mode);

  return {
    success: true,
    mode,
    name: MODE_NAMES[mode]
  };
}

/**
 * Повертає інформацію про поточний режим.
 */
export function getCurrentMode() {
  const state = getState();

  return {
    mode: state.mode,
    name: MODE_NAMES[state.mode] || "Невідомий режим"
  };
}
