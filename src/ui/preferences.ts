export type UiTheme = "system" | "light" | "dark";
export type UiFontSize = "small" | "medium" | "large";

export const UI_THEME_KEY = "lingua-bridge.ui-theme";
export const UI_FONT_SIZE_KEY = "lingua-bridge.ui-font-size";

export function parseUiTheme(value: string | null): UiTheme {
  return value === "light" || value === "dark" ? value : "system";
}

export function parseUiFontSize(value: string | null): UiFontSize {
  return value === "small" || value === "large" ? value : "medium";
}
