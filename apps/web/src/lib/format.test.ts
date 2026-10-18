import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatRelativeTime,
  severityLabel,
  titleCase,
} from "@/lib/format";

describe("format helpers", () => {
  it("normalizes enum labels for the interface", () => {
    expect(titleCase("service_doc")).toBe("服务文档");
    expect(severityLabel("sev1")).toBe("SEV1");
  });

  it("formats incident duration into compact units", () => {
    expect(
      formatDuration("2026-10-18T08:00:00Z", "2026-10-18T08:42:00Z"),
    ).toBe("42 分钟");
    expect(
      formatDuration("2026-10-18T08:00:00Z", "2026-10-18T10:15:00Z"),
    ).toBe("2 小时 15 分钟");
  });

  it("returns a readable relative timestamp", () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe(
      "5 分钟前",
    );
  });
});
