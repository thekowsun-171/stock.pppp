import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Keyboard, RefreshCw, X } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  title = 'สแกนบาร์โค้ด / QR สินค้า',
  onClose,
  onDetected,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const detectedRef = useRef(false);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    detectedRef.current = false;
    setManualCode('');
    setCameraError(null);

    let cancelled = false;

    const initCamera = async () => {
      setIsStarting(true);
      try {
        const deviceList = await Html5Qrcode.getCameras();
        if (cancelled) return;

        if (!deviceList || deviceList.length === 0) {
          setCameraError('ไม่พบกล้องบนอุปกรณ์นี้ สามารถพิมพ์หรือใช้เครื่องยิงบาร์โค้ดกรอกด้านล่างได้');
          setIsStarting(false);
          return;
        }

        setCameras(deviceList);
        // Prefer back camera if available on first open
        const backIdx = deviceList.findIndex((c) =>
          /back|rear|environment/i.test(c.label)
        );
        const chosenIdx =
          activeCameraIdx < deviceList.length
            ? activeCameraIdx
            : backIdx >= 0
              ? backIdx
              : 0;

        const scanner = new Html5Qrcode('pp-barcode-reader');
        scannerRef.current = scanner;

        await scanner.start(
          deviceList[chosenIdx].id,
          {
            fps: 10,
            qrbox: { width: 260, height: 150 },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            if (detectedRef.current) return;
            detectedRef.current = true;
            const code = decodedText.trim();
            stopScanner().finally(() => {
              onDetected(code);
              onClose();
            });
          },
          () => {
            // Frame scan miss - normal during scanning
          }
        );
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : 'ไม่สามารถเปิดกล้องได้';
        setCameraError(
          `ไม่สามารถเปิดใช้งานกล้องได้ (${msg}) กรุณาอนุญาตสิทธิ์กล้องหรือกรอกรหัสบาร์โค้ดด้านล่าง`
        );
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    };

    const timer = setTimeout(initCamera, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeCameraIdx]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualCode.trim();
    if (!cleaned) return;
    stopScanner().finally(() => {
      onDetected(cleaned);
      onClose();
    });
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    setActiveCameraIdx((prev) => (prev + 1) % cameras.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Camera className="h-5 w-5 text-brand-800" />
            <h3 className="font-display text-xl font-semibold text-slate-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner().finally(onClose);
            }}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิดเครื่องสแกน"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1.5 text-base text-slate-600">
          ส่องกล้องไปยังบาร์โค้ดหรือ QR Code ของสินค้า หรือใช้เครื่องยิงบาร์โค้ด USB/Bluetooth
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
          <div id="pp-barcode-reader" className="min-h-[240px] w-full" />
        </div>

        {isStarting && (
          <p className="mt-2.5 text-center text-base text-slate-600">
            กำลังเปิดกล้อง...
          </p>
        )}

        {cameraError && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-base text-amber-900">
            {cameraError}
          </div>
        )}

        {cameras.length > 1 && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={switchCamera}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              <span>สลับกล้อง ({activeCameraIdx + 1}/{cameras.length})</span>
            </button>
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="mt-5 border-t border-slate-200 pt-4">
          <label
            htmlFor="manual-barcode-input"
            className="flex items-center gap-2 text-base font-medium text-slate-700"
          >
            <Keyboard className="h-4 w-4 text-slate-500" />
            <span>กรอกรหัสบาร์โค้ดหรือรหัสสินค้าด้วยตนเอง</span>
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="manual-barcode-input"
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="เช่น 8850123456789"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-base text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-800 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-900 whitespace-nowrap shrink-0"
            >
              ตกลง
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
