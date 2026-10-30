
/**
 * MEDIANA D500 Simulator
 * Центральний модуль стану пристрою.
 *
 * Відповідає за:
 * - зберігання стану пристрою;
 * - оновлення стану;
 * - повідомлення іншим модулям про зміни.
 *
 * Не містить логіки конкретних кнопок.
 */

const initialState = {
  power: false,
  mode: "off",

  energy: null,

  charging: false,
  charged: false,

  message: "Пристрій вимкнений"
};

let state = { ...initialState };

const listeners = new Set();

/**
 * Повертає поточний стан.
 */
export function getState() {
  return Object.freeze({ ...state });
}

/**
 * Підписка на зміни стану.
 */
export function subscribe(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Callback має бути функцією");
  }

  listeners.add(callback);

  // Одразу передаємо актуальний стан
  callback(getState());

  // Повертаємо функцію відписки
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Повідомляє всі підключені модулі про зміни.
 */
function notify() {
  const snapshot = getState();

  listeners.forEach(callback => {
    callback(snapshot);
  });
}

/**
 * Оновлює стан пристрою.
 */
function updateState(changes) {
  state = {
    ...state,
    ...changes
  };

  notify();

  return getState();
}

/**
 * Увімкнення або вимкнення живлення.
 */
export function setPower(enabled) {
  if (typeof enabled !== "boolean") {
    throw new TypeError("Стан живлення має бути true або false");
  }

  if (!enabled) {
    return updateState({
      power: false,
      mode: "off",
      charging: false,
      charged: false,
      message: "Пристрій вимкнений"
    });
  }

  return updateState({
    power: true,
    message: "Пристрій увімкнений"
  });
}

/**
 * Встановлення режиму роботи.
 * Конкретні дозволені режими визначатимуться
 * окремим модулем керування режимами.
 */
export function setMode(mode) {
  if (typeof mode !== "string" || !mode.trim()) {
    throw new TypeError("Необхідно вказати режим");
  }

  if (!state.power && mode !== "off") {
    throw new Error("Неможливо змінити режим: пристрій вимкнений");
  }

  return updateState({
    mode,
    message: `Режим пристрою: ${mode}`
  });
}

/**
 * Встановлення вибраної енергії.
 */
export function setEnergy(value) {
  if (value !== null && (!Number.isFinite(value) || value <= 0)) {
    throw new RangeError("Некоректне значення енергії");
  }

  return updateState({
    energy: value
  });
}

/**
 * Оновлення стану заряджання.
 */
export function setCharging(enabled) {
  if (!state.power && enabled) {
    throw new Error("Пристрій вимкнений");
  }

  return updateState({
    charging: enabled,
    charged: enabled ? false : state.charged
  });
}

/**
 * Позначення завершеного заряджання.
 */
export function setCharged(enabled) {
  if (!state.power && enabled) {
    throw new Error("Пристрій вимкнений");
  }

  return updateState({
    charging: false,
    charged: enabled
  });
}

/**
 * Повідомлення для інтерфейсу.
 */
export function setMessage(message) {
  return updateState({
    message: String(message)
  });
}

/**
 * Скидання до початкового стану.
 */
export function resetDeviceState() {
  state = { ...initialState };
  notify();

  return getState();
}
