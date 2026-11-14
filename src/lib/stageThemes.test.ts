import { describe, expect, it } from "vitest";
import { STAGE_THEME_OPTIONS, STAGE_THEME_STYLES, resolveStageTheme } from "./stageThemes";

describe("stage theme definitions", () => {
  it("defaults missing/unsupported values to Neutral", () => {
    expect(resolveStageTheme(null)).toBe("neutral");
    expect(resolveStageTheme(undefined)).toBe("neutral");
    expect(resolveStageTheme("invalid")).toBe("neutral");
  });

  it("provides unique choices with light and dark tokens", () => {
    const values = STAGE_THEME_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(resolveStageTheme(value)).toBe(value);
      const style = STAGE_THEME_STYLES[value];
      expect(style.surface).toContain("dark:");
      expect(style.border).toContain("dark:");
      expect(style.track).toContain("dark:");
      expect(style.bar).toContain("dark:");
      expect(style.divider).toContain("dark:");
      expect(style.previewAccent).toMatch(/^#[\da-f]{6}$/i);
    }
  });
});
