import test from "node:test";
import assert from "node:assert/strict";
import {
  collectLinks,
  extractHtmlHrefs,
  claimFlags,
  reportSummary,
  isProfileUrl,
  type Claim,
  type Report,
} from "../lib/people-audit";
import { checkLink, checkedUrl, isPublicAddress } from "../lib/audit-links";
const claim: Claim = {
  id: "a",
  kind: "Employment",
  organisation: "Example",
  detail: "Engineer",
  start: "2020-01",
  end: "2023-01",
  evidence: "",
};
test("profile URLs require the actual LinkedIn host and a member path", () => {
  assert.equal(isProfileUrl("https://www.linkedin.com/in/example/"), true);
  for (const url of [
    "https://linkedin.com.evil.test/in/example",
    "https://linkedin.com/company/example",
    "http://linkedin.com/in/example",
    "https://a:b@linkedin.com/in/example",
  ])
    assert.equal(isProfileUrl(url), false);
});
test("all supplied text, anchors and claim evidence are deduplicated without dropping failures", () => {
  const urls = collectLinks(
    "https://linkedin.com/in/example",
    "See https://example.com/page. https://example.com/page#bio and http://localhost:3000",
    [{ ...claim, evidence: "https://example.org/cert" }],
    ["https://example.net/hidden", "javascript:alert(1)"],
  );
  assert.deepEqual(urls, [
    "https://linkedin.com/in/example",
    "https://example.com/page",
    "http://localhost:3000/",
    "https://example.net/hidden",
    "javascript:alert(1)",
    "https://example.org/cert",
  ]);
});
test("missing, reversed, future and overlapping dates need review", () => {
  assert.match(claimFlags({ ...claim, start: "" }, [claim]).join(), /missing/);
  assert.match(
    claimFlags({ ...claim, end: "2019-01" }, [claim]).join(),
    /precedes/,
  );
  assert.match(
    claimFlags({ ...claim, start: "2099-01" }, [claim]).join(),
    /future/,
  );
  assert.match(
    claimFlags(claim, [claim, { ...claim, id: "b", start: "2022-01" }]).join(),
    /overlap/,
  );
  assert.deepEqual(claimFlags(claim, [claim]), []);
});
test("reachable links never automatically confirm a claim", () => {
  const report: Report = {
    id: "r",
    name: "Example",
    profileUrl: "https://linkedin.com/in/example",
    createdAt: new Date().toISOString(),
    input: "",
    claims: [claim],
    links: [
      {
        url: "https://example.com",
        status: "reachable",
        reason: "OK",
        checkedAt: "",
      },
    ],
    reviews: {},
    sample: false,
  };
  assert.deepEqual(reportSummary(report), {
    confirmed: 0,
    discrepancies: 0,
    pending: 1,
    reachable: 1,
  });
});
test("private, loopback, reserved, metadata and mapped addresses are blocked", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.2",
    "192.168.1.2",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "192.0.2.1",
    "224.1.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002:7f00:1::",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])
    assert.equal(isPublicAddress(ip), true, ip);
});
test("unsafe URLs are refused before network access", async () => {
  for (const url of [
    "file:///etc/passwd",
    "http://example.com",
    "https://127.0.0.1",
    "https://[::1]",
    "https://user:pass@example.com",
    "https://example.com:8443",
    "https://localhost",
  ]) {
    assert.throws(() => checkedUrl(url));
    assert.equal(
      (
        await checkLink(url, {
          probe: async () => {
            throw new Error("must not fetch");
          },
        })
      ).status,
      "unsafe",
    );
  }
});
test("LinkedIn and its shortlinks are flagged without scraping", async () => {
  for (const url of [
    "https://www.linkedin.com/in/example",
    "https://uk.linkedin.com/company/example",
    "https://lnkd.in/example",
  ])
    assert.equal(
      (
        await checkLink(url, {
          probe: async () => {
            throw new Error("must not fetch");
          },
        })
      ).status,
      "restricted",
    );
});
test("redirects to private URLs are not visited", async () => {
  let calls = 0;
  const result = await checkLink("https://example.com", {
    probe: async () => {
      calls++;
      return {
        status: 302,
        location: "https://169.254.169.254/latest/meta-data",
      };
    },
  });
  assert.equal(result.status, "unsafe");
  assert.equal(calls, 1);
});
test("redirects to LinkedIn are flagged before visiting", async () => {
  let calls = 0;
  const result = await checkLink("https://example.com", {
    probe: async () => {
      calls++;
      return { status: 302, location: "https://linkedin.com/in/example" };
    },
  });
  assert.equal(result.status, "restricted");
  assert.equal(calls, 1);
});
test("reachable, restricted, unavailable and unsupported responses retain review caveats", async () => {
  for (const [code, status] of [
    [200, "reachable"],
    [403, "restricted"],
    [429, "restricted"],
    [404, "unavailable"],
    [405, "unsupported"],
  ] as const) {
    const result = await checkLink("https://example.com", {
      probe: async () => ({ status: code }),
    });
    assert.equal(result.status, status);
    assert.equal(result.httpStatus, code);
    assert.match(result.reason, /review|false/);
  }
});
test("timeouts and redirect loops always produce unresolved findings", async () => {
  assert.equal(
    (
      await checkLink("https://example.com", {
        probe: async () => {
          throw new Error("timeout");
        },
      })
    ).status,
    "unavailable",
  );
  assert.equal(
    (
      await checkLink("https://example.com", {
        probe: async () => ({ status: 302, location: "https://example.com" }),
      })
    ).status,
    "unavailable",
  );
});

test("HTML anchors are extracted without constructing a DOM or executing HTML", () => {
  assert.deepEqual(
    extractHtmlHrefs(
      `<a href="https://example.com/?a=1&amp;b=2">Bio</a><a href='/team'>Team</a><a href=https://example.org>Org</a>`,
    ),
    ["https://example.com/?a=1&b=2", "/team", "https://example.org"],
  );
});

test("a future certification expiry is not treated as a date conflict", () => {
  assert.deepEqual(claimFlags({ ...claim, kind: "Certification", end: "2099-01" }, [claim]), []);
});
