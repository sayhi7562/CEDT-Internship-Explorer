export type WorkingConditionCategory =
  | "On-Site"
  | "Online"
  | "Hybrid"
  | "Unspecified";

export type JobListing = {
  id: number;
  title: string;
  companyNamePrimary: string;
  companyNameSecondary: string | null;
  logoUrl: string | null;
  tags: string[];
  workingConditionDisplay: string;
  workingConditionCategory: WorkingConditionCategory;
  location: string | null;
  descriptionSnippet: string;
  monthlyCompensation: number | null;
  compensationAmount: number | null;
  compensationTypeLabel: string | null;
  quota: number | null;
  inStudentDraftCount: number | null;
  isBookmarked: boolean;
};

export type JobDetail = JobListing & {
  descriptionHtml: string;
  officeName: string | null;
  officeAddressLine1: string | null;
  officeAddressLine2: string | null;
  recruitmentContact: string | null;
  detailContact: string | null;
  companyWebsite: string | null;
  companyFacebook: string | null;
  companyLine: string | null;
  quota: number | null;
  startDateIso: string | null;
  endDateIso: string | null;
  openForCooperativeInternship: boolean;
  workingConditionRaw: string | null;
};

type RawInternItem = {
  openingId: number;
  sessionId?: number;
  title: string;
  description?: string | null;
  quota?: number | null;
  openForCooperativeInternship?: boolean | null;
  company: {
    companyId?: number;
    companyNameTh?: string | null;
    companyNameEn?: string | null;
    logoUrl?: string | null;
    website?: string | null;
    facebook?: string | null;
    line?: string | null;
  };
  compensationAmount?: number | null;
  compensationType?: {
    compensationTypeId?: number;
    compensationType?: string | null;
  } | null;
  workingCondition?: string | null;
  requirements?: string | null;
  tags?: Array<{
    tagId?: number;
    tagName?: string | null;
  }> | null;
  officeName?: string | null;
  officeAddressLine1?: string | null;
  officeAddressLine2?: string | null;
  recruitmentContactChannel?: string | null;
  openingDetailContactChannel?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isPublished?: boolean;
  isAcceptingApplication?: boolean;
  inStudentDraftCount?: number | null;
  isBookmarked?: boolean | null;
};

export type RawInternDataset = {
  items: RawInternItem[];
};

export type RawTagDataset = Array<{
  tagName?: string | null;
}>;

function computeMonthlyCompensation(
  amount: number | null | undefined,
  label: string | null | undefined,
): number | null {
  if (amount == null) {
    return null;
  }

  if (!label) {
    return amount;
  }

  const normalizedLabel = label.replace(/\s+/g, "").toLowerCase();

  if (normalizedLabel.includes("วัน") || normalizedLabel.includes("day")) {
    return amount * 20;
  }

  return amount;
}

function normalizeWorkingCondition(
  rawCondition: string | null | undefined,
): WorkingConditionCategory {
  if (!rawCondition) {
    return "Unspecified";
  }

  const lower = rawCondition.toLowerCase();

  if (lower.includes("hybrid")) {
    return "Hybrid";
  }

  if (
    lower.includes("work from") ||
    lower.includes("remote") ||
    lower.includes("online") ||
    lower.includes("anywhere")
  ) {
    return "Online";
  }

  if (
    lower.includes("on-site") ||
    lower.includes("onsite") ||
    lower.includes("on site")
  ) {
    return "On-Site";
  }

  return "Unspecified";
}

function buildDescriptionSnippet(base: string): string {
  const plain = base
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= 280) {
    return plain;
  }
  return `${plain.slice(0, 277).trim()}...`;
}

function cleanupString(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned && cleaned.length > 0 ? cleaned : null;
}

function cleanupMultiline(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const collapsed = value
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (collapsed.length === 0) {
    return null;
  }
  return collapsed.join("\n");
}

export function transformRawItems(items: RawInternItem[]): JobDetail[] {
  return items.map((item) => {
    const rawDescription = item.description?.trim() ?? "";
    const monthlyCompensation = computeMonthlyCompensation(
      item.compensationAmount ?? null,
      item.compensationType?.compensationType ?? null,
    );
    const tags = Array.from(
      new Set(
        (item.tags ?? [])
          .map((tag) => tag.tagName?.trim())
          .filter((tagName): tagName is string => Boolean(tagName)),
      ),
    ).sort((a, b) => a.localeCompare(b, "th-TH"));

    const transformed: JobDetail = {
      id: item.openingId,
      title: item.title,
      companyNamePrimary:
        cleanupString(item.company.companyNameTh) ?? "ไม่ระบุชื่อบริษัท",
      companyNameSecondary: cleanupString(item.company.companyNameEn),
      logoUrl: cleanupString(item.company.logoUrl),
      tags,
      workingConditionDisplay:
        cleanupString(item.workingCondition) ?? "ไม่ระบุ",
      workingConditionCategory: normalizeWorkingCondition(
        item.workingCondition,
      ),
      location:
        cleanupString(item.officeName) ??
        cleanupMultiline(item.officeAddressLine1)?.replace(/\n/g, ", ") ??
        null,
      descriptionSnippet: rawDescription
        ? buildDescriptionSnippet(rawDescription)
        : "",
      monthlyCompensation,
      compensationAmount: item.compensationAmount ?? null,
      compensationTypeLabel: cleanupString(
        item.compensationType?.compensationType,
      ),
      inStudentDraftCount: item.inStudentDraftCount ?? null,
      isBookmarked: Boolean(item.isBookmarked),
      descriptionHtml: rawDescription,
      officeName: cleanupString(item.officeName),
      officeAddressLine1: cleanupMultiline(item.officeAddressLine1),
      officeAddressLine2: cleanupMultiline(item.officeAddressLine2),
      recruitmentContact: cleanupMultiline(item.recruitmentContactChannel),
      detailContact: cleanupMultiline(item.openingDetailContactChannel),
      companyWebsite: cleanupString(item.company.website),
      companyFacebook: cleanupString(item.company.facebook),
      companyLine: cleanupString(item.company.line),
      quota: item.quota ?? null,
      startDateIso: cleanupString(item.startDate) ?? null,
      endDateIso: cleanupString(item.endDate) ?? null,
      openForCooperativeInternship: Boolean(item.openForCooperativeInternship),
      workingConditionRaw: cleanupString(item.workingCondition),
    };

    return transformed;
  });
}

export function buildJobListings(details: JobDetail[]): JobListing[] {
  return details.map((job) => ({
    id: job.id,
    title: job.title,
    companyNamePrimary: job.companyNamePrimary,
    companyNameSecondary: job.companyNameSecondary,
    logoUrl: job.logoUrl,
    tags: job.tags,
    workingConditionDisplay: job.workingConditionDisplay,
    workingConditionCategory: job.workingConditionCategory,
    location: job.location,
    descriptionSnippet: job.descriptionSnippet,
    monthlyCompensation: job.monthlyCompensation,
    compensationAmount: job.compensationAmount,
    compensationTypeLabel: job.compensationTypeLabel,
    quota: job.quota,
    inStudentDraftCount: job.inStudentDraftCount,
    isBookmarked: job.isBookmarked,
  }));
}

export function collectTagsFromJobs(details: { tags: string[] }[]): string[] {
  const tagSet = new Set<string>();
  details.forEach((job) => {
    job.tags.forEach((tag) => tagSet.add(tag));
  });

  return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "th-TH"));
}
