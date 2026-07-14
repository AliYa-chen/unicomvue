import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HEADER_BACKDROP_MAX_PX,
  HEADER_BACKGROUND_MAX_PERCENT,
  HEADER_BORDER_MAX_PERCENT,
  HEADER_SCROLL_DISTANCE,
  getHeaderScrollProgress,
  getHeaderSurfaceStyle,
} from "../src/composables/useHeaderScrollSurface.js";

test("header scroll progress is continuous and clamped", () => {
  assert.equal(getHeaderScrollProgress(0), 0);
  assert.equal(getHeaderScrollProgress(HEADER_SCROLL_DISTANCE / 2), 0.5);
  assert.equal(getHeaderScrollProgress(HEADER_SCROLL_DISTANCE), 1);
  assert.equal(getHeaderScrollProgress(HEADER_SCROLL_DISTANCE * 2), 1);
  assert.equal(getHeaderScrollProgress(-10), 0);
  assert.equal(getHeaderScrollProgress(Number.NaN), 0);
});

test("header surface is fully transparent at the top", () => {
  assert.deepEqual(getHeaderSurfaceStyle(0), {
    "--header-background-mix": "0%",
    "--header-border-mix": "0%",
    "--header-backdrop-blur": "0px",
  });
});

test("header surface interpolates to its configured maxima", () => {
  assert.deepEqual(getHeaderSurfaceStyle(0.5), {
    "--header-background-mix": `${HEADER_BACKGROUND_MAX_PERCENT / 2}%`,
    "--header-border-mix": `${HEADER_BORDER_MAX_PERCENT / 2}%`,
    "--header-backdrop-blur": `${HEADER_BACKDROP_MAX_PX / 2}px`,
  });

  assert.deepEqual(getHeaderSurfaceStyle(2), {
    "--header-background-mix": `${HEADER_BACKGROUND_MAX_PERCENT}%`,
    "--header-border-mix": `${HEADER_BORDER_MAX_PERCENT}%`,
    "--header-backdrop-blur": `${HEADER_BACKDROP_MAX_PX}px`,
  });
});
