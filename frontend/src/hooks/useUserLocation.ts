/**
 * useUserLocation Hook
 * Handles browser location access, user permission queries, accuracy, and error states.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getCurrentUserCoordinates,
  LatLngPoint,
  reverseGeocode,
} from "@/services/locationService";

export type LocationPermissionState = "prompt" | "granted" | "denied" | "unsupported";

export function useUserLocation() {
  const [location, setLocation] = useState<LatLngPoint | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] =
    useState<LocationPermissionState>("prompt");

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.permissions) {
      return;
    }

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        setPermissionState(status.state as LocationPermissionState);
        status.onchange = () => {
          setPermissionState(status.state as LocationPermissionState);
        };
      })
      .catch(() => {
        // Fallback if permissions query fails
      });
  }, []);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const coords = await getCurrentUserCoordinates();
      setLocation(coords);
      setPermissionState("granted");

      // Attempt reverse geocode to get a clean address label
      try {
        const geo = await reverseGeocode(coords);
        setAddress(geo.formattedAddress);
      } catch {
        setAddress(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      }
      return coords;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Location access failed";
      setError(msg);
      if (msg.includes("denied")) {
        setPermissionState("denied");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    location,
    address,
    loading,
    error,
    permissionState,
    requestLocation,
  };
}
