import { ChartPie, Gauge, SlidersHorizontal } from "@lucide/vue";

export const APP_TABS = Object.freeze([
  Object.freeze({
    value: "usage",
    label: "余量",
    component: ChartPie,
    icon: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 2.07c3.61.45 6.48 3.33 6.93 6.93H13V4.07zM4 12c0-4.06 3.07-7.44 7-7.93v15.87c-3.93-.5-7-3.88-7-7.94zm9 7.93V13h6.93A8.002 8.002 0 0 1 13 19.93z",
    viewport: 24,
  }),
  Object.freeze({
    value: "speed",
    label: "测速",
    component: Gauge,
    icon: "m20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44z M10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z",
    viewport: 24,
  }),
  Object.freeze({
    value: "settings",
    label: "设置",
    component: SlidersHorizontal,
    icon: "M10 6h9v2h-9z M10 7a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M8.5 7a1.5 1.5 0 1 0-3 0a1.5 1.5 0 1 0 3 0 M5 16h9v2H5z M20 17a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M18.5 17a1.5 1.5 0 1 0-3 0a1.5 1.5 0 1 0 3 0",
    viewport: 24,
  }),
]);

export const APP_TAB_VALUES = Object.freeze(APP_TABS.map(({ value }) => value));
export const DEFAULT_APP_TAB = APP_TAB_VALUES[0];

const appTabValueSet = new Set(APP_TAB_VALUES);

export function isAppTab(value) {
  return appTabValueSet.has(value);
}
