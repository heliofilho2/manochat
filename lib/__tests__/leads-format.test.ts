import { describe, expect, it } from "vitest";
import { isPublicHttpsUrl, leadsToCsv } from "../leads-format";

describe("leads", () => {
  it("only accepts public https endpoints", () => {
    expect(isPublicHttpsUrl("https://heliofilho.dev/api/leads")).toBe(true);
    expect(isPublicHttpsUrl("http://heliofilho.dev/api/leads")).toBe(false);
    expect(isPublicHttpsUrl("https://localhost/x")).toBe(false);
    expect(isPublicHttpsUrl("https://127.0.0.1/x")).toBe(false);
    expect(isPublicHttpsUrl("https://10.0.0.5/x")).toBe(false);
    expect(isPublicHttpsUrl("not a url")).toBe(false);
  });

  it("exports CSV with a BOM, quoting and formula protection", () => {
    const csv = leadsToCsv([
      {
        createdAt: new Date("2026-09-30T12:00:00Z"),
        username: "ana",
        email: "a@b.com",
        phone: "31999998888",
        trigger: '=SUM(1,2) "x"',
        source: "story",
        automation: "Story, guia",
      },
    ]);
    expect(csv.startsWith("﻿data,instagram,email,whatsapp,gatilho,origem,automacao")).toBe(true);
    expect(csv).toContain('"\'=SUM(1,2) ""x"""');
    expect(csv).toContain('"Story, guia"');
    expect(csv).toContain("@ana,a@b.com,31999998888");
  });
});
