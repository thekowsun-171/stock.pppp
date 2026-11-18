import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Loader2,
  PlusCircle,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { SpreadsheetInfo } from '../types/inventory';
import { extractSpreadsheetId, formatThaiShortDate } from '../utils/format';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  isSignedIn: boolean;
  userEmail: string | null;
  spreadsheet: SpreadsheetInfo | null;
  discoveredSheets: Array<{ id: string; name: string; modifiedTime?: string }>;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onGoogleLogin: () => void;
  onCreateNew: () => void;
  onSelectExisting: (id: string) => void;
  onRefreshList: () => void;
  onPushLocalToSheet: () => void;
  onPullSheetToLocal: () => void;
  onGoogleDisconnect: () => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  isSignedIn,
  userEmail,
  spreadsheet,
  discoveredSheets,
  isLoading,
  error,
  onClose,
  onGoogleLogin,
  onCreateNew,
  onSelectExisting,
  onRefreshList,
  onPushLocalToSheet,
  onPullSheetToLocal,
  onGoogleDisconnect,
}) => {
  const [sheetInput, setSheetInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    const id = extractSpreadsheetId(sheetInput);
    if (!id) {
      setInputError('ลิงก์หรือรหัส Google Sheet ไม่ถูกต้อง');
      return;
    }
    onSelectExisting(id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-6 w-6 text-brand-800" />
            <h2 className="font-display text-xl font-bold text-slate-900">
              เชื่อมต่อฐานข้อมูล Google Sheets
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-base text-slate-600">
          สำรองและซิงค์ข้อมูลชีต <span className="font-semibold text-slate-800">Products</span> และ{' '}
          <span className="font-semibold text-slate-800">Transactions</span>{' '}
          ไปยังบัญชี Google ของคุณโดยตรง เพื่อเข้าถึงข้อมูลได้จากทุกอุปกรณ์
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3.5 text-base text-red-800">
            {error}
          </div>
        )}

        {!isSignedIn ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-base text-slate-700">
              เข้าสู่ระบบด้วยบัญชี Google เพื่อเชื่อมต่อและบันทึกข้อมูลลงใน Google Sheets ของคุณ
            </p>
            <div className="mx-auto mt-5 max-w-xs">
              <GoogleSignInButton
                onClick={onGoogleLogin}
                disabled={isLoading}
                label={
                  isLoading
                    ? 'กำลังเชื่อมต่อ Google...'
                    : 'เชื่อมต่อด้วยบัญชี Google'
                }
              />
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
              <div className="flex items-center gap-2 text-base text-emerald-950">
                <CheckCircle2 className="h-5 w-5 text-brand-800" />
                <span>
                  เชื่อมต่อบัญชี: <span className="font-semibold">{userEmail}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onGoogleDisconnect}
                className="text-base font-medium text-red-700 hover:underline"
              >
                ยกเลิกการเชื่อมต่อ
              </button>
            </div>

            {spreadsheet && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">ไฟล์ที่เชื่อมต่ออยู่</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {spreadsheet.title}
                    </p>
                  </div>
                  <a
                    href={spreadsheet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-base font-medium text-brand-800 hover:bg-brand-50"
                  >
                    <span>เปิดใน Google Sheets</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onPullSheetToLocal}
                    disabled={isLoading}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>ดึงข้อมูลจาก Sheet</span>
                  </button>
                  <button
                    type="button"
                    onClick={onPushLocalToSheet}
                    disabled={isLoading}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-base font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
                  >
                    <UploadCloud className="h-4 w-4" />
                    <span>อัปโหลดข้อมูลทั้งหมดขึ้น Sheet</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  สร้างไฟล์ Google Sheet ใหม่
                </p>
                <p className="text-sm text-slate-600">
                  สร้างชีต Products และ Transactions พร้อมหัวตารางบัญชีอัตโนมัติ
                </p>
              </div>
              <button
                type="button"
                onClick={onCreateNew}
                disabled={isLoading}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                <span>สร้างไฟล์ใหม่</span>
              </button>
            </div>

            {discoveredSheets.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold text-slate-900">
                    เลือกไฟล์ที่มีอยู่ใน Google Drive
                  </p>
                  <button
                    type="button"
                    onClick={onRefreshList}
                    disabled={isLoading}
                    className="text-sm font-medium text-brand-800 hover:underline"
                  >
                    รีเฟรชรายการ
                  </button>
                </div>
                <div className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {discoveredSheets.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 p-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-slate-900">
                          {f.name}
                        </p>
                        {f.modifiedTime && (
                          <p className="text-sm text-slate-500">
                            อัปเดต: {formatThaiShortDate(f.modifiedTime.slice(0, 10))}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectExisting(f.id)}
                        disabled={isLoading}
                        className="rounded-lg border border-brand-800 px-3.5 py-1.5 text-base font-medium text-brand-800 hover:bg-brand-50 whitespace-nowrap shrink-0"
                      >
                        ใช้งานไฟล์นี้
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleConnectUrl} className="border-t border-slate-200 pt-4">
              <label className="flex items-center gap-2 text-base font-medium text-slate-800">
                <Link2 className="h-4 w-4 text-brand-800" />
                <span>เชื่อมต่อด้วยลิงก์ Google Sheet</span>
              </label>
              {inputError && (
                <p className="mt-1 text-sm text-red-700">{inputError}</p>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={sheetInput}
                  onChange={(e) => setSheetInput(e.target.value)}
                  placeholder="วาง URL ของ Google Sheet..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-base font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  เชื่อมต่อ
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
