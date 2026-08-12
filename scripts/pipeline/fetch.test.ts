// OPEN-QUESTIONS.md: "Whether a third-party source going fully unreachable (not just
// wrong-looking) is guaranteed to trigger the same GitHub-issue alert as a sanity-rule
// failure." The actual GitHub-issue alert is Milestone 6 (GitHub Actions) and doesn't exist
// yet — what's testable now, at the pipeline layer, is the signal Milestone 6's alert step
// will hook into: a fetch failure must surface as a thrown error (not get swallowed), the same
// way a validate.ts sanity-rule failure does, so both end up as run-pipeline.ts's uniform
// "blocked" status and non-zero exit code (scripts/run-pipeline.ts).

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRaw } from "./fetch.js";
import { runChain } from "./run.js";

describe("fetchRaw failure -> alert-path signal", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws when the host is unreachable (dead URL), instead of returning empty/partial content", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchRaw("https://this-domain-should-not-resolve.invalid/")).rejects.toThrow();
  });

  it("throws a descriptive error on a non-OK HTTP response (e.g. page removed, server down)", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("", { status: 503, statusText: "Service Unavailable" }));
    await expect(fetchRaw("https://example.com/dead-page")).rejects.toThrow(/503/);
  });

  it("propagates a dead source unhandled out of runChain, exactly like a sanity-rule failure would", async () => {
    // Mirrors what scripts/run-pipeline.ts's per-chain try/catch relies on: runChain must not
    // swallow a fetch failure partway through — it has to reject so the caller can record
    // status "blocked" and exit non-zero, same as validate.ts rejecting a bad extraction does.
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(runChain("jollibee", { commit: false })).rejects.toThrow();
  });
});
