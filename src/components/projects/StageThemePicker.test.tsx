import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StageThemePicker } from "./StageThemePicker";
describe("stage theme picker",()=>{
  it("renders named colour avatars and current selection",()=>{
    const html=renderToStaticMarkup(createElement(StageThemePicker,{value:"forest",onChange:()=>{}}));
    expect(html).toContain('aria-label="Stage theme"');
    expect(html).toContain('aria-label="Forest"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Ocean");
    expect(html).toContain("#10B981");
  });
});