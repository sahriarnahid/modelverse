export const defaultTheme = "hackerman";

export const themes = [
  { id: "hackerman", name: "Hackerman", scheme: "dark", bg: "#0b0c16", brand: "#82fb9c" },
  { id: "lumon", name: "Lumon", scheme: "dark", bg: "#16242d", brand: "#8bc9eb" },
  { id: "tokyo-night", name: "Tokyo Night", scheme: "dark", bg: "#1a1b26", brand: "#9ece6a" },
  { id: "catppuccin", name: "Catppuccin", scheme: "dark", bg: "#1e1e2e", brand: "#89b4fa" },
  { id: "gruvbox", name: "Gruvbox", scheme: "dark", bg: "#282828", brand: "#7daea3" },
  { id: "nord", name: "Nord", scheme: "dark", bg: "#2e3440", brand: "#81a1c1" },
  { id: "vantablack", name: "Vantablack", scheme: "dark", bg: "#000000", brand: "#8d8d8d" },
  { id: "rose-pine", name: "Rosé Pine", scheme: "light", bg: "#faf4ed", brand: "#56949f" },
  { id: "catppuccin-latte", name: "Latte", scheme: "light", bg: "#eff1f5", brand: "#1e66f5" },
  { id: "white", name: "White", scheme: "light", bg: "#ffffff", brand: "#6e6e6e" },
];

export const themeIds = themes.map((theme) => theme.id);
export const darkThemeIds = themes
  .filter((theme) => theme.scheme === "dark")
  .map((theme) => theme.id);
export const lightThemeIds = themes
  .filter((theme) => theme.scheme === "light")
  .map((theme) => theme.id);
