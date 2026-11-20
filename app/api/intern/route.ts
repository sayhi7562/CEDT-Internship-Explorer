import { NextResponse } from "next/server";

import {
  buildJobListings,
  collectTagsFromJobs,
  transformRawItems,
  type RawInternDataset,
  type RawInternItem,
} from "@/app/lib/intern-transform";

const DEFAULT_SESSION_ID = 9;
const DEFAULT_PAGE_LIMIT = 2000;

function buildInternApiUrl(
  sessionId: number,
  page = 1,
  limit = DEFAULT_PAGE_LIMIT,
  onlyAvailablePositions = false,
): string {
  return `https://cedtintern.cp.eng.chula.ac.th/api/sessions/${sessionId}/openings?search=&page=${page}&limit=${limit}&onlyBookmarked=false&onlyAvailablePositions=${onlyAvailablePositions}`;
}

function buildUpstreamHeaders(
  cookie: string,
  onlyAvailablePositions: boolean,
): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "th,en;q=0.9",
    cookie,
    referer: `https://cedtintern.cp.eng.chula.ac.th/opening?page=1&bookmarkedFilter=false&availablePositionFilter=${onlyAvailablePositions}`,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
  };
}

export async function POST(request: Request) {
  let cookie = "";
  let sessionId = DEFAULT_SESSION_ID;
  let onlyAvailablePositions = false;

  try {
    const body = (await request.json()) as {
      cookie?: string;
      sessionId?: number | string;
      onlyAvailablePositions?: boolean;
    };
    cookie = body.cookie?.trim() ?? "";
    if (body.sessionId !== undefined && body.sessionId !== null) {
      const parsed = Number(body.sessionId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: "รหัส Pool (sessionId) ไม่ถูกต้อง" },
          { status: 400 },
        );
      }
      sessionId = parsed;
    }
    if (typeof body.onlyAvailablePositions === "boolean") {
      onlyAvailablePositions = body.onlyAvailablePositions;
    }
  } catch {
    return NextResponse.json(
      { error: "รูปแบบข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  if (!cookie) {
    return NextResponse.json({ error: "กรุณากรอก cookie" }, { status: 400 });
  }

  const headers = buildUpstreamHeaders(cookie, onlyAvailablePositions);

  try {
    const firstResponse = await fetch(
      buildInternApiUrl(
        sessionId,
        1,
        DEFAULT_PAGE_LIMIT,
        onlyAvailablePositions,
      ),
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );

    if (!firstResponse.ok) {
      return NextResponse.json(
        {
          error: `โหลดข้อมูลไม่สำเร็จ (HTTP ${firstResponse.status})`,
        },
        { status: firstResponse.status },
      );
    }

    const firstData = (await firstResponse.json()) as RawInternDataset;
    const combinedItems: RawInternItem[] = [...(firstData.items ?? [])];
    const meta = firstData.meta ?? null;

    // Fetch remaining pages in parallel when upstream caps itemsPerPage below totalItem
    if (meta && meta.totalPage > 1 && combinedItems.length < meta.totalItem) {
      const remainingPages = Array.from(
        { length: meta.totalPage - 1 },
        (_, index) => index + 2,
      );

      const pageDatasets = await Promise.all(
        remainingPages.map(async (page) => {
          const pageResponse = await fetch(
            buildInternApiUrl(
              sessionId,
              page,
              DEFAULT_PAGE_LIMIT,
              onlyAvailablePositions,
            ),
            {
              method: "GET",
              headers,
              cache: "no-store",
            },
          );

          if (!pageResponse.ok) {
            throw new Error(
              `โหลดข้อมูลหน้า ${page} ไม่สำเร็จ (HTTP ${pageResponse.status})`,
            );
          }

          return (await pageResponse.json()) as RawInternDataset;
        }),
      );

      for (const pageData of pageDatasets) {
        combinedItems.push(...(pageData.items ?? []));
      }
    }

    // Deduplicate across paginated pages while preserving order
    const uniqueItemsMap = new Map<number, RawInternItem>();
    for (const item of combinedItems) {
      if (!uniqueItemsMap.has(item.openingId)) {
        uniqueItemsMap.set(item.openingId, item);
      }
    }

    const details = transformRawItems(Array.from(uniqueItemsMap.values()));
    const jobs = buildJobListings(details);
    const allTags = collectTagsFromJobs(details);

    return NextResponse.json({
      jobs,
      allTags,
      meta,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
