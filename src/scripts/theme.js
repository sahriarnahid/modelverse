import { themeIds } from "../data/themes.js";

const STORAGE_KEY = "modelverse-theme";

function syncThemeLinks(theme) {
  document.querySelectorAll("[data-theme-link]").forEach((el) => {
    el.classList.toggle("active", el.dataset.themeLink === theme);
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  syncThemeLinks(theme);
}

function cycleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = themeIds[(themeIds.indexOf(current) + 1) % themeIds.length];
  setTheme(next);
}

function isTyping() {
  const el = document.activeElement;
  return (
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  );
}

export function initTheme() {
  document.querySelectorAll("[data-theme-link]").forEach((el) => {
    el.addEventListener("click", () => setTheme(el.dataset.themeLink));
  });

  document
    .querySelector("[data-theme-cycle]")
    ?.addEventListener("click", cycleTheme);

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping()) return;
    if (event.key.toLowerCase() === "t") {
      event.preventDefault();
      cycleTheme();
    }
  });

  syncThemeLinks(document.documentElement.dataset.theme);
}
