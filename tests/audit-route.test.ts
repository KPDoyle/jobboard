import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/people-audit/links/route";
function request(body: unknown, origin = "http://127.0.0.1:3000") {
  return new Request("http://localhost:3000/api/people-audit/links", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
test("origin validation uses the original host, including local preview aliases", async () => {
  const response = await POST(
    request({ urls: ["https://linkedin.com/in/test"] }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.links.length, 1);
  assert.equal(body.links[0].status, "restricted");
});
test("cross-origin browser requests are rejected", async () => {
  assert.equal(
    (
      await POST(
        request(
          { urls: ["https://linkedin.com/in/test"] },
          "https://different.example",
        ),
      )
    ).status,
    403,
  );
});
test("over-limit requests fail rather than silently dropping links", async () => {
  assert.equal(
    (
      await POST(
        request({
          urls: Array.from(
            { length: 41 },
            (_, i) => `https://example.com/${i}`,
          ),
        }),
      )
    ).status,
    400,
  );
});
test("each supplied link receives an outcome and duplicates are removed", async () => {
  const response = await POST(
    request({
      urls: [
        "https://linkedin.com/in/test",
        "https://127.0.0.1",
        "https://linkedin.com/in/test",
      ],
    }),
  );
  const body = await response.json();
  assert.deepEqual(
    body.links.map((link: { status: string }) => link.status),
    ["restricted", "unsafe"],
  );
});
