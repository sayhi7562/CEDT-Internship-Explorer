"use client";

import { useEffect, useMemo, useState } from "react";

import {
  collectTagsFromJobs,
  type InternOpeningsMeta,
  type InternSession,
  type InternSessionRound,
} from "@/app/lib/intern-transform";
import type { JobListing } from "@/app/lib/jobs";

import CookieGuideModal from "./CookieGuideModal";
import JobDetailModal, {
  extractFirstUrl,
  formatCurrency,
  formatInternshipPeriod,
  formatMonthlyCompensation,
  getCompetitionBadge,
  getWorkingConditionBadgeClass,
  normalizeExternalUrl,
  RICH_HTML_CLASSES,
  TextWithLinks,
} from "./JobDetailModal";
import ShortlistPanel from "./ShortlistPanel";

type Job = JobListing;

type WorkingConditionCategory = JobListing["workingConditionCategory"];
type CoopFilter = "all" | "coop" | "non-coop";
type SortMode = "compensation" | "popularity" | "competition" | "title";
type TagMatchMode = "any" | "all";

type CachedBoardData = {
  sessions: InternSession[];
  selectedSessionId: number | null;
  loadedSessionId: number | null;
  remoteJobs: Job[] | null;
  remoteTags: string[] | null;
  remoteMeta: InternOpeningsMeta | null;
  lastUpdated: string | null;
};

type CachedCookieData = {
  rememberCookie: boolean;
  cookieValue: string;
};

const DEFAULT_SESSION_ID = 9;
const CACHE_STORAGE_KEY = "cedt_explorer_cache_v1";
const COOKIE_STORAGE_KEY = "cedt_explorer_cookie_v1";
const SHORTLIST_STORAGE_KEY = "cedt_explorer_shortlist_v1";

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

const COMPENSATION_PRESETS: { label: string; value: number | null }[] = [
  { label: "ทั้งหมด", value: null },
  { label: "มีค่าตอบแทน (> 0)", value: 1 },
  { label: "≥ 5,000", value: 5000 },
  { label: "≥ 8,000", value: 8000 },
  { label: "≥ 10,000", value: 10000 },
  { label: "≥ 15,000", value: 15000 },
];

function sanitizeCookieInput(raw: string): string {
  let cleaned = raw.replace(/[\r\n\t]+/g, " ").trim();
  cleaned = cleaned.replace(/^cookie\s*:\s*/i, "").trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.replace(/^cookie\s*:\s*/i, "").trim();
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

function formatRelativeCountdown(targetMs: number, nowMs: number): string {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    return "ถึงกำหนดแล้ว";
  }
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `อีก ${days} วัน ${hours} ชม.`;
  }
  if (hours > 0) {
    return `อีก ${hours} ชม. ${minutes} นาที`;
  }
  if (minutes > 0) {
    return `อีก ${minutes} นาที`;
  }
  return "น้อยกว่า 1 นาที";
}

function buildFilterableJobs(
  jobs: Job[],
  selectedTags: string[],
  tagMatchMode: TagMatchMode,
  selectedWorkingConditions: WorkingConditionCategory[],
  coopFilter: CoopFilter,
  minCompensation: number | null,
  hideUnspecifiedCompensation: boolean,
  onlyLowCompetition: boolean,
  onlyShortlisted: boolean,
  shortlistSet: Set<number>,
  searchQuery: string,
  onlyBookmarked: boolean,
  onlyAcceptingApplication: boolean,
  sortOrder: "asc" | "desc",
  sortMode: SortMode,
): Job[] {
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const hasQuery = trimmedQuery.length > 0;
  const normalizedSelectedTags = selectedTags.map((t) => t.toLowerCase());
  const hasTags = normalizedSelectedTags.length > 0;
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
    if (onlyShortlisted && !shortlistSet.has(job.id)) {
      return false;
    }
    if (coopFilter === "coop" && !job.openForCooperativeInternship) {
      return false;
    }
    if (coopFilter === "non-coop" && job.openForCooperativeInternship) {
      return false;
    }
    if (hideUnspecifiedCompensation && job.monthlyCompensation == null) {
      return false;
    }
    if (
      minCompensation != null &&
      (job.monthlyCompensation == null ||
        job.monthlyCompensation < minCompensation)
    ) {
      return false;
    }
    if (
      onlyLowCompetition &&
      !(
        job.quota != null &&
        job.quota > 0 &&
        (job.inStudentDraftCount ?? 0) < job.quota
      )
    ) {
      return false;
    }

    let matchesTags = true;
    if (hasTags) {
      const jobTagSet = new Set(job.tags.map((tag) => tag.toLowerCase()));
      matchesTags =
        tagMatchMode === "all"
          ? normalizedSelectedTags.every((tag) => jobTagSet.has(tag))
          : normalizedSelectedTags.some((tag) => jobTagSet.has(tag));
    }

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
          job.descriptionSnippet,
          job.requirementsSnippet ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(trimmedQuery)
      : true;

    return matchesTags && matchesCondition && matchesQuery;
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

  if (sortMode === "competition") {
    return filtered.sort((a, b) => {
      const aHasRatio = a.quota != null && a.quota > 0;
      const bHasRatio = b.quota != null && b.quota > 0;

      if (aHasRatio && !bHasRatio) {
        return -1;
      }
      if (!aHasRatio && bHasRatio) {
        return 1;
      }
      if (!aHasRatio && !bHasRatio) {
        return a.title.localeCompare(b.title, "th-TH");
      }

      const aRatio = (a.inStudentDraftCount ?? 0) / (a.quota as number);
      const bRatio = (b.inStudentDraftCount ?? 0) / (b.quota as number);

      if (Math.abs(aRatio - bRatio) < 1e-9) {
        const quotaDiff = (b.quota ?? 0) - (a.quota ?? 0);
        if (quotaDiff !== 0) {
          return quotaDiff;
        }
        return a.title.localeCompare(b.title, "th-TH");
      }

      return sortOrder === "desc" ? bRatio - aRatio : aRatio - bRatio;
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

function JobCard({
  job,
  activeSessionIdForLinks,
  selectedTags,
  shortlistRank,
  onToggleTag,
  onToggleShortlist,
  onOpenModal,
}: {
  job: Job;
  activeSessionIdForLinks: number;
  selectedTags: string[];
  shortlistRank: number | null;
  onToggleTag: (tag: string) => void;
  onToggleShortlist: (jobId: number) => void;
  onOpenModal: (job: Job) => void;
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
  const isPaid = !isUnpaid && job.monthlyCompensation != null;
  const isDailyCompensation =
    job.compensationTypeLabel != null &&
    (job.compensationTypeLabel.includes("วัน") ||
      job.compensationTypeLabel.toLowerCase().includes("day"));
  const websiteUrl = normalizeExternalUrl(job.companyWebsite);
  const facebookUrl = normalizeExternalUrl(job.companyFacebook);
  const hasSeparateDetailContact =
    Boolean(job.detailContact) &&
    job.detailContact !== job.recruitmentContact;
  const isShortlisted = shortlistRank != null;

  return (
    <li
      className={`rounded-2xl border bg-white p-6 shadow-sm transition hover:border-zinc-300 ${
        isShortlisted ? "border-amber-300/80" : "border-zinc-200"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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
              <button
                type="button"
                onClick={() => onOpenModal(job)}
                className="text-left text-xl font-semibold text-zinc-900 transition-colors hover:text-blue-700"
              >
                {job.title}
              </button>

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
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getWorkingConditionBadgeClass(
                  job.workingConditionCategory,
                )}`}
              >
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
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
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

        <div className="flex shrink-0 flex-col items-start md:items-end">
          <span className="text-xs font-medium text-zinc-500">
            ค่าตอบแทนโดยประมาณ
          </span>
          <span
            className={`text-lg font-semibold ${
              isPaid ? "text-emerald-700" : "text-zinc-600"
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
        <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/50 px-3.5 py-2 text-xs text-amber-900">
          <span className="font-semibold">เงื่อนไขเพิ่มเติม: </span>
          {job.requirementsSnippet}
        </div>
      )}

      {job.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
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
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleShortlist(job.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              isShortlisted
                ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {isShortlisted
              ? `★ เล็งไว้แล้ว (#${shortlistRank})`
              : "☆ เก็บไว้จัดอันดับ"}
          </button>

          <button
            type="button"
            onClick={() => onOpenModal(job)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100"
          >
            อ่านรายละเอียดเต็ม (Modal)
          </button>

          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((prev) => !prev)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            {isExpanded ? "ย่อการ์ด ▲" : "กางในการ์ด ▼"}
          </button>
        </div>

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
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [cookieValue, setCookieValue] = useState<string>("");
  const [rememberCookie, setRememberCookie] = useState(false);
  const [showCookie, setShowCookie] = useState(false);
  const [isCookieGuideOpen, setIsCookieGuideOpen] = useState(false);

  const [sessions, setSessions] = useState<InternSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null,
  );
  const [loadedSessionId, setLoadedSessionId] = useState<number | null>(null);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(
    null,
  );
  const [isPoolInfoExpanded, setIsPoolInfoExpanded] = useState(true);

  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [remoteJobs, setRemoteJobs] = useState<Job[] | null>(null);
  const [remoteTags, setRemoteTags] = useState<string[] | null>(null);
  const [remoteMeta, setRemoteMeta] = useState<InternOpeningsMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>("any");
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [selectedWorkingConditions, setSelectedWorkingConditions] = useState<
    WorkingConditionCategory[]
  >([]);
  const [coopFilter, setCoopFilter] = useState<CoopFilter>("all");
  const [minCompensation, setMinCompensation] = useState<number | null>(null);
  const [hideUnspecifiedCompensation, setHideUnspecifiedCompensation] =
    useState(false);
  const [onlyLowCompetition, setOnlyLowCompetition] = useState(false);
  const [onlyShortlisted, setOnlyShortlisted] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [onlyAcceptingApplication, setOnlyAcceptingApplication] =
    useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortMode, setSortMode] = useState<SortMode>("compensation");

  const [shortlistBySession, setShortlistBySession] = useState<
    Record<string, number[]>
  >({});
  const [detailModalJobId, setDetailModalJobId] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const hydrateAndStartClock = () => {
      try {
        const rawCookie = window.localStorage.getItem(COOKIE_STORAGE_KEY);
        if (rawCookie) {
          const parsed = JSON.parse(rawCookie) as Partial<CachedCookieData>;
          if (parsed.rememberCookie) {
            setRememberCookie(true);
            if (typeof parsed.cookieValue === "string") {
              setCookieValue(parsed.cookieValue);
            }
          }
        }
      } catch {
        // Ignore malformed cookie storage
      }

      try {
        const rawCache = window.localStorage.getItem(CACHE_STORAGE_KEY);
        if (rawCache) {
          const parsed = JSON.parse(rawCache) as Partial<CachedBoardData>;
          if (Array.isArray(parsed.sessions)) {
            setSessions(parsed.sessions);
          }
          if (typeof parsed.selectedSessionId === "number") {
            setSelectedSessionId(parsed.selectedSessionId);
          }
          if (typeof parsed.loadedSessionId === "number") {
            setLoadedSessionId(parsed.loadedSessionId);
          }
          if (Array.isArray(parsed.remoteJobs)) {
            setRemoteJobs(parsed.remoteJobs);
          }
          if (Array.isArray(parsed.remoteTags)) {
            setRemoteTags(parsed.remoteTags);
          }
          if (parsed.remoteMeta !== undefined) {
            setRemoteMeta(parsed.remoteMeta);
          }
          if (typeof parsed.lastUpdated === "string") {
            setLastUpdated(parsed.lastUpdated);
          }
        }
      } catch {
        // Ignore malformed board cache
      }

      try {
        const rawShortlist = window.localStorage.getItem(SHORTLIST_STORAGE_KEY);
        if (rawShortlist) {
          const parsed = JSON.parse(rawShortlist) as Record<string, unknown>;
          if (parsed && typeof parsed === "object") {
            const validated: Record<string, number[]> = {};
            for (const [key, value] of Object.entries(parsed)) {
              if (Array.isArray(value)) {
                validated[key] = value.filter(
                  (id): id is number => typeof id === "number",
                );
              }
            }
            setShortlistBySession(validated);
          }
        }
      } catch {
        // Ignore malformed shortlist storage
      }

      setHasHydratedStorage(true);
      setNowMs(Date.now());
    };

    const timeoutId = window.setTimeout(hydrateAndStartClock, 0);
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }
    try {
      const payload: CachedBoardData = {
        sessions,
        selectedSessionId,
        loadedSessionId,
        remoteJobs,
        remoteTags,
        remoteMeta,
        lastUpdated,
      };
      window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    hasHydratedStorage,
    sessions,
    selectedSessionId,
    loadedSessionId,
    remoteJobs,
    remoteTags,
    remoteMeta,
    lastUpdated,
  ]);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }
    try {
      if (rememberCookie) {
        const payload: CachedCookieData = {
          rememberCookie: true,
          cookieValue: sanitizeCookieInput(cookieValue),
        };
        window.localStorage.setItem(
          COOKIE_STORAGE_KEY,
          JSON.stringify(payload),
        );
      } else {
        window.localStorage.removeItem(COOKIE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [hasHydratedStorage, rememberCookie, cookieValue]);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }
    try {
      window.localStorage.setItem(
        SHORTLIST_STORAGE_KEY,
        JSON.stringify(shortlistBySession),
      );
    } catch {
      // Ignore storage errors
    }
  }, [hasHydratedStorage, shortlistBySession]);

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

  const scheduleMilestones = useMemo(() => {
    if (!displayedRound) {
      return [];
    }
    return [
      {
        key: "openingAnnouncementDate",
        label: "วันประกาศตำแหน่งงาน",
        iso: displayedRound.openingAnnouncementDate,
      },
      {
        key: "openingSubmissionDeadline",
        label: "วันปิดรับส่งตำแหน่งงาน (บริษัท)",
        iso: displayedRound.openingSubmissionDeadline,
      },
      {
        key: "applicationAnnouncementDate",
        label: "วันประกาศรายชื่อผู้สมัคร",
        iso: displayedRound.applicationAnnouncementDate,
      },
      {
        key: "studentRankingDeadline",
        label: "วันปิดรับการจัดอันดับของนิสิต",
        iso: displayedRound.studentRankingDeadline,
      },
      {
        key: "reorderRankingDeadline",
        label: "วันปิดรับการปรับอันดับ (Reorder)",
        iso: displayedRound.reorderRankingDeadline,
      },
      {
        key: "cancelRankingDeadline",
        label: "วันปิดรับการยกเลิก/สละสิทธิ์",
        iso: displayedRound.cancelRankingDeadline,
      },
      {
        key: "companyRankingDeadline",
        label: "วันปิดรับการจัดอันดับของบริษัท",
        iso: displayedRound.companyRankingDeadline,
      },
      {
        key: "resultAnnouncementDate",
        label: "วันประกาศผลการจับคู่",
        iso: displayedRound.resultAnnouncementDate,
      },
    ];
  }, [displayedRound]);

  const nextMilestoneKey = useMemo(() => {
    if (nowMs == null) {
      return null;
    }
    let earliestKey: string | null = null;
    let earliestTs = Number.POSITIVE_INFINITY;
    for (const item of scheduleMilestones) {
      if (!item.iso) {
        continue;
      }
      const ts = new Date(item.iso).getTime();
      if (!Number.isNaN(ts) && ts >= nowMs && ts < earliestTs) {
        earliestTs = ts;
        earliestKey = item.key;
      }
    }
    return earliestKey;
  }, [scheduleMilestones, nowMs]);

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

  const shortlistKey = String(activeSessionIdForLinks);
  const currentShortlistIds = useMemo(
    () => shortlistBySession[shortlistKey] ?? [],
    [shortlistBySession, shortlistKey],
  );
  const shortlistRankMap = useMemo(() => {
    const map = new Map<number, number>();
    currentShortlistIds.forEach((id, idx) => {
      map.set(id, idx + 1);
    });
    return map;
  }, [currentShortlistIds]);
  const shortlistSet = useMemo(
    () => new Set<number>(currentShortlistIds),
    [currentShortlistIds],
  );

  const shortlistedJobs = useMemo(() => {
    if (currentShortlistIds.length === 0 || activeJobs.length === 0) {
      return [];
    }
    const jobMap = new Map<number, Job>();
    for (const job of activeJobs) {
      jobMap.set(job.id, job);
    }
    return currentShortlistIds
      .map((id) => jobMap.get(id))
      .filter((job): job is Job => Boolean(job));
  }, [activeJobs, currentShortlistIds]);

  const detailModalJob = useMemo(() => {
    if (detailModalJobId == null) {
      return null;
    }
    return activeJobs.find((job) => job.id === detailModalJobId) ?? null;
  }, [activeJobs, detailModalJobId]);

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

  const filteredTagOptions = useMemo(() => {
    const q = tagSearchQuery.trim().toLowerCase();
    if (!q) {
      return activeTags;
    }
    return activeTags.filter((tag) => tag.toLowerCase().includes(q));
  }, [activeTags, tagSearchQuery]);

  const displayJobs = useMemo(
    () =>
      buildFilterableJobs(
        activeJobs,
        selectedTags,
        tagMatchMode,
        selectedWorkingConditions,
        coopFilter,
        minCompensation,
        hideUnspecifiedCompensation,
        onlyLowCompetition,
        onlyShortlisted,
        shortlistSet,
        searchQuery,
        onlyBookmarked,
        onlyAcceptingApplication,
        sortOrder,
        sortMode,
      ),
    [
      activeJobs,
      selectedTags,
      tagMatchMode,
      selectedWorkingConditions,
      coopFilter,
      minCompensation,
      hideUnspecifiedCompensation,
      onlyLowCompetition,
      onlyShortlisted,
      shortlistSet,
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
    selectedTags.length > 0 ||
    selectedWorkingConditions.length > 0 ||
    coopFilter !== "all" ||
    minCompensation != null ||
    hideUnspecifiedCompensation ||
    onlyLowCompetition ||
    onlyShortlisted ||
    onlyBookmarked ||
    !onlyAcceptingApplication;

  const hasSavedCache =
    sessions.length > 0 || activeJobs.length > 0 || rememberCookie;

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
    setTagSearchQuery("");
    setSelectedWorkingConditions([]);
    setCoopFilter("all");
    setMinCompensation(null);
    setHideUnspecifiedCompensation(false);
    setOnlyLowCompetition(false);
    setOnlyShortlisted(false);
    setOnlyBookmarked(false);
    setOnlyAcceptingApplication(true);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const exists = prev.some(
        (item) => item.toLowerCase() === tag.toLowerCase(),
      );
      if (exists) {
        return prev.filter((item) => item.toLowerCase() !== tag.toLowerCase());
      }
      return [...prev, tag];
    });
  };

  const toggleShortlist = (jobId: number) => {
    setShortlistBySession((prev) => {
      const current = prev[shortlistKey] ?? [];
      if (current.includes(jobId)) {
        return {
          ...prev,
          [shortlistKey]: current.filter((id) => id !== jobId),
        };
      }
      return {
        ...prev,
        [shortlistKey]: [...current, jobId],
      };
    });
  };

  const moveShortlistUp = (index: number) => {
    if (index <= 0) {
      return;
    }
    setShortlistBySession((prev) => {
      const current = [...(prev[shortlistKey] ?? [])];
      if (index >= current.length) {
        return prev;
      }
      [current[index - 1], current[index]] = [
        current[index],
        current[index - 1],
      ];
      return { ...prev, [shortlistKey]: current };
    });
  };

  const moveShortlistDown = (index: number) => {
    if (index < 0) {
      return;
    }
    setShortlistBySession((prev) => {
      const current = [...(prev[shortlistKey] ?? [])];
      if (index >= current.length - 1) {
        return prev;
      }
      [current[index], current[index + 1]] = [
        current[index + 1],
        current[index],
      ];
      return { ...prev, [shortlistKey]: current };
    });
  };

  const clearShortlist = () => {
    setShortlistBySession((prev) => {
      const next = { ...prev };
      delete next[shortlistKey];
      return next;
    });
  };

  const clearAllSavedData = () => {
    try {
      window.localStorage.removeItem(CACHE_STORAGE_KEY);
      window.localStorage.removeItem(COOKIE_STORAGE_KEY);
      window.localStorage.removeItem(SHORTLIST_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setCookieValue("");
    setRememberCookie(false);
    setSessions([]);
    setSelectedSessionId(null);
    setLoadedSessionId(null);
    setSelectedRoundNumber(null);
    setRemoteJobs(null);
    setRemoteTags(null);
    setRemoteMeta(null);
    setLastUpdated(null);
    setShortlistBySession({});
    setLoadError(null);
    setDetailModalJobId(null);
  };

  const fetchJobsForSession = async (
    sessionId: number,
    cookieOverride?: string,
  ) => {
    const cleanCookie = sanitizeCookieInput(cookieOverride ?? cookieValue);
    if (!cleanCookie) {
      setLoadError("กรุณากรอก cookie ก่อนโหลดข้อมูล");
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
          cookie: cleanCookie,
          sessionId,
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

      const nextJobs = payload.jobs ?? [];
      const nextTags = payload.allTags ?? [];

      setRemoteJobs(nextJobs);
      setRemoteTags(nextTags);
      setRemoteMeta(payload.meta ?? null);
      setLoadedSessionId(sessionId);
      setLastUpdated(payload.fetchedAt ?? null);

      const tagSet = new Set(nextTags.map((t) => t.toLowerCase()));
      setSelectedTags((prev) =>
        prev.filter((tag) => tagSet.has(tag.toLowerCase())),
      );
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessions = async () => {
    const cleanCookie = sanitizeCookieInput(cookieValue);
    if (!cleanCookie) {
      setLoadError("กรุณากรอก cookie ก่อนดึงข้อมูล");
      return;
    }
    if (cleanCookie !== cookieValue) {
      setCookieValue(cleanCookie);
    }

    setIsLoadingSessions(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cookie: cleanCookie }),
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
      const targetSessionId = stillExists
        ? (selectedSessionId as number)
        : fetchedSessions[fetchedSessions.length - 1].sessionId;

      setSelectedSessionId(targetSessionId);
      setSelectedRoundNumber(null);

      await fetchJobsForSession(targetSessionId, cleanCookie);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "ดึงรายการ Pool ไม่สำเร็จ",
      );
    } finally {
      setIsLoadingSessions(false);
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-700">
                  1. กรอก Cookie เพื่อดึงรายการ Pool และตำแหน่งงาน (คลิกเดียว)
                </span>
                <button
                  type="button"
                  onClick={() => setIsCookieGuideOpen(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  วิธีดู Cookie?
                </button>
              </div>
              <span className="text-xs text-zinc-500">
                รองรับการวางทั้งข้อความที่มีคำว่า Cookie: ติดมาด้วย
                ระบบจะตัดออกให้อัตโนมัติ
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex flex-1 items-center">
                  <input
                    type={showCookie ? "text" : "password"}
                    value={cookieValue}
                    onChange={(event) => setCookieValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !isLoadingSessions &&
                        !isLoading
                      ) {
                        void loadSessions();
                      }
                    }}
                    placeholder="วาง cookie จากเบราว์เซอร์..."
                    className="w-full rounded-lg border border-zinc-300 py-2 pr-14 pl-3 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:min-w-[340px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookie((prev) => !prev)}
                    className="absolute right-2 rounded px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  >
                    {showCookie ? "ซ่อน" : "แสดง"}
                  </button>
                </div>

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
                  {isLoadingSessions || isLoading
                    ? "กำลังดึงข้อมูล..."
                    : "ดึง Pool และโหลดงาน"}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={rememberCookie}
                    onChange={(event) =>
                      setRememberCookie(event.target.checked)
                    }
                    className="h-3.5 w-3.5 accent-zinc-900"
                  />
                  จำ Cookie ไว้ในเบราว์เซอร์นี้ (อย่าติ๊กหากใช้เครื่องสาธารณะ)
                </label>

                {hasSavedCache && (
                  <button
                    type="button"
                    onClick={clearAllSavedData}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700"
                  >
                    ล้างข้อมูลที่บันทึกไว้
                  </button>
                )}
              </div>
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">
                  2. เลือก Pool ที่ต้องการดูข้อมูล
                </span>
                <span className="text-xs text-zinc-500">
                  เมื่อเปลี่ยน Pool ระบบจะโหลดตำแหน่งงานให้อัตโนมัติ (หากมี Cookie)
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  aria-label="เลือก Pool"
                  value={selectedSessionId ?? ""}
                  onChange={(event) => {
                    const nextSessionId = Number(event.target.value);
                    setSelectedSessionId(nextSessionId);
                    setSelectedRoundNumber(null);
                    if (sanitizeCookieInput(cookieValue)) {
                      void fetchJobsForSession(nextSessionId);
                    }
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:min-w-[260px]"
                >
                  {sessions.map((session) => (
                    <option key={session.sessionId} value={session.sessionId}>
                      {formatSessionLabel(session)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSessionId != null) {
                      void fetchJobsForSession(selectedSessionId);
                    }
                  }}
                  disabled={
                    isLoading || isLoadingSessions || selectedSessionId == null
                  }
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isLoading || isLoadingSessions || selectedSessionId == null
                      ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                      : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {isLoading ? "กำลังโหลด..." : "รีเฟรชตำแหน่งงาน"}
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
            อัปเดตข้อมูลล่าสุด:{" "}
            {new Date(lastUpdated).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
            })}{" "}
            • Pool:{" "}
            {activeLoadedSession
              ? formatSessionLabel(activeLoadedSession)
              : `Session ${activeSessionIdForLinks}`}
            {remoteMeta ? ` (${remoteMeta.totalItem} รายการ)` : ""}
          </span>
        )}
      </div>

      {selectedSession && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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

              <div className="flex flex-wrap items-center gap-2">
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
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  สถานะการจับคู่:{" "}
                  {selectedSession.isMatchingInitiated
                    ? "เริ่มการจับคู่แล้ว"
                    : "ยังไม่เริ่มการจับคู่"}
                </span>
                <button
                  type="button"
                  aria-expanded={isPoolInfoExpanded}
                  onClick={() => setIsPoolInfoExpanded((prev) => !prev)}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  {isPoolInfoExpanded ? "พับกำหนดการ ▲" : "ดูกำหนดการ ▼"}
                </button>
              </div>
            </div>

            {isPoolInfoExpanded && (
              <>
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
                      {selectedSession.minimumUniqueCompanyCountPerStudent}{" "}
                      บริษัท
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-700">
                      กำหนดการของ Pool (เวลาไทย UTC+7)
                    </span>
                    {selectedSession.rounds &&
                      selectedSession.rounds.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedSession.rounds.map((roundItem) => {
                            const activeRound =
                              (selectedRoundNumber ??
                                selectedSession.currentRound) ===
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
                                {roundItem.round ===
                                selectedSession.currentRound
                                  ? " (ปัจจุบัน)"
                                  : ""}
                              </button>
                            );
                          })}
                        </div>
                      )}
                  </div>

                  {scheduleMilestones.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {scheduleMilestones.map((item) => {
                        const ts = item.iso ? new Date(item.iso).getTime() : NaN;
                        const hasValidDate = !Number.isNaN(ts);
                        const isPassed =
                          nowMs != null && hasValidDate && ts < nowMs;
                        const isNext = item.key === nextMilestoneKey;

                        return (
                          <div
                            key={item.key}
                            className={`rounded-xl border p-3 transition-colors ${
                              isNext
                                ? "border-blue-300 bg-blue-50/40"
                                : isPassed
                                  ? "border-zinc-200 bg-zinc-50 opacity-65"
                                  : "border-zinc-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-zinc-500">
                                {item.label}
                              </span>
                            </div>
                            <span className="mt-1 block text-sm font-medium text-zinc-900">
                              {formatDateTimeUtc7(item.iso)}
                            </span>
                            {isNext && nowMs != null && hasValidDate && (
                              <span className="mt-1.5 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                                กำลังจะมาถึง •{" "}
                                {formatRelativeCountdown(ts, nowMs)}
                              </span>
                            )}
                            {isPassed && (
                              <span className="mt-1.5 inline-block rounded-full bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                                ผ่านไปแล้ว
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-600">
                ค้นหาตำแหน่ง บริษัท แท็ก สถานที่ หรือรายละเอียดงาน
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="พิมพ์คำค้น เช่น Backend, BTS, Python, Docker..."
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-600">
                  กรองตามแท็ก (เลือกได้หลายแท็ก)
                </span>
                {selectedTags.length > 1 && (
                  <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setTagMatchMode("any")}
                      className={`rounded-full px-2.5 py-0.5 transition-colors ${
                        tagMatchMode === "any"
                          ? "bg-zinc-900 font-medium text-white"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      อย่างน้อย 1 แท็ก (OR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTagMatchMode("all")}
                      className={`rounded-full px-2.5 py-0.5 transition-colors ${
                        tagMatchMode === "all"
                          ? "bg-zinc-900 font-medium text-white"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      ครบทุกแท็ก (AND)
                    </button>
                  </div>
                )}
              </div>
              <input
                value={tagSearchQuery}
                onChange={(event) => setTagSearchQuery(event.target.value)}
                placeholder="ค้นหาชื่อแท็ก..."
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          </div>

          {selectedTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
              <span className="text-xs font-medium text-zinc-600">
                แท็กที่เลือก ({selectedTags.length}):
              </span>
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700"
                >
                  <span>{tag}</span>
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="ml-auto text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                ล้างแท็ก
              </button>
            </div>
          )}

          {activeTags.length > 0 && (
            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/50 p-3">
              {filteredTagOptions.length === 0 ? (
                <span className="text-xs text-zinc-500">
                  ไม่พบแท็กที่ตรงกับ &ldquo;{tagSearchQuery}&rdquo;
                </span>
              ) : (
                filteredTagOptions.map((tag) => {
                  const isSelected = selectedTags.some(
                    (item) => item.toLowerCase() === tag.toLowerCase(),
                  );
                  const count = tagCounts.get(tag.toLowerCase()) ?? 0;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100"
                      }`}
                    >
                      {tag} ({count})
                    </button>
                  );
                })
              )}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
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
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-zinc-600">
              ค่าตอบแทนขั้นต่ำโดยประมาณ (บาท/เดือน)
            </span>
            <div className="flex flex-wrap gap-2">
              {COMPENSATION_PRESETS.map((preset) => {
                const isActive = minCompensation === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setMinCompensation(preset.value)}
                    className={`rounded-full border px-3.5 py-1 text-sm transition-colors ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                className="h-4 w-4 accent-zinc-900"
                checked={onlyLowCompetition}
                onChange={(event) =>
                  setOnlyLowCompetition(event.target.checked)
                }
              />
              เฉพาะงานที่คนเลือกน้อยกว่าโควตา
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-zinc-900"
                checked={hideUnspecifiedCompensation}
                onChange={(event) =>
                  setHideUnspecifiedCompensation(event.target.checked)
                }
              />
              ซ่อนงานที่ไม่ระบุค่าตอบแทน
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

            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-500"
                checked={onlyShortlisted}
                onChange={(event) => setOnlyShortlisted(event.target.checked)}
              />
              แสดงเฉพาะรายการที่เล็งไว้ ({currentShortlistIds.length})
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4">
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
                onClick={() => setSortMode("competition")}
                className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                  sortMode === "competition"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                อัตราการแข่งขัน (คนเลือก ÷ โควตา)
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
                    : sortMode === "competition"
                      ? "แข่งขันสูง → ต่ำ"
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
                    : sortMode === "competition"
                      ? "แข่งขันต่ำ → สูง"
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

      <ShortlistPanel
        shortlistedJobs={shortlistedJobs}
        session={activeLoadedSession}
        activeSessionIdForLinks={activeSessionIdForLinks}
        onMoveUp={moveShortlistUp}
        onMoveDown={moveShortlistDown}
        onRemove={toggleShortlist}
        onClearAll={clearShortlist}
        onOpenDetail={(job) => setDetailModalJobId(job.id)}
      />

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
                  กรุณาใส่ cookie แล้วกดปุ่ม &ldquo;ดึง Pool และโหลดงาน&rdquo;
                  เพื่อดูข้อมูลตำแหน่งงาน
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-zinc-600">
                  ไม่พบตำแหน่งที่ตรงกับเงื่อนไขที่เลือก
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  ลองปรับตัวกรอง ค้นหาด้วยคำอื่น หรือกดล้างตัวกรองทั้งหมด
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
                selectedTags={selectedTags}
                shortlistRank={shortlistRankMap.get(job.id) ?? null}
                onToggleTag={toggleTag}
                onToggleShortlist={toggleShortlist}
                onOpenModal={(targetJob) => setDetailModalJobId(targetJob.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <JobDetailModal
        job={detailModalJob}
        activeSessionIdForLinks={activeSessionIdForLinks}
        selectedTags={selectedTags}
        isShortlisted={
          detailModalJob != null && shortlistSet.has(detailModalJob.id)
        }
        shortlistRank={
          detailModalJob != null
            ? (shortlistRankMap.get(detailModalJob.id) ?? null)
            : null
        }
        onClose={() => setDetailModalJobId(null)}
        onToggleTag={toggleTag}
        onToggleShortlist={toggleShortlist}
      />

      <CookieGuideModal
        isOpen={isCookieGuideOpen}
        onClose={() => setIsCookieGuideOpen(false)}
      />
    </section>
  );
};

export default JobBoard;
