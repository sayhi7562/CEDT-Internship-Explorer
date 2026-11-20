"use client";

import { useEffect, useMemo, useState } from "react";

import {
  collectTagsFromJobs,
  type InternOpeningsMeta,
  type InternSession,
  type InternSessionRound,
} from "@/app/lib/intern-transform";
import type { JobListing } from "@/app/lib/jobs";

type Job = JobListing;

type WorkingConditionCategory = JobListing["workingConditionCategory"];
type CoopFilter = "all" | "coop" | "non-coop";

const DEFAULT_SESSION_ID = 9;

const WORKING_CONDITION_OPTIONS: {
  label: string;
  value: WorkingConditionCategory;
}[] = [
  { label: "On-site", value: "On-Site" },
  { label: "Online", value: "Online" },
  { label: "Hybrid", value: "Hybrid" },
  { label: "Other", value: "Unspecified" },
];

const COOP_FILTER_OPTIONS: { label: string; value: CoopFilter }[] = [
  { label: "ทั้งหมด", value: "all" },
  { label: "รับสหกิจศึกษา (Co-op)", value: "coop" },
  { label: "ฝึกงานทั่วไป (ไม่สหกิจ)", value: "non-coop" },
];

const RICH_HTML_CLASSES =
  "text-sm leading-relaxed text-zinc-700 [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-zinc-900 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-zinc-900 [&_h3]:mt-2.5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_h4]:mt-2.5 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-zinc-900 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_li.ql-indent-1]:ml-5 [&_li.ql-indent-2]:ml-10 [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-zinc-800 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-700 [&_strong]:font-semibold [&_strong]:text-zinc-900";

function formatCurrency(value: number): string {
  return `${value.toLocaleString("th-TH")}`;
}

function formatMonthlyCompensation(
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

function formatSessionLabel(session: InternSession): string {
  return `${session.title} ${session.sessionGroupTitle}`.trim();
}

function formatDateTimeUtc7(isoString: string | null | undefined): string {
  if (!isoString) {
    return "ไม่มี / ไม่ระบุ";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "ไม่ระบุ";
  }

  const formatted = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  return `${formatted} น. (UTC+7)`;
}

function formatShortDateUtc7(
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

function formatInternshipPeriod(
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

function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const match = text.match(/https?:\/\/[^\s)<>]+/i);
  if (!match) {
    return null;
  }
  return match[0].replace(/[.,;]+$/, "");
}

function normalizeExternalUrl(url: string | null | undefined): string | null {
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

function getCompanyInitials(primary: string, secondary: string | null): string {
  const candidate = (secondary ?? primary)
    .replace(/^บริษัท\s+/u, "")
    .replace(/^ธนาคาร\s*/u, "")
    .trim();
  if (!candidate) {
    return "?";
  }
  return candidate.slice(0, 2).toUpperCase();
}

function getCompetitionBadge(
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

function buildFilterableJobs(
  jobs: Job[],
  selectedTag: string,
  selectedWorkingConditions: WorkingConditionCategory[],
  coopFilter: CoopFilter,
  searchQuery: string,
  onlyBookmarked: boolean,
  onlyAcceptingApplication: boolean,
  sortOrder: "asc" | "desc",
  sortMode: "compensation" | "title" | "popularity",
): Job[] {
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const hasQuery = trimmedQuery.length > 0;
  const hasTag = selectedTag.length > 0;
  const hasCondition = selectedWorkingConditions.length > 0;

  const filtered = jobs.filter((job) => {
    if (
      onlyAcceptingApplication &&
      (!job.isAcceptingApplication || !job.isPublished || job.quota === 0)
    ) {
      return false;
    }
    if (onlyBookmarked && !job.isBookmarked) {
      return false;
    }
    if (coopFilter === "coop" && !job.openForCooperativeInternship) {
      return false;
    }
    if (coopFilter === "non-coop" && job.openForCooperativeInternship) {
      return false;
    }

    const matchesTag = hasTag
      ? job.tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())
      : true;

    const matchesCondition = hasCondition
      ? selectedWorkingConditions.includes(job.workingConditionCategory)
      : true;

    const matchesQuery = hasQuery
      ? [
          job.title,
          job.companyNamePrimary,
          job.companyNameSecondary ?? "",
          job.tags.join(" "),
          job.officeName ?? "",
          job.officeAddressLine1 ?? "",
          job.officeAddressLine2 ?? "",
          job.location ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(trimmedQuery)
      : true;

    return matchesTag && matchesCondition && matchesQuery;
  });

  if (sortMode === "title") {
    return filtered.sort((a, b) =>
      sortOrder === "desc"
        ? b.title.localeCompare(a.title, "th-TH")
        : a.title.localeCompare(b.title, "th-TH"),
    );
  }

  if (sortMode === "popularity") {
    return filtered.sort((a, b) => {
      const aCount = a.inStudentDraftCount ?? 0;
      const bCount = b.inStudentDraftCount ?? 0;

      if (aCount === bCount) {
        return a.title.localeCompare(b.title, "th-TH");
      }

      return sortOrder === "desc" ? bCount - aCount : aCount - bCount;
    });
  }

  return filtered.sort((a, b) => {
    const aComp = a.monthlyCompensation;
    const bComp = b.monthlyCompensation;

    const aHasComp = aComp != null;
    const bHasComp = bComp != null;

    if (aHasComp && !bHasComp) {
      return -1;
    }

    if (!aHasComp && bHasComp) {
      return 1;
    }

    if (!aHasComp && !bHasComp) {
      return a.title.localeCompare(b.title, "th-TH");
    }

    if (aComp === bComp) {
      return a.title.localeCompare(b.title, "th-TH");
    }

    return sortOrder === "desc"
      ? (bComp as number) - (aComp as number)
      : (aComp as number) - (bComp as number);
  });
}

function CompanyLogo({
  logoUrl,
  primaryName,
  secondaryName,
}: {
  logoUrl: string | null;
  primaryName: string;
  secondaryName: string | null;
}) {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={primaryName}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-12 w-12 shrink-0 rounded-xl border border-zinc-200 bg-white object-contain p-1"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-600"
    >
      {getCompanyInitials(primaryName, secondaryName)}
    </div>
  );
}

function TextWithLinks({ text }: { text: string }) {
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

function JobCard({
  job,
  activeSessionIdForLinks,
  selectedTag,
  onSelectTag,
}: {
  job: Job;
  activeSessionIdForLinks: number;
  selectedTag: string;
  onSelectTag: (tag: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const jobSessionId = job.sessionId ?? activeSessionIdForLinks;
  const openingUrl = `https://cedtintern.cp.eng.chula.ac.th/opening/${job.id}/session/${jobSessionId}`;
  const periodLabel = formatInternshipPeriod(
    job.startDateIso,
    job.endDateIso,
  );
  const mapUrl =
    extractFirstUrl(job.officeAddressLine2) ??
    extractFirstUrl(job.officeAddressLine1);
  const competition = getCompetitionBadge(job.quota, job.inStudentDraftCount);
  const isUnpaid =
    job.compensationTypeLabel === "ไม่มีค่าตอบแทน" ||
    job.monthlyCompensation === 0;
  const isDailyCompensation =
    job.compensationTypeLabel != null &&
    (job.compensationTypeLabel.includes("วัน") ||
      job.compensationTypeLabel.toLowerCase().includes("day"));
  const websiteUrl = normalizeExternalUrl(job.companyWebsite);
  const facebookUrl = normalizeExternalUrl(job.companyFacebook);
  const hasSeparateDetailContact =
    Boolean(job.detailContact) &&
    job.detailContact !== job.recruitmentContact;

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <CompanyLogo
            key={job.logoUrl ?? `fallback-${job.id}`}
            logoUrl={job.logoUrl}
            primaryName={job.companyNamePrimary}
            secondaryName={job.companyNameSecondary}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-2">
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
              <a
                href={openingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl font-semibold text-zinc-900 transition-colors hover:text-blue-700"
              >
                {job.title}
              </a>

              <span
                className="inline-flex items-center"
                aria-label={job.isBookmarked ? "Bookmarked" : "Not bookmarked"}
                title={job.isBookmarked ? "Bookmarked" : "Not bookmarked"}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={job.isBookmarked ? "#facc15" : "#ffffff"}
                  stroke={job.isBookmarked ? "#facc15" : "#d1d5db"}
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M12 3.5l2.9 5.88 6.5.95-4.7 4.58 1.1 6.47L12 18.7l-5.8 3.08 1.1-6.47-4.7-4.58 6.5-.95L12 3.5z" />
                </svg>
              </span>

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
              {!job.isPublished && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  ยังไม่เผยแพร่
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-zinc-600">
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                {job.workingConditionDisplay}
              </span>
              {job.location && (
                <>
                  <span className="text-zinc-300">•</span>
                  <span className="min-w-0 break-words">{job.location}</span>
                </>
              )}
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  แผนที่ ↗
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-600">
              {job.quota != null && (
                <span>
                  รับ{" "}
                  <strong className="font-semibold text-zinc-900">
                    {job.quota.toLocaleString("th-TH")}
                  </strong>{" "}
                  คน
                </span>
              )}
              <span>
                มีคนเลือกใน Draft{" "}
                <strong className="font-semibold text-zinc-900">
                  {job.inStudentDraftCount?.toLocaleString("th-TH") ?? "0"}
                </strong>{" "}
                คน
              </span>
              {competition && (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${competition.className}`}
                >
                  {competition.label}
                </span>
              )}
              {periodLabel && (
                <span className="text-zinc-500">ช่วงฝึกงาน: {periodLabel}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start md:items-end">
          <span className="text-xs font-medium text-zinc-500">
            ค่าตอบแทนโดยประมาณ
          </span>
          <span
            className={`text-lg font-semibold ${
              isUnpaid ? "text-zinc-600" : "text-zinc-900"
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
              <span className="text-xs text-zinc-500">
                อัตราตั้งต้น: {formatCurrency(job.compensationAmount)}{" "}
                {job.compensationTypeLabel}
                {isDailyCompensation ? " (×20 วัน)" : ""}
              </span>
            )}
        </div>
      </div>

      {!isExpanded && job.descriptionSnippet && (
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          {job.descriptionSnippet}
        </p>
      )}

      {!isExpanded && job.requirementsSnippet && (
        <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3.5 py-2 text-xs text-amber-900">
          <span className="font-semibold">เงื่อนไขเพิ่มเติม: </span>
          {job.requirementsSnippet}
        </div>
      )}

      {job.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {job.tags.map((tag) => {
            const isActiveTag =
              selectedTag.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(isActiveTag ? "" : tag)}
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
      )}

      {isExpanded && (
        <div className="mt-5 flex flex-col gap-5 border-t border-zinc-100 pt-5">
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
            <div className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                สถานที่ปฏิบัติงาน
              </h4>
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
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                  >
                    Website ↗
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Facebook ↗
                  </a>
                )}
                {job.companyLine && (
                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    LINE: {job.companyLine}
                  </span>
                )}
              </div>
              {!job.recruitmentContact &&
                !hasSeparateDetailContact &&
                !websiteUrl &&
                !facebookUrl &&
                !job.companyLine && (
                  <p className="text-xs text-zinc-500">ไม่มีข้อมูลติดต่อเพิ่มเติม</p>
                )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100"
        >
          {isExpanded
            ? "ซ่อนรายละเอียดเต็ม ▲"
            : "ดูรายละเอียดเต็ม / คุณสมบัติ / ช่องทางติดต่อ ▼"}
        </button>

        <a
          href={openingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-zinc-900 transition-colors hover:text-blue-700"
        >
          ดูหน้าตำแหน่งบนเว็บคณะ ↗
        </a>
      </div>
    </li>
  );
}

const JobBoard = () => {
  const [cookieValue, setCookieValue] = useState<string>("");
  const [sessions, setSessions] = useState<InternSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null,
  );
  const [loadedSessionId, setLoadedSessionId] = useState<number | null>(null);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(
    null,
  );
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [remoteJobs, setRemoteJobs] = useState<Job[] | null>(null);
  const [remoteTags, setRemoteTags] = useState<string[] | null>(null);
  const [remoteMeta, setRemoteMeta] = useState<InternOpeningsMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedWorkingConditions, setSelectedWorkingConditions] = useState<
    WorkingConditionCategory[]
  >([]);
  const [coopFilter, setCoopFilter] = useState<CoopFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [onlyAcceptingApplication, setOnlyAcceptingApplication] =
    useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortMode, setSortMode] = useState<
    "compensation" | "title" | "popularity"
  >("compensation");

  const selectedSession = useMemo(
    () =>
      sessions.find((session) => session.sessionId === selectedSessionId) ??
      null,
    [sessions, selectedSessionId],
  );

  const activeLoadedSession = useMemo(
    () =>
      sessions.find(
        (session) =>
          session.sessionId === (loadedSessionId ?? selectedSessionId),
      ) ?? selectedSession,
    [sessions, loadedSessionId, selectedSessionId, selectedSession],
  );

  const displayedRound: InternSessionRound | null = useMemo(() => {
    if (!selectedSession) {
      return null;
    }
    const targetRound = selectedRoundNumber ?? selectedSession.currentRound;
    const found = selectedSession.rounds?.find(
      (item) => item.round === targetRound,
    );
    if (found) {
      return found;
    }
    return {
      round: selectedSession.currentRound,
      openingSubmissionDeadline: selectedSession.openingSubmissionDeadline,
      openingAnnouncementDate: selectedSession.openingAnnouncementDate,
      studentRankingDeadline: selectedSession.studentRankingDeadline,
      applicationAnnouncementDate: selectedSession.applicationAnnouncementDate,
      companyRankingDeadline: selectedSession.companyRankingDeadline,
      resultAnnouncementDate: selectedSession.resultAnnouncementDate,
      reorderRankingDeadline: selectedSession.reorderRankingDeadline,
      cancelRankingDeadline: selectedSession.cancelRankingDeadline,
    };
  }, [selectedSession, selectedRoundNumber]);

  const maxApplicationsPerStudent = useMemo(() => {
    const count = activeLoadedSession?.maximumApplicationPerStudent;
    return count && count > 0 ? count : 5;
  }, [activeLoadedSession]);

  const activeSessionIdForLinks =
    loadedSessionId ?? selectedSessionId ?? DEFAULT_SESSION_ID;

  const activeJobs = useMemo(() => remoteJobs ?? [], [remoteJobs]);
  const activeTags = useMemo(() => {
    if (remoteTags) {
      return remoteTags;
    }
    return collectTagsFromJobs(activeJobs);
  }, [activeJobs, remoteTags]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of activeJobs) {
      if (
        onlyAcceptingApplication &&
        (!job.isAcceptingApplication || !job.isPublished || job.quota === 0)
      ) {
        continue;
      }
      for (const tag of job.tags) {
        const key = tag.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [activeJobs, onlyAcceptingApplication]);

  const displayJobs = useMemo(
    () =>
      buildFilterableJobs(
        activeJobs,
        selectedTag,
        selectedWorkingConditions,
        coopFilter,
        searchQuery,
        onlyBookmarked,
        onlyAcceptingApplication,
        sortOrder,
        sortMode,
      ),
    [
      activeJobs,
      selectedTag,
      selectedWorkingConditions,
      coopFilter,
      searchQuery,
      onlyBookmarked,
      onlyAcceptingApplication,
      sortOrder,
      sortMode,
    ],
  );

  const totalQuota = useMemo(
    () =>
      activeJobs.reduce((sum, job) => {
        if (!job.isAcceptingApplication || !job.isPublished) {
          return sum;
        }
        return sum + (job.quota ?? 0);
      }, 0),
    [activeJobs],
  );

  const totalSelected = useMemo(
    () =>
      activeJobs.reduce((sum, job) => sum + (job.inStudentDraftCount ?? 0), 0),
    [activeJobs],
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedTag.length > 0 ||
    selectedWorkingConditions.length > 0 ||
    coopFilter !== "all" ||
    onlyBookmarked ||
    !onlyAcceptingApplication;

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedTag("");
    setSelectedWorkingConditions([]);
    setCoopFilter("all");
    setOnlyBookmarked(false);
    setOnlyAcceptingApplication(true);
  };

  useEffect(() => {
    setLoadError(null);
  }, []);

  useEffect(() => {
    if (selectedSession) {
      setSelectedRoundNumber(selectedSession.currentRound);
    } else {
      setSelectedRoundNumber(null);
    }
  }, [selectedSession]);

  useEffect(() => {
    if (
      selectedTag &&
      !activeTags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())
    ) {
      setSelectedTag("");
    }
  }, [activeTags, selectedTag]);

  const loadSessions = async () => {
    const trimmedCookie = cookieValue.trim();
    if (!trimmedCookie) {
      setLoadError("กรุณากรอก cookie ก่อนดึงรายการ Pool");
      return;
    }

    setIsLoadingSessions(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cookie: trimmedCookie }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ??
            `ดึงรายการ Pool ไม่สำเร็จ (HTTP ${response.status})`,
        );
      }

      const payload = (await response.json()) as {
        sessions: InternSession[];
      };

      const fetchedSessions = payload.sessions ?? [];
      setSessions(fetchedSessions);

      if (fetchedSessions.length === 0) {
        setSelectedSessionId(null);
        setLoadError("ไม่พบรายการ Pool จากระบบ");
        return;
      }

      const stillExists = fetchedSessions.some(
        (item) => item.sessionId === selectedSessionId,
      );
      if (!stillExists) {
        const latestSession = fetchedSessions[fetchedSessions.length - 1];
        setSelectedSessionId(latestSession.sessionId);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "ดึงรายการ Pool ไม่สำเร็จ",
      );
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadRemoteJobs = async () => {
    const trimmedCookie = cookieValue.trim();
    if (!trimmedCookie) {
      setLoadError("กรุณากรอก cookie ก่อนโหลดข้อมูล");
      return;
    }

    if (selectedSessionId == null) {
      setLoadError("กรุณาเลือก Pool ก่อนโหลดข้อมูลตำแหน่งงาน");
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/intern", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookie: trimmedCookie,
          sessionId: selectedSessionId,
          onlyAvailablePositions: false,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ?? `โหลดข้อมูลไม่สำเร็จ (HTTP ${response.status})`,
        );
      }

      const payload = (await response.json()) as {
        jobs: Job[];
        allTags: string[];
        meta?: InternOpeningsMeta | null;
        fetchedAt?: string | null;
      };

      setRemoteJobs(payload.jobs ?? []);
      setRemoteTags(payload.allTags ?? []);
      setRemoteMeta(payload.meta ?? null);
      setLoadedSessionId(selectedSessionId);
      setLastUpdated(payload.fetchedAt ?? null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWorkingCondition = (value: WorkingConditionCategory) => {
    setSelectedWorkingConditions((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  };

  return (
    <section className="flex flex-col gap-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-600">
                1. กรอก Cookie เพื่อดึงรายการ Pool
              </span>
              <span className="text-xs text-zinc-500">
                Cookie จะถูกใช้แค่ครั้งนี้และไม่ถูกบันทึกไว้
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={cookieValue}
                onChange={(event) => setCookieValue(event.target.value)}
                placeholder="กรอก cookie จากเบราว์เซอร์"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:min-w-[320px]"
              />
              <button
                type="button"
                onClick={loadSessions}
                disabled={isLoadingSessions || isLoading}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isLoadingSessions || isLoading
                    ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                }`}
              >
                {isLoadingSessions ? "กำลังดึง Pool..." : "ดึงรายการ Pool"}
              </button>
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-600">
                  2. เลือก Pool ที่ต้องการดูข้อมูล
                </span>
                <span className="text-xs text-zinc-500">
                  เลือก Pool แล้วกดโหลดข้อมูลตำแหน่งงาน
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  aria-label="เลือก Pool"
                  value={selectedSessionId ?? ""}
                  onChange={(event) =>
                    setSelectedSessionId(Number(event.target.value))
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:min-w-[240px]"
                >
                  {sessions.map((session) => (
                    <option key={session.sessionId} value={session.sessionId}>
                      {formatSessionLabel(session)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadRemoteJobs}
                  disabled={
                    isLoading || isLoadingSessions || selectedSessionId == null
                  }
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isLoading || isLoadingSessions || selectedSessionId == null
                      ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                      : "bg-zinc-900 text-white hover:bg-zinc-800"
                  }`}
                >
                  {isLoading ? "กำลังโหลดข้อมูล..." : "โหลดข้อมูลตำแหน่งงาน"}
                </button>
              </div>
            </div>
          )}
        </div>

        {loadError && (
          <span className="mt-3 block text-xs text-rose-600">{loadError}</span>
        )}
        {lastUpdated && (
          <span className="mt-2 block text-xs text-zinc-500">
            อัปเดตข้อมูลตำแหน่งงานล่าสุด:{" "}
            {new Date(lastUpdated).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
            })}{" "}
            (Pool:{" "}
            {activeLoadedSession
              ? formatSessionLabel(activeLoadedSession)
              : `Session ${activeSessionIdForLinks}`}
            {remoteMeta ? ` • จากระบบ ${remoteMeta.totalItem} รายการ` : ""})
          </span>
        )}
      </div>

      {selectedSession && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    ข้อมูล Pool: {formatSessionLabel(selectedSession)}
                  </h2>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                    sessionId: {selectedSession.sessionId}
                  </span>
                </div>
                {selectedSession.description && (
                  <p className="mt-1 text-sm text-zinc-600">
                    {selectedSession.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                  รอบปัจจุบัน: รอบที่ {selectedSession.currentRound}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    selectedSession.openForCooperativeInternship
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  }`}
                >
                  สหกิจศึกษา:{" "}
                  {selectedSession.openForCooperativeInternship
                    ? "เปิดรับ"
                    : "ไม่เปิดรับ"}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    selectedSession.isMatchingInitiated
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  สถานะการจับคู่:{" "}
                  {selectedSession.isMatchingInitiated
                    ? "เริ่มการจับคู่แล้ว"
                    : "ยังไม่เริ่มการจับคู่"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-700 sm:grid-cols-3">
              <div>
                <span className="block text-xs text-zinc-500">
                  จำนวนการสมัครขั้นต่ำต่อนิสิต
                </span>
                <span className="font-semibold text-zinc-900">
                  {selectedSession.minimumApplicationPerStudent} อันดับ
                </span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">
                  จำนวนการสมัครสูงสุดต่อนิสิต
                </span>
                <span className="font-semibold text-zinc-900">
                  {selectedSession.maximumApplicationPerStudent} อันดับ
                </span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">
                  จำนวนบริษัทไม่ซ้ำขั้นต่ำ
                </span>
                <span className="font-semibold text-zinc-900">
                  {selectedSession.minimumUniqueCompanyCountPerStudent} บริษัท
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-700">
                  กำหนดการของ Pool (เวลาไทย UTC+7)
                </span>
                {selectedSession.rounds && selectedSession.rounds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSession.rounds.map((roundItem) => {
                      const activeRound =
                        (selectedRoundNumber ?? selectedSession.currentRound) ===
                        roundItem.round;
                      return (
                        <button
                          key={roundItem.round}
                          type="button"
                          onClick={() =>
                            setSelectedRoundNumber(roundItem.round)
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            activeRound
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                          }`}
                        >
                          รอบที่ {roundItem.round}
                          {roundItem.round === selectedSession.currentRound
                            ? " (ปัจจุบัน)"
                            : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {displayedRound && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <span className="block text-xs text-zinc-500">
                      วันประกาศตำแหน่งงาน
                    </span>
                    <span className="mt-1 block text-sm font-medium text-zinc-900">
                      {formatDateTimeUtc7(
                        displayedRound.openingAnnouncementDate,
                      )}
                    </span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <span className="block text-xs text-zinc-500">
                      วันปิดรับส่งตำแหน่งงาน (บริษัท)
                    </span>
                    <span className="mt-1 block text-sm font-medium text-zinc-900">
                      {formatDateTimeUtc7(
                        displayedRound.openingSubmissionDeadline,
                      )}
                    </span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <span className="block text-xs text-zinc-500">
                      วันประกาศรายชื่อผู้สมัคร
                    </span>
                    <span className="mt-1 block text-sm font-medium text-zinc-900">
                      {formatDateTimeUtc7(
                        displayedRound.applicationAnnouncementDate,
                      )}
                    </span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <span className="block text-xs text-zinc-500">
                      วันปิดรับการจัดอันดับของนิสิต
                    </span>
                    <span className="mt-1 block text-sm font-medium text-zinc-900">
                      {formatDateTimeUtc7(
                        displayedRound.studentRankingDeadline,
                      )}
                    </span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <span className="block text-xs text-zinc-500">
                      วันปิดรับการปรับอันดับ (Reorder)
                    </span>
                    <span className="mt-1 block text-sm font-medium text-zinc-900">
                      {formatDateTimeUtc7(
                        displayedRound.reorderRankingDeadline,
                      )}
                    </span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <span className="block text-xs text-zinc-500">
                      วันปิดรับการยกเลิก/สละสิทธิ์
                    </span>
                    <span className="mt-1 block text-sm font-medium text-zinc-900">
                      {formatDateTimeUtc7(displayedRound.cancelRankingDeadline)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <span className="block text-xs text-zinc-500">
                      วันปิดรับการจัดอันดับของบริษัท
                    </span>
                    <span className="mt-1 block text-sm font-medium text-zinc-900">
                      {formatDateTimeUtc7(
                        displayedRound.companyRankingDeadline,
                      )}
                    </span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <span className="block text-xs text-zinc-500">
                      วันประกาศผลการจับคู่
                    </span>
                    <span className="mt-1 block text-sm font-medium text-zinc-900">
                      {formatDateTimeUtc7(
                        displayedRound.resultAnnouncementDate,
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2 md:items-end">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-600">
              ค้นหาตำแหน่ง บริษัท แท็ก หรือสถานที่
            </span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="พิมพ์คำค้น เช่น Software Engineer, BTS, Python..."
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-600">เลือกแท็ก</span>
            <select
              value={selectedTag}
              onChange={(event) => setSelectedTag(event.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            >
              <option value="">ทุกแท็ก</option>
              {activeTags.map((tag) => {
                const count = tagCounts.get(tag.toLowerCase());
                return (
                  <option key={tag} value={tag}>
                    {count != null ? `${tag} (${count})` : tag}
                  </option>
                );
              })}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-zinc-900"
                checked={onlyAcceptingApplication}
                onChange={(event) =>
                  setOnlyAcceptingApplication(event.target.checked)
                }
              />
              แสดงเฉพาะตำแหน่งที่เปิดรับสมัคร
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-yellow-400"
                checked={onlyBookmarked}
                onChange={(event) => setOnlyBookmarked(event.target.checked)}
              />
              แสดงเฉพาะตำแหน่งที่กด Bookmark
            </label>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-zinc-600">
              รูปแบบการทำงาน
            </span>
            <div className="flex flex-wrap gap-2">
              {WORKING_CONDITION_OPTIONS.map((option) => {
                const isActive = selectedWorkingConditions.includes(
                  option.value,
                );
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleWorkingCondition(option.value)}
                    className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-zinc-600">
              ประเภทสหกิจศึกษา (Co-op)
            </span>
            <div className="flex flex-wrap gap-2">
              {COOP_FILTER_OPTIONS.map((option) => {
                const isActive = coopFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCoopFilter(option.value)}
                    className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-600">
                รูปแบบการจัดเรียง
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSortMode("compensation")}
                className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                  sortMode === "compensation"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                ค่าตอบแทน
              </button>
              <button
                type="button"
                onClick={() => setSortMode("popularity")}
                className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                  sortMode === "popularity"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                จำนวนคนเลือก
              </button>
              <button
                type="button"
                onClick={() => setSortMode("title")}
                className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                  sortMode === "title"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                ตามชื่อตำแหน่ง
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSortOrder("desc")}
                className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                  sortOrder === "desc"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                {sortMode === "title"
                  ? "Z → A"
                  : sortMode === "popularity"
                    ? "มีคนเลือกจากมากไปน้อย"
                    : "สูงไปต่ำ (ต่อเดือน)"}
              </button>
              <button
                type="button"
                onClick={() => setSortOrder("asc")}
                className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                  sortOrder === "asc"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                {sortMode === "title"
                  ? "A → Z"
                  : sortMode === "popularity"
                    ? "มีคนเลือกจากน้อยไปมาก"
                    : "ต่ำไปสูง (ต่อเดือน)"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Quota รวม (รับกี่คน)
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {totalQuota.toLocaleString("th-TH")} คน
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            จำนวนคนใน pool รอบนี้ (นับจาก inStudentDraftCount รวมกันแล้วหารด้วย{" "}
            {maxApplicationsPerStudent})
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {(totalSelected / maxApplicationsPerStudent).toLocaleString(
              "th-TH",
              {
                maximumFractionDigits: 2,
              },
            )}{" "}
            คน
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">
          พบ {displayJobs.length.toLocaleString("th-TH")} ตำแหน่งจากทั้งหมด{" "}
          {activeJobs.length.toLocaleString("th-TH")} ตำแหน่ง
          {remoteMeta && remoteMeta.totalItem !== activeJobs.length
            ? ` (API totalItem: ${remoteMeta.totalItem.toLocaleString("th-TH")})`
            : ""}
        </p>

        {displayJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
            {activeJobs.length === 0 ? (
              <>
                <p className="text-sm font-medium text-zinc-600">
                  ยังไม่มีข้อมูลตำแหน่งงาน
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  กรุณาใส่ cookie กดดึงรายการ Pool แล้วเลือก Pool
                  เพื่อโหลดข้อมูลตำแหน่งงาน
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-zinc-600">
                  ไม่พบตำแหน่งที่ตรงกับเงื่อนไขที่เลือก
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  ลองปรับตัวกรองหรือค้นหาด้วยคำอื่น
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-6">
            {displayJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                activeSessionIdForLinks={activeSessionIdForLinks}
                selectedTag={selectedTag}
                onSelectTag={setSelectedTag}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default JobBoard;
