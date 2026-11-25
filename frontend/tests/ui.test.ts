import { describe, expect, it } from "vitest";
import { DICTIONARY } from "../src/lib/i18n";
import { getSimulatedCrowding } from "../src/lib/storage";

describe("i18n dictionary (English & Kannada)", () => {
  it("contains matching keys in both en and kn locales", () => {
    const enKeys = Object.keys(DICTIONARY.en).sort();
    const knKeys = Object.keys(DICTIONARY.kn).sort();
    expect(knKeys).toEqual(enKeys);
    for (const k of knKeys) {
      expect(DICTIONARY.kn[k as keyof typeof DICTIONARY.kn].length).toBeGreaterThan(0);
    }
  });
});

describe("Simulated crowding helper", () => {
  it("returns Low, Medium, or High deterministically", () => {
    const levels = new Set([
      getSimulatedCrowding(1, 1),
      getSimulatedCrowding(2, 1),
      getSimulatedCrowding(3, 2),
      getSimulatedCrowding(5, 3),
    ]);
    for (const lvl of levels) {
      expect(["Low", "Medium", "High"]).toContain(lvl);
    }
  });
});
