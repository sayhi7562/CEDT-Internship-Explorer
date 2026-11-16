import { NextResponse } from "next/server";

import {
  buildJobListings,
  collectTagsFromJobs,
  transformRawItems,
  type RawInternDataset,
} from "@/app/lib/intern-transform";

function buildInternApiUrl(sessionId: number): string {
  return `https://cedtintern.cp.eng.chula.ac.th/api/sessions/${sessionId}/openings?search=&page=1&limit=2000&onlyBookmarked=false&onlyAvailablePositions=true`;
}

export async function POST(request: Request) {
  let cookie = "";
  let sessionId = 5;

  try {
    const body = (await request.json()) as {
      cookie?: string;
      sessionId?: number | string;
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
  } catch {
    return NextResponse.json(
      { error: "รูปแบบข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  if (!cookie) {
    return NextResponse.json({ error: "กรุณากรอก cookie" }, { status: 400 });
  }

  try {
    const response = await fetch(buildInternApiUrl(sessionId), {
      method: "GET",
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "th,en;q=0.9",
        cookie,
        referer:
          "https://cedtintern.cp.eng.chula.ac.th/opening?page=1&bookmarkedFilter=false&availablePositionFilter=true",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `โหลดข้อมูลไม่สำเร็จ (HTTP ${response.status})`,
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as RawInternDataset;
    const details = transformRawItems(data.items ?? []);
    const jobs = buildJobListings(details);
    const allTags = collectTagsFromJobs(details);

    return NextResponse.json({
      jobs,
      allTags,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
