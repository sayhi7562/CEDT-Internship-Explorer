"use client";

import { useEffect } from "react";

type CookieGuideModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CookieGuideModal({
  isOpen,
  onClose,
}: CookieGuideModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-guide-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2
            id="cookie-guide-title"
            className="text-lg font-semibold text-zinc-900"
          >
            วิธีคัดลอก Cookie จากเว็บฝึกงานคณะ
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างแนะนำวิธีดู Cookie"
            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-6">
          <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-sm leading-relaxed text-zinc-700">
            <li>
              เปิดเว็บ{" "}
              <a
                href="https://cedtintern.cp.eng.chula.ac.th"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 underline hover:text-blue-700"
              >
                cedtintern.cp.eng.chula.ac.th ↗
              </a>{" "}
              และเข้าสู่ระบบให้เรียบร้อย
            </li>
            <li>
              กดปุ่ม{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800">
                F12
              </code>{" "}
              (หรือคลิกขวาแล้วเลือก <strong>Inspect / ตรวจสอบ</strong>)
              จากนั้นไปที่แท็บ <strong>Network</strong>
            </li>
            <li>
              รีเฟรชหน้าเว็บ 1 ครั้ง แล้วคลิกที่รายการ Request แรกๆ (เช่น{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800">
                sessions
              </code>{" "}
              หรือ{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800">
                openings
              </code>
              )
            </li>
            <li>
              ดูที่หัวข้อ <strong>Request Headers</strong> คัดลอกค่าของ{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800">
                cookie
              </code>{" "}
              มาวางในช่องกรอก Cookie ของเว็บนี้ (หากคัดลอกคำว่า{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800">
                cookie:
              </code>{" "}
              ติดมาด้วย ระบบจะตัดออกให้อัตโนมัติ)
            </li>
          </ol>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                ภาพตัวอย่างตำแหน่ง Cookie ใน DevTools
              </span>
              <a
                href="/howtogetcookie.png"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                เปิดภาพขนาดเต็ม ↗
              </a>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/howtogetcookie.png"
                alt="ภาพตัวอย่างวิธีคัดลอก Cookie จาก DevTools"
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-zinc-200 bg-zinc-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  );
}
