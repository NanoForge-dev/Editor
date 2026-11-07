/** Composes the canvases of the game (layers) into one PNG. */
export const captureGame = async (stage: HTMLElement): Promise<Blob | undefined> => {
  const canvases = [...stage.querySelectorAll('canvas')];
  if (!canvases.length) return undefined;
  const bounds = stage.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const output = document.createElement('canvas');
  output.width = Math.round(bounds.width * scale);
  output.height = Math.round(bounds.height * scale);
  const context = output.getContext('2d');
  if (!context) return undefined;
  for (const canvas of canvases) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    context.drawImage(
      canvas,
      (rect.left - bounds.left) * scale,
      (rect.top - bounds.top) * scale,
      rect.width * scale,
      rect.height * scale,
    );
  }
  return new Promise((resolve) => output.toBlob((blob) => resolve(blob ?? undefined), 'image/png'));
};

/** `screenshots/2026-09-27_14-03-05.png` */
export const screenshotPath = (date = new Date()): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `screenshots/${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.png`;
};
