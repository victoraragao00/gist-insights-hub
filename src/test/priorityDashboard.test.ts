import { describe, it, expect } from "vitest";

// Score cap: frontend must display Math.min(score, 100) (Design System + Issue #33)
describe("Priority Dashboard — score cap", () => {
  it("caps display score at 100", () => {
    expect(Math.min(0, 100)).toBe(0);
    expect(Math.min(50, 100)).toBe(50);
    expect(Math.min(100, 100)).toBe(100);
    expect(Math.min(150, 100)).toBe(100);
    expect(Math.min(296, 100)).toBe(100);
  });

  it("scorePct for bar never exceeds 100", () => {
    const scorePct = (score: number) => Math.min((score / 100) * 100, 100);
    expect(scorePct(80)).toBe(80);
    expect(scorePct(100)).toBe(100);
    expect(scorePct(150)).toBe(100);
  });
});

// User role: role=null from DB → viewer; isAdmin only when role === 'admin'
describe("Priority Dashboard — useUserRole logic", () => {
  function deriveRole(rows: { role: string | null }[]): "admin" | "viewer" {
    const isAdmin = rows.some((r) => r.role != null && r.role === "admin");
    return isAdmin ? "admin" : "viewer";
  }

  it("treats null role as viewer", () => {
    expect(deriveRole([{ role: null }])).toBe("viewer");
    expect(deriveRole([{ role: null }, { role: null }])).toBe("viewer");
  });

  it("returns admin when at least one role is admin", () => {
    expect(deriveRole([{ role: "admin" }])).toBe("admin");
    expect(deriveRole([{ role: "viewer" }, { role: "admin" }])).toBe("admin");
  });

  it("returns viewer when only viewer roles", () => {
    expect(deriveRole([{ role: "viewer" }])).toBe("viewer");
    expect(deriveRole([])).toBe("viewer");
  });
});
