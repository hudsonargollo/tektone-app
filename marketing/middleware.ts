import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tk_preview_auth";
const COOKIE_VALUE = "granted-9f2c";

export const config = {
  matcher: [
    "/((?!gate|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|mp4|webm|woff2?|ttf)$).*)",
  ],
};

export function middleware(req: NextRequest) {
  if (req.cookies.get(COOKIE_NAME)?.value === COOKIE_VALUE) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
