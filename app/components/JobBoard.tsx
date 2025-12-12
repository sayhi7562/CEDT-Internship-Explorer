"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { JobListing } from "@/app/lib/jobs";

type Job = JobListing;

type JobBoardProps = {
  jobs: Job[];
  allTags: string[];
};

type WorkingConditionCategory = JobListing["workingConditionCategory"];

const WORKING_CONDITION_OPTIONS: {
  label: string;
  value: WorkingConditionCategory;
}[] = [
  { label: "On-site", value: "On-Site" },
  { label: "Online", value: "Online" },
  { label: "Hybrid", value: "Hybrid" },
  { label: "Unspecified", value: "Unspecified" },
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
  sortOrder: "asc" | "desc"
): Job[] {
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const hasQuery = trimmedQuery.length > 0;
  const hasTag = selectedTag.length > 0;
  const hasCondition = selectedWorkingConditions.length > 0;

  const filtered = jobs.filter((job) => {
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

const JobBoard = ({ jobs, allTags }: JobBoardProps) => {
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedWorkingConditions, setSelectedWorkingConditions] = useState<
    WorkingConditionCategory[]
  >([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const displayJobs = useMemo(
    () =>
      buildFilterableJobs(
        jobs,
        selectedTag,
        selectedWorkingConditions,
        searchQuery,
        sortOrder
      ),
    [jobs, selectedTag, selectedWorkingConditions, searchQuery, sortOrder]
  );

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
        <div className="grid gap-6 md:grid-cols-2 md:items-end">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-600">ค้นหาตำแหน่งหรือบริษัท</span>
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
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-3 md:col-span-2">
            <span className="text-sm font-medium text-zinc-600">รูปแบบการทำงาน</span>
            <div className="flex flex-wrap gap-2">
              {WORKING_CONDITION_OPTIONS.map((option) => {
                const isActive = selectedWorkingConditions.includes(option.value);
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

          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-medium text-zinc-600">การจัดเรียงค่าตอบแทน</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSortOrder("desc")}
                className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                  sortOrder === "desc"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                สูงไปต่ำ (ต่อเดือน)
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
                ต่ำไปสูง (ต่อเดือน)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">
          พบ {displayJobs.length.toLocaleString("th-TH")} ตำแหน่งจากทั้งหมด {jobs.length.toLocaleString("th-TH")} ตำแหน่ง
        </p>

        {displayJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-zinc-600">ไม่พบตำแหน่งที่ตรงกับเงื่อนไขที่เลือก</p>
            <p className="mt-2 text-xs text-zinc-500">ลองปรับตัวกรองหรือค้นหาด้วยคำอื่น</p>
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
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-xl font-semibold text-zinc-900 transition-colors hover:text-zinc-700"
                    >
                      {job.title}
                    </Link>
                    <div className="flex flex-wrap gap-2 text-sm text-zinc-600">
                      {job.location && <span>{job.location}</span>}
                      <span>•</span>
                      <span>{job.workingConditionDisplay}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end">
                    <span className="text-sm font-medium text-zinc-500">ค่าตอบแทนโดยประมาณ</span>
                    <span className="text-lg font-semibold text-zinc-900">
                      {formatMonthlyCompensation(job.monthlyCompensation)}
                    </span>
                    {job.compensationAmount != null && job.compensationTypeLabel && (
                      <span className="text-xs text-zinc-500">
                        อัตราตั้งต้น: {formatCurrency(job.compensationAmount)} {job.compensationTypeLabel}
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
                    href={`/jobs/${job.id}`}
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
