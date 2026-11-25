import { describe, expect, it } from "vitest";
import { CONFIG, hasGoogleMapsKey } from "../src/lib/config";
import {
  loadGoogleMaps,
  TRANSIT_AI_MAP_STYLE,
} from "../src/services/googleMapsService";

describe("Google Maps Platform Configuration & Service", () => {
  it("configures Google Maps libraries and checks API key state", () => {
    expect(CONFIG.googleMaps.libraries).toContain("places");
    expect(CONFIG.googleMaps.libraries).toContain("geometry");
    expect(CONFIG.googleMaps.libraries).toContain("routes");
    // In test environment without key, hasGoogleMapsKey returns false
    expect(typeof hasGoogleMapsKey()).toBe("boolean");
  });

  it("exports valid custom dark map styles matching TransitAI theme", () => {
    expect(Array.isArray(TRANSIT_AI_MAP_STYLE)).toBe(true);
    expect(TRANSIT_AI_MAP_STYLE.length).toBeGreaterThan(0);
    const geometryStyle = TRANSIT_AI_MAP_STYLE.find(
      (s) => s.elementType === "geometry"
    );
    expect(geometryStyle).toBeDefined();
    expect(geometryStyle?.stylers?.[0]?.color).toBe("#0b1326");
  });

  it("throws a descriptive error when loadGoogleMaps is called without an API key", async () => {
    if (!hasGoogleMapsKey()) {
      await expect(loadGoogleMaps()).rejects.toThrow(
        /Missing Google Maps API Key/i
      );
    }
  });
});
