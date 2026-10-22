import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { isLinkedIn, type LinkFinding } from "./people-audit";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blocked.addSubnet(address, prefix, "ipv6");
export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family === 6)
    return globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
  return false;
}
export function checkedUrl(value: string): URL {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    u.href.length > 2048
  )
    throw new Error(
      "Only public HTTPS links without credentials are supported.",
    );
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (
    (!isIP(host) && !host.includes(".")) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    (isIP(host) && !isPublicAddress(host))
  )
    throw new Error("Private or local network links are blocked.");
  u.hash = "";
  return u;
}
type Result = { status: number; location?: string };
// Pin the validated address to the TLS connection, preventing DNS rebinding.
async function probe(url: URL): Promise<Result> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("Source resolves to a private or reserved network.");
  const pinned = addresses.find((a) => a.family === 4) ?? addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "HEAD",
        family: pinned.family,
        agent: false,
        headers: {
          "User-Agent": "VantageLinkCheck/1.0",
          Accept: "text/html,application/pdf;q=0.9,*/*;q=0.1",
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, pinned.address, pinned.family),
      },
      (res) => {
        const result = {
          status: res.statusCode ?? 0,
          location: res.headers.location,
        };
        res.destroy();
        resolve(result);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Source timed out.")),
      3500,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
}
export async function checkLink(
  value: string,
  dependencies = { probe },
): Promise<LinkFinding> {
  const base = { url: value, checkedAt: new Date().toISOString() };
  let url: URL;
  try {
    url = checkedUrl(value);
  } catch {
    return {
      ...base,
      status: "unsafe",
      reason:
        "Unsupported or unsafe link. Review it without supplying credentials to this checker.",
    };
  }
  const seen = new Set<string>();
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (
      isLinkedIn(url.hostname) ||
      url.hostname === "lnkd.in" ||
      url.hostname.endsWith(".lnkd.in")
    )
      return {
        ...base,
        status: "restricted",
        finalUrl: url.href,
        reason:
          "LinkedIn requires an approved integration or manual review. This profile and its claims have not been verified.",
      };
    if (seen.has(url.href))
      return {
        ...base,
        status: "unavailable",
        reason: "Redirect loop. Manual review required.",
      };
    seen.add(url.href);
    try {
      const response = await dependencies.probe(url);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.location || redirects === 3)
          return {
            ...base,
            status: "unavailable",
            reason:
              "Redirect limit reached or destination missing. Manual review required.",
          };
        try {
          url = checkedUrl(new URL(response.location, url).href);
        } catch {
          return {
            ...base,
            status: "unsafe",
            reason:
              "Redirect destination is unsupported or unsafe. It was not visited.",
          };
        }
        continue;
      }
      if ([401, 403, 429, 999].includes(response.status))
        return {
          ...base,
          finalUrl: url.href,
          httpStatus: response.status,
          status: "restricted",
          reason:
            "Source requires access or limits automated checks. Manual review required.",
        };
      if (response.status === 405 || response.status === 501)
        return {
          ...base,
          finalUrl: url.href,
          httpStatus: response.status,
          status: "unsupported",
          reason:
            "Source does not support a lightweight link check. Open it for manual review.",
        };
      return {
        ...base,
        finalUrl: url.href,
        httpStatus: response.status,
        status:
          response.status >= 200 && response.status < 300
            ? "reachable"
            : "unavailable",
        reason:
          response.status >= 200 && response.status < 300
            ? "Source responded. Its content, identity, employment and qualifications still require review."
            : "Source did not return a successful response. This does not establish that the claim is false.",
      };
    } catch {
      return {
        ...base,
        status: "unavailable",
        reason:
          "Source could not be checked safely or did not respond in time. Manual review required.",
      };
    }
  }
  return { ...base, status: "unavailable", reason: "Manual review required." };
}
