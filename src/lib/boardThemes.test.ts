import { describe, expect, it } from "vitest";
import { BOARD_THEME_OPTIONS, BOARD_THEME_STYLES, resolveBoardTheme } from "./boardThemes";

describe("board theme definitions", () => {
  it("defaults missing/unsupported values to Neutral", () => {
    expect(resolveBoardTheme(null)).toBe("neutral");
    expect(resolveBoardTheme(undefined)).toBe("neutral");
    expect(resolveBoardTheme("invalid")).toBe("neutral");
  });

  it("provides unique choices with light and dark tokens", () => {
    const values = BOARD_THEME_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(resolveBoardTheme(value)).toBe(value);
      const style = BOARD_THEME_STYLES[value];
      expect(style.surface).toContain("dark:");
      expect(style.border).toContain("dark:");
      expect(style.track).toContain("dark:");
      expect(style.bar).toContain("dark:");
      expect(style.divider).toContain("dark:");
      expect(style.previewAccent).toMatch(/^#[\da-f]{6}$/i);
    }
  });
});
