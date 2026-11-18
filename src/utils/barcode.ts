import JsBarcode from 'jsbarcode';

export function renderCode128ToCanvas(
  canvas: HTMLCanvasElement,
  code: string
): void {
  JsBarcode(canvas, code.trim() || '69001', {
    format: 'CODE128',
    lineColor: '#0f172a',
    background: '#ffffff',
    width: 2.5,
    height: 84,
    displayValue: true,
    font: 'IBM Plex Mono, monospace',
    fontSize: 18,
    textMargin: 6,
    margin: 14,
  });
}

export function downloadBarcodePng(code: string, productName?: string): void {
  const cleanCode = code.trim() || '69001';
  const barcodeCanvas = document.createElement('canvas');
  renderCode128ToCanvas(barcodeCanvas, cleanCode);

  const paddingX = 24;
  const topTitleHeight = productName?.trim() ? 36 : 12;
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = Math.max(barcodeCanvas.width + paddingX * 2, 320);
  finalCanvas.height = barcodeCanvas.height + topTitleHeight + 16;

  const ctx = finalCanvas.getContext('2d');
  if (!ctx) return;

  // Clean white card background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  if (productName?.trim()) {
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 16px "IBM Plex Sans Thai", "Prompt", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxTextWidth = finalCanvas.width - 28;
    ctx.fillText(productName.trim(), finalCanvas.width / 2, 24, maxTextWidth);
  }

  const barcodeX = (finalCanvas.width - barcodeCanvas.width) / 2;
  ctx.drawImage(barcodeCanvas, barcodeX, topTitleHeight);

  const dataUrl = finalCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `barcode_${cleanCode}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
