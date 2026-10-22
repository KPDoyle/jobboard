import { NextResponse } from "next/server";
import { checkLink } from "../../../../lib/audit-links";
import { MAX_LINKS } from "../../../../lib/people-audit";
export const runtime = "nodejs";
export const maxDuration = 60;
// Per-instance safeguards only. Shared authenticated quotas are required before production use.
let active = 0;
let windowStart = Date.now();
let checksInWindow = 0;
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(
      origin &&
        ["http:", "https:"].includes(new URL(origin).protocol) &&
        new URL(origin).host === request.headers.get("host"),
    );
  } catch {}
  if (!sameOrigin)
    return NextResponse.json(
      { error: "Open the audit workspace on this site to run a check." },
      { status: 403, headers },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json(
      { error: "Expected JSON." },
      { status: 415, headers },
    );
  if (active >= 2)
    return NextResponse.json(
      { error: "The checker is busy. Try again shortly." },
      { status: 429, headers },
    );
  let values: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 100000) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Request is too large." },
          { status: 413, headers },
        );
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    values = JSON.parse(text).urls;
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400, headers },
    );
  }
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > MAX_LINKS ||
    !values.every((u) => typeof u === "string" && u.length <= 2048)
  )
    return NextResponse.json(
      {
        error: `Supply 1–${MAX_LINKS} links, each at most 2,048 characters. Split larger profiles into separate audits.`,
      },
      { status: 400, headers },
    );
  if (Date.now() - windowStart > 60000) {
    windowStart = Date.now();
    checksInWindow = 0;
  }
  if (checksInWindow >= 12)
    return NextResponse.json(
      { error: "Demo check limit reached. Please retry in a minute." },
      { status: 429, headers },
    );
  checksInWindow++;
  const urls = [...new Set(values)] as string[];
  active++;
  try {
    const results: Awaited<ReturnType<typeof checkLink>>[] = [];
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(5, urls.length) }, async () => {
        while (cursor < urls.length) {
          const index = cursor++;
          // Include DNS resolution and all redirects in the per-link deadline.
          results[index] = await Promise.race([
            checkLink(urls[index]),
            new Promise<Awaited<ReturnType<typeof checkLink>>>((resolve) => {
              const timer = setTimeout(
                () =>
                  resolve({
                    url: urls[index],
                    status: "unavailable",
                    checkedAt: new Date().toISOString(),
                    reason: "Check timed out. Manual review required.",
                  }),
                5000,
              );
              timer.unref();
            }),
          ]);
        }
      }),
    );
    return NextResponse.json({ links: results }, { headers });
  } finally {
    active--;
  }
}
