"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { collectTagsFromJobs } from "@/app/lib/intern-transform";
import type { JobListing } from "@/app/lib/jobs";

type Job = JobListing;

type WorkingConditionCategory = JobListing["workingConditionCategory"];

const WORKING_CONDITION_OPTIONS: {
  label: string;
  value: WorkingConditionCategory;
}[] = [
  { label: "On-site", value: "On-Site" },
  { label: "Online", value: "Online" },
  { label: "Hybrid", value: "Hybrid" },
  { label: "Other", value: "Unspecified" },
];

function formatCurrency(value: number): string {
  return `${value.toLocaleString("th-TH")}`;
}

function formatMonthlyCompensation(value: number | null): string {
  if (value == null) {
    return "ไม่ระบุ";
  }

  return `${formatCurrency(Math.round(value))} บาท/เดือน`;
}

function buildFilterableJobs(
  jobs: Job[],
  selectedTag: string,
  selectedWorkingConditions: WorkingConditionCategory[],
  searchQuery: string,
  onlyBookmarked: boolean,
  sortOrder: "asc" | "desc",
  sortMode: "compensation" | "title" | "popularity",
): Job[] {
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const hasQuery = trimmedQuery.length > 0;
  const hasTag = selectedTag.length > 0;
  const hasCondition = selectedWorkingConditions.length > 0;

  const filtered = jobs.filter((job) => {
    if (job.quota === 0) {
      return false;
    }
    if (onlyBookmarked && !job.isBookmarked) {
      return false;
    }
    const matchesTag = hasTag
      ? job.tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())
      : true;

    const matchesCondition = hasCondition
      ? selectedWorkingConditions.includes(job.workingConditionCategory)
      : true;

    const matchesQuery = hasQuery
      ? `${job.title} ${job.companyNamePrimary} ${job.companyNameSecondary ?? ""}`
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

  const sorted = filtered.sort((a, b) => {
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

  return sorted;
}

const JobBoard = () => {
  const [cookieValue, setCookieValue] = useState<string>("");
  const [remoteJobs, setRemoteJobs] = useState<Job[] | null>(null);
  const [remoteTags, setRemoteTags] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedWorkingConditions, setSelectedWorkingConditions] = useState<
    WorkingConditionCategory[]
  >([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortMode, setSortMode] = useState<
    "compensation" | "title" | "popularity"
  >("compensation");

  const activeJobs = remoteJobs ?? [];
  const activeTags = useMemo(() => {
    if (remoteTags) {
      return remoteTags;
    }
    return collectTagsFromJobs(activeJobs);
  }, [activeJobs, remoteTags]);

  const displayJobs = useMemo(
    () =>
      buildFilterableJobs(
        activeJobs,
        selectedTag,
        selectedWorkingConditions,
        searchQuery,
        onlyBookmarked,
        sortOrder,
        sortMode,
      ),
    [
      activeJobs,
      selectedTag,
      selectedWorkingConditions,
      searchQuery,
      onlyBookmarked,
      sortOrder,
      sortMode,
    ],
  );

  const totalQuota = useMemo(
    () => activeJobs.reduce((sum, job) => sum + (job.quota ?? 0), 0),
    [activeJobs],
  );

  const totalSelected = useMemo(
    () =>
      activeJobs.reduce((sum, job) => sum + (job.inStudentDraftCount ?? 0), 0),
    [activeJobs],
  );

  useEffect(() => {
    setLoadError(null);
  }, []);

  useEffect(() => {
    if (
      selectedTag &&
      !activeTags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())
    ) {
      setSelectedTag("");
    }
  }, [activeTags, selectedTag]);

  const loadRemoteJobs = async () => {
    const trimmedCookie = cookieValue.trim();
    if (!trimmedCookie) {
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
        body: JSON.stringify({ cookie: trimmedCookie }),
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
        fetchedAt?: string | null;
      };

      setRemoteJobs(payload.jobs ?? []);
      setRemoteTags(payload.allTags ?? []);
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-600">
              โหลดข้อมูลจาก API
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
              onClick={loadRemoteJobs}
              disabled={isLoading}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isLoading
                  ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              {isLoading ? "กำลังโหลด..." : "โหลดข้อมูล"}
            </button>
          </div>
        </div>
        {loadError && (
          <span className="mt-3 block text-xs text-rose-600">{loadError}</span>
        )}
        {lastUpdated && (
          <span className="mt-2 block text-xs text-zinc-500">
            อัปเดตล่าสุด: {new Date(lastUpdated).toLocaleString("th-TH")}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2 md:items-end">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-600">
              ค้นหาตำแหน่งหรือบริษัท
            </span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="พิมพ์คำค้น..."
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
              {activeTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 md:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-yellow-400"
              checked={onlyBookmarked}
              onChange={(event) => setOnlyBookmarked(event.target.checked)}
            />
            แสดงเฉพาะตำแหน่งที่กด Bookmark
          </label>

          <div className="flex flex-col gap-3 md:col-span-2">
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

          <div className="flex flex-col gap-3 md:col-span-2">
            <span className="text-sm font-medium text-zinc-600">
              รูปแบบการจัดเรียง
            </span>
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
            จำนวนคนใน pool รอบนี้ (นับจาก inStudentDraftCount รวมกันแล้วหารด้วย
            5)
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {totalSelected / 5} คน
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">
          พบ {displayJobs.length.toLocaleString("th-TH")} ตำแหน่งจากทั้งหมด{" "}
          {activeJobs.length.toLocaleString("th-TH")} ตำแหน่ง
        </p>

        {displayJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
            {activeJobs.length === 0 ? (
              <>
                <p className="text-sm font-medium text-zinc-600">
                  ยังไม่มีข้อมูลตำแหน่งงาน
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  กรุณาใส่ cookie แล้วกดโหลดข้อมูลจาก API
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
              <li
                key={job.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">
                        {job.companyNamePrimary}
                      </span>
                      {job.companyNameSecondary && (
                        <span className="text-xs text-zinc-500">
                          {job.companyNameSecondary}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`https://cedtintern.cp.eng.chula.ac.th/opening/${job.id}/session/5`}
                        className="text-xl font-semibold text-zinc-900 transition-colors hover:text-zinc-700"
                      >
                        {job.title}
                      </Link>
                      <span
                        className="inline-flex items-center"
                        aria-label={
                          job.isBookmarked ? "Bookmarked" : "Not bookmarked"
                        }
                        title={
                          job.isBookmarked ? "Bookmarked" : "Not bookmarked"
                        }
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
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-zinc-600">
                      {job.location && <span>{job.location}</span>}
                      <span>•</span>
                      <span>{job.workingConditionDisplay}</span>
                      {job.quota != null && (
                        <>
                          <span>•</span>
                          <span>
                            รับ {job.quota.toLocaleString("th-TH")} คน
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>
                        มีคนเลือก{" "}
                        {job.inStudentDraftCount?.toLocaleString("th-TH") ??
                          "0"}{" "}
                        คน
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end">
                    <span className="text-sm font-medium text-zinc-500">
                      ค่าตอบแทนโดยประมาณ
                    </span>
                    <span className="text-lg font-semibold text-zinc-900">
                      {formatMonthlyCompensation(job.monthlyCompensation)}
                    </span>
                    {job.compensationAmount != null &&
                      job.compensationTypeLabel && (
                        <span className="text-xs text-zinc-500">
                          อัตราตั้งต้น: {formatCurrency(job.compensationAmount)}{" "}
                          {job.compensationTypeLabel}
                        </span>
                      )}
                  </div>
                </div>

                {job.descriptionSnippet && (
                  <p className="mt-4 text-sm leading-relaxed text-zinc-600">
                    {job.descriptionSnippet}
                  </p>
                )}

                {job.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs text-zinc-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <Link
                    href={`https://cedtintern.cp.eng.chula.ac.th/opening/${job.id}/session/5`}
                    className="text-sm font-medium text-zinc-900 transition-colors hover:text-zinc-700"
                  >
                    ดูรายละเอียดตำแหน่ง →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default JobBoard;
