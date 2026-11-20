export type WorkingConditionCategory =
  | "On-Site"
  | "Online"
  | "Hybrid"
  | "Unspecified";

export type InternOpeningsMeta = {
  totalItem: number;
  itemCount: number;
  itemsPerPage: number;
  totalPage: number;
  currentPage: number;
};

export type JobListing = {
  id: number;
  sessionId: number | null;
  title: string;
  companyId: number | null;
  companyNamePrimary: string;
  companyNameSecondary: string | null;
  logoUrl: string | null;
  companyWebsite: string | null;
  companyFacebook: string | null;
  companyLine: string | null;
  tags: string[];
  workingConditionDisplay: string;
  workingConditionCategory: WorkingConditionCategory;
  workingConditionRaw: string | null;
  location: string | null;
  officeName: string | null;
  officeAddressLine1: string | null;
  officeAddressLine2: string | null;
  descriptionSnippet: string;
  descriptionHtml: string;
  requirementsHtml: string | null;
  requirementsSnippet: string | null;
  monthlyCompensation: number | null;
  compensationAmount: number | null;
  compensationTypeId: number | null;
  compensationTypeLabel: string | null;
  quota: number | null;
  openForCooperativeInternship: boolean;
  recruitmentContact: string | null;
  detailContact: string | null;
  startDateIso: string | null;
  endDateIso: string | null;
  isPublished: boolean;
  isAcceptingApplication: boolean;
  inStudentDraftCount: number | null;
  isBookmarked: boolean;
};

export type JobDetail = JobListing;

export type RawInternItem = {
  openingId: number;
  sessionId?: number;
  title: string;
  description?: string | null;
  quota?: number | null;
  openForCooperativeInternship?: boolean | null;
  company?: {
    companyId?: number;
    companyNameTh?: string | null;
    companyNameEn?: string | null;
    logoUrl?: string | null;
    website?: string | null;
    facebook?: string | null;
    line?: string | null;
  } | null;
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
  meta?: InternOpeningsMeta;
};

export type RawTagDataset = Array<{
  tagName?: string | null;
}>;

export type InternSessionRound = {
  round: number;
  openingSubmissionDeadline: string | null;
  openingAnnouncementDate: string | null;
  studentRankingDeadline: string | null;
  applicationAnnouncementDate: string | null;
  companyRankingDeadline: string | null;
  resultAnnouncementDate: string | null;
  reorderRankingDeadline: string | null;
  cancelRankingDeadline: string | null;
};

export type InternSession = {
  sessionId: number;
  title: string;
  description: string;
  currentRound: number;
  minimumApplicationPerStudent: number;
  minimumUniqueCompanyCountPerStudent: number;
  maximumApplicationPerStudent: number;
  openForCooperativeInternship: boolean;
  openingSubmissionDeadline: string | null;
  openingAnnouncementDate: string | null;
  studentRankingDeadline: string | null;
  applicationAnnouncementDate: string | null;
  companyRankingDeadline: string | null;
  resultAnnouncementDate: string | null;
  reorderRankingDeadline: string | null;
  cancelRankingDeadline: string | null;
  isMatchingInitiated: boolean;
  sessionGroupId: number;
  sessionGroupTitle: string;
  rounds: InternSessionRound[];
};

const ALLOWED_HTML_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "a",
  "span",
  "div",
  "hr",
]);

function computeMonthlyCompensation(
  amount: number | null | undefined,
  label: string | null | undefined,
  typeId: number | null | undefined,
): number | null {
  if (amount == null) {
    return null;
  }

  const normalizedLabel = label?.replace(/\s+/g, "").toLowerCase() ?? "";

  if (
    typeId === 5 ||
    normalizedLabel.includes("ไม่มีค่าตอบแทน") ||
    amount === 0
  ) {
    return 0;
  }

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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

function stripHtmlToPlainText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function buildTextSnippet(base: string, maxLength = 280): string {
  const plain = stripHtmlToPlainText(base);
  if (!plain) {
    return "";
  }
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength - 3).trim()}...`;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractSafeHref(rawAttrs: string): string | null {
  const match = rawAttrs.match(
    /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i,
  );
  const href = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  if (!href) {
    return null;
  }
  const decodedHref = decodeHtmlEntities(href).trim();
  if (/^(https?:\/\/|mailto:)/i.test(decodedHref)) {
    return decodedHref;
  }
  return null;
}

function extractSafeQuillIndentClass(rawAttrs: string): string | null {
  const match = rawAttrs.match(
    /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i,
  );
  const classVal = match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
  const indentTokens = classVal
    .split(/\s+/)
    .filter((token) => /^ql-indent-[1-5]$/.test(token));
  return indentTokens.length > 0 ? indentTokens.join(" ") : null;
}

/**
 * Sanitizes rich HTML from upstream descriptions/requirements while preserving
 * structural tags, safe links, and Quill indentation classes.
 */
function sanitizeRichHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml) {
    return "";
  }

  const withoutDangerousBlocks = rawHtml
    .replace(/<(script|style|iframe|object|embed|svg)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|svg)\b[^>]*\/?>/gi, "");

  const sanitized = withoutDangerousBlocks.replace(
    /<(\/?)([a-zA-Z0-9]+)((?:\s+[^>]*)?)>/g,
    (_, slash: string, rawTagName: string, rawAttrs: string) => {
      const tagName = rawTagName.toLowerCase();
      if (!ALLOWED_HTML_TAGS.has(tagName)) {
        return "";
      }

      if (slash === "/") {
        return tagName === "br" || tagName === "hr" ? "" : `</${tagName}>`;
      }

      if (tagName === "br" || tagName === "hr") {
        return `<${tagName} />`;
      }

      if (tagName === "a") {
        const safeHref = extractSafeHref(rawAttrs);
        if (!safeHref) {
          return "<a>";
        }
        return `<a href="${escapeHtmlAttr(safeHref)}" target="_blank" rel="noopener noreferrer">`;
      }

      if (tagName === "li") {
        const indentClass = extractSafeQuillIndentClass(rawAttrs);
        if (indentClass) {
          return `<li class="${indentClass}">`;
        }
      }

      return `<${tagName}>`;
    },
  );

  return stripHtmlToPlainText(sanitized) ? sanitized.trim() : "";
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
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  if (collapsed.length === 0) {
    return null;
  }
  return collapsed.join("\n");
}

function isPureUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function stripUrlsFromText(value: string): string {
  return value
    .replace(/\(?\s*https?:\/\/[^\s)]+\s*\)?\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLocationSummary(
  officeName: string | null,
  addressLine1: string | null,
  addressLine2: string | null,
): string | null {
  const cleanAddr2 =
    addressLine2 && !isPureUrl(addressLine2)
      ? cleanupString(stripUrlsFromText(addressLine2))
      : null;
  const cleanAddr1 = addressLine1
    ? cleanupString(addressLine1.replace(/\n/g, ", "))
    : null;

  const isGenericOffice =
    !officeName ||
    officeName === "สำนักงานใหญ่" ||
    officeName.toLowerCase() === "head office";

  if (!isGenericOffice && officeName) {
    if (
      cleanAddr2 &&
      cleanAddr2.length <= 60 &&
      !officeName.toLowerCase().includes(cleanAddr2.toLowerCase())
    ) {
      return `${officeName} • ${cleanAddr2}`;
    }
    return officeName;
  }

  if (officeName && cleanAddr2) {
    return `${officeName} • ${cleanAddr2}`;
  }

  if (officeName && cleanAddr1) {
    return `${officeName} • ${cleanAddr1}`;
  }

  return cleanAddr2 ?? cleanAddr1 ?? officeName ?? null;
}

function deduplicateTags(
  rawTags: RawInternItem["tags"],
): string[] {
  const tagMap = new Map<string, string>();
  for (const tag of rawTags ?? []) {
    const trimmed = tag.tagName?.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (!tagMap.has(key)) {
      tagMap.set(key, trimmed);
    }
  }
  return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b, "th-TH"));
}

export function transformRawItems(items: RawInternItem[]): JobDetail[] {
  return items.map((item) => {
    const rawDescription = item.description?.trim() ?? "";
    const sanitizedDescription = sanitizeRichHtml(rawDescription);
    const sanitizedRequirements = sanitizeRichHtml(item.requirements);
    const requirementsHtml =
      sanitizedRequirements.length > 0 ? sanitizedRequirements : null;
    const requirementsSnippet = requirementsHtml
      ? buildTextSnippet(requirementsHtml, 200)
      : null;

    const compensationTypeLabel = cleanupString(
      item.compensationType?.compensationType,
    );
    const compensationTypeId = item.compensationType?.compensationTypeId ?? null;
    const monthlyCompensation = computeMonthlyCompensation(
      item.compensationAmount ?? null,
      compensationTypeLabel,
      compensationTypeId,
    );

    const companyTh = cleanupString(item.company?.companyNameTh);
    const companyEn = cleanupString(item.company?.companyNameEn);
    const companyNamePrimary = companyTh ?? companyEn ?? "ไม่ระบุชื่อบริษัท";
    const companyNameSecondary =
      companyTh && companyEn && companyTh !== companyEn ? companyEn : null;

    const officeName = cleanupString(item.officeName);
    const officeAddressLine1 = cleanupMultiline(item.officeAddressLine1);
    const officeAddressLine2 = cleanupMultiline(item.officeAddressLine2);

    const transformed: JobDetail = {
      id: item.openingId,
      sessionId: item.sessionId ?? null,
      title: cleanupString(item.title) ?? "ไม่ระบุชื่อตำแหน่ง",
      companyId: item.company?.companyId ?? null,
      companyNamePrimary,
      companyNameSecondary,
      logoUrl: cleanupString(item.company?.logoUrl),
      companyWebsite: cleanupString(item.company?.website),
      companyFacebook: cleanupString(item.company?.facebook),
      companyLine: cleanupString(item.company?.line),
      tags: deduplicateTags(item.tags),
      workingConditionDisplay:
        cleanupString(item.workingCondition) ?? "ไม่ระบุ",
      workingConditionCategory: normalizeWorkingCondition(
        item.workingCondition,
      ),
      workingConditionRaw: cleanupString(item.workingCondition),
      location: buildLocationSummary(
        officeName,
        officeAddressLine1,
        officeAddressLine2,
      ),
      officeName,
      officeAddressLine1,
      officeAddressLine2,
      descriptionSnippet: sanitizedDescription
        ? buildTextSnippet(sanitizedDescription)
        : "",
      descriptionHtml: sanitizedDescription,
      requirementsHtml,
      requirementsSnippet,
      monthlyCompensation,
      compensationAmount: item.compensationAmount ?? null,
      compensationTypeId,
      compensationTypeLabel,
      quota: item.quota ?? null,
      openForCooperativeInternship: Boolean(item.openForCooperativeInternship),
      recruitmentContact: cleanupMultiline(item.recruitmentContactChannel),
      detailContact: cleanupMultiline(item.openingDetailContactChannel),
      startDateIso: cleanupString(item.startDate),
      endDateIso: cleanupString(item.endDate),
      isPublished: item.isPublished ?? true,
      isAcceptingApplication: item.isAcceptingApplication ?? true,
      inStudentDraftCount: item.inStudentDraftCount ?? null,
      isBookmarked: Boolean(item.isBookmarked),
    };

    return transformed;
  });
}

export function buildJobListings(details: JobDetail[]): JobListing[] {
  return details;
}

export function collectTagsFromJobs(details: { tags: string[] }[]): string[] {
  const tagMap = new Map<string, string>();
  details.forEach((job) => {
    job.tags.forEach((tag) => {
      const trimmed = tag.trim();
      if (!trimmed) {
        return;
      }
      const key = trimmed.toLowerCase();
      if (!tagMap.has(key)) {
        tagMap.set(key, trimmed);
      }
    });
  });

  return Array.from(tagMap.values()).sort((a, b) =>
    a.localeCompare(b, "th-TH"),
  );
}
