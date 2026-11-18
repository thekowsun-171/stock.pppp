import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { ConfirmDialogConfig } from '../types/inventory';

interface ConfirmDialogProps {
  config: ConfirmDialogConfig | null;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ config, onClose }) => {
  const [submitting, setSubmitting] = useState(false);

  if (!config || !config.isOpen) return null;

  const isDanger = config.variant === 'danger';

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await config.onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                isDanger
                  ? 'bg-red-50 text-red-700'
                  : 'bg-emerald-50 text-brand-800'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3
                id="confirm-dialog-title"
                className="font-display text-xl font-semibold text-slate-900"
              >
                {config.title}
              </h3>
              <p className="mt-1.5 text-base text-slate-600">
                {config.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {config.details && config.details.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <ul className="space-y-1.5 text-base text-slate-700">
              {config.details.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-base font-semibold text-white transition-colors whitespace-nowrap shrink-0 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                : 'bg-brand-800 hover:bg-brand-900 disabled:bg-brand-600'
            }`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{config.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
