import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const PASSWORD = "quemtemseda";
const COOKIE_NAME = "tk_preview_auth";
const COOKIE_VALUE = "granted-9f2c";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (password !== PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return res;
}
