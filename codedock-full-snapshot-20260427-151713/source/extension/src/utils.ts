export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>): void => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };
}

// --- Throttle ---
// Fires at most once per `interval` ms
// Ignores calls that arrive too soon

export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  interval: number,
): (...args: Parameters<T>) => void {
  let lastFired = 0;

  return (...args: Parameters<T>): void => {
    const now = Date.now();
    if (now - lastFired >= interval) {
      lastFired = now;
      fn(...args);
    }
  };
}

// --- URL Join ---
// Safely joins a base URL and a path
// Prevents double slashes

export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

// --- Stable Color From User ID ---
// Deterministically derives a hex color from any string
// Same user ID always produces the same color

export function colorFromUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // convert to 32-bit integer
  }

  const r = (hash >> 16) & 0xff;
  const g = (hash >> 8) & 0xff;
  const b = hash & 0xff;

  // ensure minimum brightness — avoid colors too dark to see
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness < 80) {
    return colorFromUserId(userId + "_");
  }

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// --- Safe Dispose ---
// Calls dispose on an object if it exists
// Prevents errors when disposing optional resources

export function safeDispose(
  disposable: { dispose(): void } | null | undefined,
): void {
  try {
    disposable?.dispose();
  } catch {
    // ignore disposal errors
  }
}
