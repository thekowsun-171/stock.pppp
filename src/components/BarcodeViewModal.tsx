import React, { useEffect, useRef } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { Product } from '../types/inventory';
import { downloadBarcodePng, renderCode128ToCanvas } from '../utils/barcode';
import { formatCurrency } from '../utils/format';

interface BarcodeViewModalProps {
  product: Product | null;
  onClose: () => void;
}

export const BarcodeViewModal: React.FC<BarcodeViewModalProps> = ({
  product,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!product || !canvasRef.current) return;
    renderCode128ToCanvas(canvasRef.current, product.code);
  }, [product]);

  if (!product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="no-print flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <h3 className="font-display text-xl font-semibold text-slate-900">
            บาร์โค้ด 1D (Code-128)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Label Area */}
        <div className="mt-5 flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-lg font-semibold text-slate-900">{product.name}</p>
          <p className="mt-0.5 text-base text-slate-600">
            {product.category} · ฿{formatCurrency(product.unitPrice)} / {product.unit}
          </p>
          <div className="mt-4 overflow-x-auto">
            <canvas ref={canvasRef} className="mx-auto max-w-full" />
          </div>
        </div>

        <div className="no-print mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="h-5 w-5" />
            <span>พิมพ์บาร์โค้ด</span>
          </button>
          <button
            type="button"
            onClick={() => downloadBarcodePng(product.code, product.name)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-base font-semibold text-white hover:bg-brand-900 whitespace-nowrap"
          >
            <Download className="h-5 w-5" />
            <span>ดาวน์โหลด .PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
