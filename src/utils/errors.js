export function createAbortError(message = "操作已取消") {
  try {
    return new DOMException(message, "AbortError");
  } catch {
    const error = new Error(message);
    error.name = "AbortError";
    return error;
  }
}

export function getErrorMessage(error, fallback = "操作失败") {
  return error?.message ? String(error.message) : fallback;
}
