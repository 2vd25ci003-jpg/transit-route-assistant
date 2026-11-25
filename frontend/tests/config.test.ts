import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/lib/config";

describe("Frontend configuration", () => {
  it("provides default Hubli-Dharwad map center and API URL", () => {
    expect(CONFIG.apiUrl).toBe("http://localhost:8000");
    expect(CONFIG.cityName).toBe("Hubli-Dharwad");
    expect(CONFIG.mapCenter.lat).toBeCloseTo(15.405, 2);
    expect(CONFIG.mapCenter.lng).toBeCloseTo(75.065, 2);
  });
});
