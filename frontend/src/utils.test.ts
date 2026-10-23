import { expect, it, vi } from "vitest";
import { dated, day, time } from "./utils";

it("new manual entries keep the actual time in Dhaka across midnight", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-10-23T19:23:45.123Z"));
    expect(day()).toBe("2026-10-24");
    expect(dated(day())).toBe("2026-10-24T01:23:45.123+06:00");
    expect(time(dated(day()))).toBe("01:23:45");
  } finally {
    vi.useRealTimers();
  }
});

it("editing a transaction preserves its original time, including a changed day", () => {
  const original = "2026-10-20T21:11:12.456Z";
  expect(new Date(dated(day(original), original)).toISOString()).toBe(original);
  expect(dated("2026-10-25", original)).toBe("2026-10-25T03:11:12.456+06:00");
});
