import { NextResponse } from "next/server";

import type { InternSession } from "@/app/lib/intern-transform";

const SESSIONS_API_URL =
  "https://cedtintern.cp.eng.chula.ac.th/api/common/sessions";

export async function POST(request: Request) {
  let cookie = "";

  try {
    const body = (await request.json()) as { cookie?: string };
    cookie = body.cookie?.trim() ?? "";
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
    const response = await fetch(SESSIONS_API_URL, {
      method: "GET",
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "th,en;q=0.9",
        cookie,
        referer:
          "https://cedtintern.cp.eng.chula.ac.th/opening?page=1&bookmarkedFilter=false&availablePositionFilter=false",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `ดึงรายการ Pool ไม่สำเร็จ (HTTP ${response.status})`,
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as InternSession[];
    const sessions = Array.isArray(data) ? data : [];

    return NextResponse.json({
      sessions,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ดึงรายการ Pool ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
