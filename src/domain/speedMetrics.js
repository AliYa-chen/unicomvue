import { clamp } from "@/utils/number";

export const BYTES_PER_MEGABIT = 125_000;

export const SPEED_GAUGE_SCALE = Object.freeze([
  Object.freeze({ value: 0, label: "0" }),
  Object.freeze({ value: 5, label: "5" }),
  Object.freeze({ value: 10, label: "10" }),
  Object.freeze({ value: 20, label: "20" }),
  Object.freeze({ value: 50, label: "50" }),
  Object.freeze({ value: 100, label: "100" }),
  Object.freeze({ value: 200, label: "200" }),
  Object.freeze({ value: 500, label: "500" }),
  Object.freeze({ value: 1000, label: "1G" }),
  Object.freeze({ value: 2000, label: "2G" }),
  Object.freeze({ value: 5000, label: "5G" }),
]);

const BYTE_UNITS = Object.freeze(["B", "KiB", "MiB", "GiB", "TiB"]);
const BYTE_RATE_UNITS = Object.freeze(BYTE_UNITS.map((unit) => `${unit}/s`));

export function formatSpeed(value) {
  if (!Number.isFinite(value)) return "0.0";
  const fractionDigits = value >= 1000 ? 0 : 1;
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatByteRate(value) {
  return formatBinaryValue(value, BYTE_RATE_UNITS, true);
}

export function formatBytes(value) {
  return formatBinaryValue(value, BYTE_UNITS);
}

export function formatElapsedTime(value) {
  const numericValue = Number(value);
  const elapsedMs = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function mapSpeedToGaugeProgress(value) {
  const maximum = SPEED_GAUGE_SCALE.at(-1).value;
  const numericValue = Number(value);
  const speed = clamp(Number.isFinite(numericValue) ? numericValue : 0, 0, maximum);
  if (speed <= 0) return 0;

  for (let index = 1; index < SPEED_GAUGE_SCALE.length; index += 1) {
    const lower = SPEED_GAUGE_SCALE[index - 1].value;
    const upper = SPEED_GAUGE_SCALE[index].value;
    if (speed > upper) continue;
    const segment = upper === lower ? 0 : (speed - lower) / (upper - lower);
    return Number((
      ((index - 1 + segment) / (SPEED_GAUGE_SCALE.length - 1)) * 100
    ).toFixed(3));
  }

  return 100;
}

function formatBinaryValue(value, units, trimTrailingZero = false) {
  const numericValue = Number(value);
  const normalizedValue = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
  if (normalizedValue === 0) return `0 ${units[0]}`;

  const unitIndex = Math.min(
    units.length - 1,
    Math.max(0, Math.floor(Math.log(normalizedValue) / Math.log(1024))),
  );
  const amount = normalizedValue / (1024 ** unitIndex);
  const fractionDigits = unitIndex === 0
    ? 0
    : amount >= 100
      ? 0
      : amount >= 10
        ? 1
        : trimTrailingZero
          ? 2
          : 1;
  const formattedAmount = trimTrailingZero
    ? Number(amount.toFixed(fractionDigits))
    : amount.toFixed(fractionDigits);
  return `${formattedAmount} ${units[unitIndex]}`;
}
