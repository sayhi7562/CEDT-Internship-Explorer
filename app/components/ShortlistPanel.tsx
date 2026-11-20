"use client";

import { useState } from "react";

import type { InternSession } from "@/app/lib/intern-transform";
import type { JobListing } from "@/app/lib/jobs";

import {
  formatMonthlyCompensation,
  getCompetitionBadge,
  getWorkingConditionBadgeClass,
} from "./JobDetailModal";

type ShortlistPanelProps = {
  shortlistedJobs: JobListing[];
  session: InternSession | null;
  activeSessionIdForLinks: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (jobId: number) => void;
  onClearAll: () => void;
  onOpenDetail: (job: JobListing) => void;
};

export default function ShortlistPanel({
  shortlistedJobs,
  session,
  activeSessionIdForLinks,
  onMoveUp,
  onMoveDown,
  onRemove,
  onClearAll,
  onOpenDetail,
}: ShortlistPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (shortlistedJobs.length === 0) {
    return null;
  }

  const minApps = session?.minimumApplicationPerStudent ?? 1;
  const maxApps = session?.maximumApplicationPerStudent ?? 5;
  const minUniqueCompanies =
    session?.minimumUniqueCompanyCountPerStudent ?? 1;

  const totalPicked = shortlistedJobs.length;
  const uniqueCompanyCount = new Set(
    shortlistedJobs.map((job) => job.companyId ?? job.companyNamePrimary),
  ).size;

  const appCountStatusClass =
    totalPicked > maxApps
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : totalPicked >= minApps
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-800";

  const uniqueCompanyStatusClass =
    uniqueCompanyCount >= minUniqueCompanies
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              รายการที่เล็งไว้ / จำลองจัดอันดับ ({totalPicked})
            </h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              บันทึกลงเบราว์เซอร์อัตโนมัติ
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            ลองเรียงลำดับความสำคัญ เปรียบเทียบค่าตอบแทนและการแข่งขัน
            และตรวจสอบเกณฑ์ของ Pool ก่อนไปจัดอันดับจริงในเว็บคณะ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            ล้าง Shortlist
          </button>
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((prev) => !prev)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            {isExpanded ? "พับรายการ ▲" : "กางรายการ ▼"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${appCountStatusClass}`}
        >
          จำนวนอันดับ: {totalPicked} / ขั้นต่ำ {minApps} (สูงสุด {maxApps}) อันดับ
          {totalPicked > maxApps ? " — เกินจำนวนสูงสุด" : ""}
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${uniqueCompanyStatusClass}`}
        >
          บริษัทไม่ซ้ำ: {uniqueCompanyCount} / ขั้นต่ำ {minUniqueCompanies} บริษัท
        </span>
      </div>

      {isExpanded && (
        <ul className="mt-4 flex flex-col gap-3">
          {shortlistedJobs.map((job, index) => {
            const competition = getCompetitionBadge(
              job.quota,
              job.inStudentDraftCount,
            );
            const jobSessionId = job.sessionId ?? activeSessionIdForLinks;
            const openingUrl = `https://cedtintern.cp.eng.chula.ac.th/opening/${job.id}/session/${jobSessionId}`;
            const isUnpaid =
              job.compensationTypeLabel === "ไม่มีค่าตอบแทน" ||
              job.monthlyCompensation === 0;
            const isPaid = !isUnpaid && job.monthlyCompensation != null;

            return (
              <li
                key={job.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => onMoveUp(index)}
                        disabled={index === 0}
                        aria-label={`เลื่อนอันดับ ${job.title} ขึ้น`}
                        className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveDown(index)}
                        disabled={index === shortlistedJobs.length - 1}
                        aria-label={`เลื่อนอันดับ ${job.title} ลง`}
                        className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(job)}
                        className="truncate text-left text-sm font-semibold text-zinc-900 hover:text-blue-700"
                      >
                        {job.title}
                      </button>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          job.openForCooperativeInternship
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-white text-zinc-600"
                        }`}
                      >
                        {job.openForCooperativeInternship ? "Co-op" : "ปกติ"}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getWorkingConditionBadgeClass(
                          job.workingConditionCategory,
                        )}`}
                      >
                        {job.workingConditionDisplay}
                      </span>
                    </div>
                    <span className="truncate text-xs text-zinc-600">
                      {job.companyNamePrimary}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                  <div className="flex flex-col items-start md:items-end">
                    <span
                      className={`text-sm font-semibold ${
                        isPaid ? "text-emerald-700" : "text-zinc-700"
                      }`}
                    >
                      {formatMonthlyCompensation(
                        job.monthlyCompensation,
                        job.compensationTypeLabel,
                      )}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <span>
                        รับ {job.quota ?? "-"} • เลือก{" "}
                        {job.inStudentDraftCount ?? 0}
                      </span>
                      {competition && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${competition.className}`}
                        >
                          {competition.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={openingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      เว็บคณะ ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemove(job.id)}
                      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
