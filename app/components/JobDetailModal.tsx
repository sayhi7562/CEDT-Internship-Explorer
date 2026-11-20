"use client";

import { useEffect } from "react";

import type { JobListing } from "@/app/lib/jobs";

export const RICH_HTML_CLASSES =
  "text-sm leading-relaxed text-zinc-700 [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-zinc-900 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-zinc-900 [&_h3]:mt-2.5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_h4]:mt-2.5 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-zinc-900 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_li.ql-indent-1]:ml-5 [&_li.ql-indent-2]:ml-10 [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-zinc-800 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-700 [&_strong]:font-semibold [&_strong]:text-zinc-900";

export function getWorkingConditionBadgeClass(
  category: JobListing["workingConditionCategory"],
): string {
  switch (category) {
    case "Hybrid":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "Online":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "On-Site":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-600";
  }
}

export function formatCurrency(value: number): string {
  return `${value.toLocaleString("th-TH")}`;
}

export function formatMonthlyCompensation(
  value: number | null,
  typeLabel: string | null,
): string {
  if (typeLabel === "ไม่มีค่าตอบแทน" || value === 0) {
    return "ไม่มีค่าตอบแทน";
  }

  if (value == null) {
    return "ไม่ระบุ";
  }

  return `${formatCurrency(Math.round(value))} บาท/เดือน`;
}

export function formatShortDateUtc7(
  isoString: string | null | undefined,
): string | null {
  if (!isoString) {
    return null;
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatInternshipPeriod(
  startIso: string | null,
  endIso: string | null,
): string | null {
  const start = formatShortDateUtc7(startIso);
  const end = formatShortDateUtc7(endIso);
  if (start && end) {
    return `${start} – ${end}`;
  }
  if (start) {
    return `เริ่ม ${start}`;
  }
  if (end) {
    return `สิ้นสุด ${end}`;
  }
  return null;
}

export function extractFirstUrl(
  text: string | null | undefined,
): string | null {
  if (!text) {
    return null;
  }
  const match = text.match(/https?:\/\/[^\s)<>]+/i);
  if (!match) {
    return null;
  }
  return match[0].replace(/[.,;]+$/, "");
}

export function normalizeExternalUrl(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

export function getCompetitionBadge(
  quota: number | null,
  draftCount: number | null,
): { label: string; className: string } | null {
  if (quota == null || quota <= 0) {
    return null;
  }
  const count = draftCount ?? 0;
  if (count === 0) {
    return {
      label: "ยังไม่มีคนเลือก",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  const ratio = count / quota;
  const formattedRatio = Number.isInteger(ratio)
    ? `${ratio}x`
    : `${ratio.toFixed(1)}x`;

  if (ratio < 1) {
    return {
      label: `แข่งขันต่ำ (${formattedRatio})`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (ratio < 2) {
    return {
      label: `แข่งขันปานกลาง (${formattedRatio})`,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: `แข่งขันสูง (${formattedRatio})`,
    className: "border-rose-200 bg-rose-50 text-rose-700",
  };
}

export function TextWithLinks({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)<>]+)/gi);
  return (
    <span className="whitespace-pre-line break-words">
      {parts.map((part, index) => {
        if (/^https?:\/\//i.test(part)) {
          const cleanUrl = part.replace(/[.,;]+$/, "");
          const trailing = part.slice(cleanUrl.length);
          return (
            <span key={`${cleanUrl}-${index}`}>
              <a
                href={cleanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-700"
              >
                {cleanUrl}
              </a>
              {trailing}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

type JobDetailModalProps = {
  job: JobListing | null;
  activeSessionIdForLinks: number;
  selectedTags: string[];
  isShortlisted: boolean;
  shortlistRank?: number | null;
  onClose: () => void;
  onToggleTag: (tag: string) => void;
  onToggleShortlist: (jobId: number) => void;
};

export default function JobDetailModal({
  job,
  activeSessionIdForLinks,
  selectedTags,
  isShortlisted,
  shortlistRank,
  onClose,
  onToggleTag,
  onToggleShortlist,
}: JobDetailModalProps) {
  useEffect(() => {
    if (!job) {
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
  }, [job, onClose]);

  if (!job) {
    return null;
  }

  const jobSessionId = job.sessionId ?? activeSessionIdForLinks;
  const openingUrl = `https://cedtintern.cp.eng.chula.ac.th/opening/${job.id}/session/${jobSessionId}`;
  const periodLabel = formatInternshipPeriod(job.startDateIso, job.endDateIso);
  const mapUrl =
    extractFirstUrl(job.officeAddressLine2) ??
    extractFirstUrl(job.officeAddressLine1);
  const competition = getCompetitionBadge(job.quota, job.inStudentDraftCount);
  const isUnpaid =
    job.compensationTypeLabel === "ไม่มีค่าตอบแทน" ||
    job.monthlyCompensation === 0;
  const isPaid = !isUnpaid && job.monthlyCompensation != null;
  const isDailyCompensation =
    job.compensationTypeLabel != null &&
    (job.compensationTypeLabel.includes("วัน") ||
      job.compensationTypeLabel.toLowerCase().includes("day"));
  const websiteUrl = normalizeExternalUrl(job.companyWebsite);
  const facebookUrl = normalizeExternalUrl(job.companyFacebook);
  const hasSeparateDetailContact =
    Boolean(job.detailContact) && job.detailContact !== job.recruitmentContact;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-detail-modal-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-zinc-600">
                {job.companyNamePrimary}
              </span>
              {job.companyNameSecondary && (
                <span className="text-xs text-zinc-400">
                  {job.companyNameSecondary}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="job-detail-modal-title"
                className="text-xl font-semibold text-zinc-900"
              >
                {job.title}
              </h2>
              {job.isBookmarked && (
                <span
                  className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800"
                  title="Bookmarked on CEDT"
                >
                  ★ Bookmark
                </span>
              )}
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  job.openForCooperativeInternship
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 bg-zinc-50 text-zinc-600"
                }`}
              >
                {job.openForCooperativeInternship
                  ? "สหกิจศึกษา (Co-op)"
                  : "ฝึกงานปกติ"}
              </span>
              {(!job.isAcceptingApplication || job.quota === 0) && (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                  ปิดรับสมัคร
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างรายละเอียด"
            className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/70 px-6 py-3">
          <button
            type="button"
            onClick={() => onToggleShortlist(job.id)}
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              isShortlisted
                ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {isShortlisted
              ? `★ เล็งไว้แล้ว${shortlistRank ? ` (อันดับ #${shortlistRank})` : ""} — กดเพื่อเอาออก`
              : "☆ เก็บไว้จัดอันดับ (Shortlist)"}
          </button>

          <a
            href={openingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            เปิดหน้าตำแหน่งบนเว็บคณะ ↗
          </a>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5">
              <span className="block text-xs text-zinc-500">
                ค่าตอบแทนโดยประมาณ
              </span>
              <span
                className={`mt-1 block text-base font-semibold ${
                  isPaid ? "text-emerald-700" : "text-zinc-700"
                }`}
              >
                {formatMonthlyCompensation(
                  job.monthlyCompensation,
                  job.compensationTypeLabel,
                )}
              </span>
              {!isUnpaid &&
                job.compensationAmount != null &&
                job.compensationTypeLabel && (
                  <span className="block text-xs text-zinc-500">
                    {formatCurrency(job.compensationAmount)}{" "}
                    {job.compensationTypeLabel}
                    {isDailyCompensation ? " (×20 วัน)" : ""}
                  </span>
                )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5">
              <span className="block text-xs text-zinc-500">
                รูปแบบการทำงาน
              </span>
              <span
                className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-sm font-medium ${getWorkingConditionBadgeClass(
                  job.workingConditionCategory,
                )}`}
              >
                {job.workingConditionDisplay}
              </span>
              {job.location && (
                <span className="mt-1 block text-xs text-zinc-500">
                  {job.location}
                </span>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5">
              <span className="block text-xs text-zinc-500">
                โควตา & ความนิยมใน Draft
              </span>
              <span className="mt-1 block text-base font-semibold text-zinc-900">
                รับ {job.quota != null ? job.quota.toLocaleString("th-TH") : "-"}{" "}
                • เลือก {job.inStudentDraftCount?.toLocaleString("th-TH") ?? "0"}
              </span>
              {competition && (
                <span
                  className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${competition.className}`}
                >
                  {competition.label}
                </span>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5">
              <span className="block text-xs text-zinc-500">
                ช่วงเวลาฝึกงาน
              </span>
              <span className="mt-1 block text-sm font-semibold text-zinc-900">
                {periodLabel ?? "ไม่ระบุในระบบ"}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-400">
                openingId: {job.id}
              </span>
            </div>
          </div>

          {job.tags.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-500">
                แท็กที่เกี่ยวข้อง (คลิกเพื่อกรอง)
              </span>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag) => {
                  const isActiveTag = selectedTags.some(
                    (selected) => selected.toLowerCase() === tag.toLowerCase(),
                  );
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggleTag(tag)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        isActiveTag
                          ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                          : "border-zinc-200 bg-zinc-100 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-200/70"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {job.descriptionHtml && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">
                รายละเอียดตำแหน่งงาน
              </h3>
              <div
                className={RICH_HTML_CLASSES}
                dangerouslySetInnerHTML={{ __html: job.descriptionHtml }}
              />
            </div>
          )}

          {job.requirementsHtml && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-200/70 bg-amber-50/50 p-4">
              <h3 className="text-sm font-semibold text-amber-950">
                คุณสมบัติและเงื่อนไขเพิ่มเติม
              </h3>
              <div
                className={RICH_HTML_CLASSES}
                dangerouslySetInnerHTML={{ __html: job.requirementsHtml }}
              />
            </div>
          )}

          <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  สถานที่ปฏิบัติงาน
                </h4>
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    เปิด Google Maps ↗
                  </a>
                )}
              </div>
              {job.officeName && (
                <p className="font-medium text-zinc-900">{job.officeName}</p>
              )}
              {job.officeAddressLine1 && (
                <p className="text-xs leading-relaxed text-zinc-600">
                  <TextWithLinks text={job.officeAddressLine1} />
                </p>
              )}
              {job.officeAddressLine2 && (
                <p className="text-xs leading-relaxed text-zinc-600">
                  <TextWithLinks text={job.officeAddressLine2} />
                </p>
              )}
              {!job.officeName &&
                !job.officeAddressLine1 &&
                !job.officeAddressLine2 && (
                  <p className="text-xs text-zinc-500">ไม่ระบุที่อยู่</p>
                )}
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                ช่องทางติดต่อและลิงก์บริษัท
              </h4>
              {job.recruitmentContact && (
                <div className="text-xs leading-relaxed text-zinc-700">
                  <span className="block font-medium text-zinc-900">
                    ติดต่อสมัครงาน / HR:
                  </span>
                  <TextWithLinks text={job.recruitmentContact} />
                </div>
              )}
              {hasSeparateDetailContact && job.detailContact && (
                <div className="text-xs leading-relaxed text-zinc-700">
                  <span className="block font-medium text-zinc-900">
                    ติดต่อสอบถามรายละเอียดตำแหน่ง:
                  </span>
                  <TextWithLinks text={job.detailContact} />
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Website ↗
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Facebook ↗
                  </a>
                )}
                {job.companyLine && (
                  <span className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700">
                    LINE: {job.companyLine}
                  </span>
                )}
              </div>
              {!job.recruitmentContact &&
                !hasSeparateDetailContact &&
                !websiteUrl &&
                !facebookUrl &&
                !job.companyLine && (
                  <p className="text-xs text-zinc-500">
                    ไม่มีข้อมูลติดต่อเพิ่มเติม
                  </p>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
