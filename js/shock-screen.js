

import {
  subscribe
} from "./device-state.js";

export function createShockScreen({
  deviceWrap,
  image = "mediana-schock.PNG"
} = {}) {
  if (!deviceWrap) {
    throw new Error("Не знайдено область deviceWrap.");
  }

  const elements = {};

  function createElement(id, className, position) {
    const element = document.createElement("div");

    element.className = className;
    element.style.position = "absolute";
    element.style.boxSizing = "border-box";
    element.style.left = position.x + "%";
    element.style.top = position.y + "%";
    element.style.width = position.width + "%";
    element.style.height = position.height + "%";
    element.style.display = "none";
    element.style.zIndex = "16";

    deviceWrap.appendChild(element);
    elements[id] = element;

    return element;
  }

  function applyTextStyle(element, position) {
    const rect = deviceWrap.getBoundingClientRect();

    const frameWidth = rect.width * position.width / 100;
    const frameHeight = rect.height * position.height / 100;

    const fontSize = Math.max(
      4,
      Math.min(frameHeight * 0.8, frameWidth / 5)
    );

    Object.assign(element.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#ffcc00",
      fontFamily: "Arial, sans-serif",
      fontWeight: "bold",
      textAlign: "center",
      whiteSpace: "nowrap",
      textShadow: "0 1px 3px #000000",
      overflow: "hidden",
      userSelect: "none"
    });

    element.style.setProperty(
      "font-size",
      fontSize + "px",
      "important"
    );
  }

  function show(energy, positions) {
    if (!Number.isFinite(energy) || !positions) return;

    hide();

    const screen = createElement(
      "screen",
      "shock-screen-image",
      positions.screen
    );

    const img = document.createElement("img");
    img.src = image;
    img.alt = "Екран готовності до розряду MEDIANA";
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
    screen.style.display = "block";

    const mainEnergy = createElement(
      "mainEnergy",
      "shock-main-energy",
      positions.mainEnergy
    );

    mainEnergy.textContent = `${energy} J`;
    applyTextStyle(mainEnergy, positions.mainEnergy);

    const smallEnergy = createElement(
      "smallEnergy",
      "shock-small-energy",
      positions.smallEnergy
    );

    smallEnergy.textContent = `${energy} J`;
    applyTextStyle(smallEnergy, positions.smallEnergy);
  }

  function hide() {
    Object.values(elements).forEach(element => {
      element.remove();
    });

    Object.keys(elements).forEach(key => {
      delete elements[key];
    });
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
    destroy
  };
}
