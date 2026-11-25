"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { BusStopMarkers } from "@/components/maps/BusStopMarkers";
import { CurrentLocation } from "@/components/maps/CurrentLocation";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { LocationMarker } from "@/components/maps/LocationMarker";
import { LocationSearch, SearchPlaceResult } from "@/components/maps/LocationSearch";
import { MapControls } from "@/components/maps/MapControls";
import { RouteDisplay } from "@/components/maps/RouteDisplay";
import { RouteInformation } from "@/components/maps/RouteInformation";
import { TransitMap } from "@/components/TransitMap";
import { api } from "@/lib/api";
import { CONFIG, hasGoogleMapsKey } from "@/lib/config";
import type { Stop } from "@/lib/types";
import type { LatLngPoint } from "@/services/locationService";
import {
  calculateRoute,
  RoutePlanResult,
  TravelModeOption,
} from "@/services/routeService";

export default function GoogleMapExplorerPage() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [origin, setOrigin] = useState<LatLngPoint | null>(null);
  const [originLabel, setOriginLabel] = useState<string>("");
  const [destination, setDestination] = useState<LatLngPoint | null>(null);
  const [destinationLabel, setDestinationLabel] = useState<string>("");
  const [userLocation, setUserLocation] = useState<LatLngPoint | null>(null);

  const [routeResult, setRouteResult] = useState<RoutePlanResult | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [travelMode, setTravelMode] = useState<TravelModeOption>("TRANSIT");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Load transit stops
  useEffect(() => {
    api
      .getStops()
      .then(setStops)
      .catch(() => setStops([]));
  }, []);

  // Compute route when origin and destination are set
  useEffect(() => {
    if (!origin || !destination) {
      setRouteResult(null);
      return;
    }

    let active = true;
    setRouteLoading(true);
    setRouteError(null);

    calculateRoute({
      origin,
      destination,
      travelMode,
      provideAlternatives: true,
    })
      .then((res) => {
        if (!active) return;
        setRouteResult(res);
        setSelectedRouteIndex(0);
      })
      .catch((err) => {
        if (!active) return;
        setRouteError(
          err instanceof Error
            ? err.message
            : "Could not calculate a route between these locations."
        );
        setRouteResult(null);
      })
      .finally(() => {
        if (active) setRouteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [origin, destination, travelMode]);

  function handleSelectStop(stop: Stop, role: "origin" | "destination") {
    if (role === "origin") {
      setOrigin({ lat: stop.lat, lng: stop.lng });
      setOriginLabel(stop.name);
    } else {
      setDestination({ lat: stop.lat, lng: stop.lng });
      setDestinationLabel(stop.name);
    }
  }

  function handleSelectSearchResult(place: SearchPlaceResult) {
    if (!origin) {
      setOrigin(place.location);
      setOriginLabel(place.name);
    } else {
      setDestination(place.location);
      setDestinationLabel(place.name);
    }
  }

  function handleClearRoute() {
    setOrigin(null);
    setOriginLabel("");
    setDestination(null);
    setDestinationLabel("");
    setRouteResult(null);
    setRouteError(null);
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="max-w-4xl mx-auto h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">
                map
              </span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-on-surface leading-none">
                Google Maps Transit Explorer
              </h1>
              <span className="text-[11px] text-primary font-semibold">
                {CONFIG.cityName} Network
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CurrentLocation
              onLocationFound={(loc) => {
                setUserLocation(loc);
                setOrigin(loc);
                setOriginLabel("My Current Location");
                map?.panTo(loc);
                map?.setZoom(15);
              }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-4 flex flex-col gap-4">
        {/* Location Search Bar with transit category filters */}
        <LocationSearch
          map={map}
          onSelectPlace={handleSelectSearchResult}
          placeholder="Search bus stands, railway stations, addresses..."
        />

        {/* Selected Endpoints Pills */}
        {(origin || destination) && (
          <div className="flex flex-wrap items-center gap-2 bg-surface-container rounded-xl p-3 border border-outline-variant/30 text-xs">
            {origin && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface">
                <span className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/20" />
                <span className="font-semibold text-primary">Origin:</span>
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {originLabel || `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOrigin(null);
                    setOriginLabel("");
                  }}
                  className="text-outline hover:text-on-surface ml-1"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    close
                  </span>
                </button>
              </div>
            )}

            {destination && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary ring-2 ring-tertiary/20" />
                <span className="font-semibold text-tertiary">Destination:</span>
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {destinationLabel || `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDestination(null);
                    setDestinationLabel("");
                  }}
                  className="text-outline hover:text-on-surface ml-1"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    close
                  </span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleClearRoute}
              className="text-outline hover:text-error ml-auto text-[11px] font-semibold"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Interactive Google Map Viewport (with OSM fallback if API key is not set) */}
        {!hasGoogleMapsKey() ? (
          <div className="flex flex-col gap-3">
            <div className="p-3.5 rounded-xl bg-tertiary/10 border border-tertiary/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">
                  key
                </span>
                <div>
                  <span className="font-semibold text-on-surface">
                    Google Maps API Key not set — showing OpenStreetMap fallback.
                  </span>{" "}
                  <span className="text-on-surface-variant">
                    Add{" "}
                    <code className="text-primary">
                      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                    </code>{" "}
                    to <code className="text-primary">frontend/.env.local</code>{" "}
                    and restart <code className="text-primary">npm run dev</code>{" "}
                    to enable Google Maps, Places &amp; Routes.
                  </span>
                </div>
              </div>
            </div>
            <TransitMap
              stops={stops}
              heightClass="h-[460px]"
              enableGoogleMapsToggle={true}
            />
          </div>
        ) : (
          <div className="relative">
            <GoogleMap
              center={origin || CONFIG.mapCenter}
              zoom={13}
              heightClass="h-[460px]"
              onMapLoaded={(m) => setMap(m)}
              onMapClick={(coords) => {
                if (!origin) {
                  setOrigin(coords);
                  setOriginLabel(
                    `Pin (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
                  );
                } else if (!destination) {
                  setDestination(coords);
                  setDestinationLabel(
                    `Pin (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
                  );
                }
              }}
            >
              {(m) => (
                <>
                  <MapControls
                    map={m}
                    onRecenter={() =>
                      m?.panTo(
                        origin ||
                          userLocation || {
                            lat: CONFIG.mapCenter.lat,
                            lng: CONFIG.mapCenter.lng,
                          }
                      )
                    }
                  />
                  <BusStopMarkers
                    map={m}
                    stops={stops}
                    onSelectStop={handleSelectStop}
                  />
                  {origin && (
                    <LocationMarker
                      map={m}
                      position={origin}
                      type="origin"
                      title={`Origin: ${originLabel}`}
                    />
                  )}
                  {destination && (
                    <LocationMarker
                      map={m}
                      position={destination}
                      type="destination"
                      title={`Destination: ${destinationLabel}`}
                    />
                  )}
                  {userLocation && (
                    <LocationMarker
                      map={m}
                      position={userLocation}
                      type="user"
                      title="Your Location"
                    />
                  )}
                  <RouteDisplay
                    map={m}
                    routeResult={routeResult}
                    selectedRouteIndex={selectedRouteIndex}
                  />
                </>
              )}
            </GoogleMap>
          </div>
        )}

        {/* Route Error Notification */}
        {routeError && (
          <div className="p-3.5 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              warning
            </span>
            <span>{routeError}</span>
          </div>
        )}

        {/* Route Information Card with Alternatives & Steps */}
        {routeResult && (
          <RouteInformation
            routeResult={routeResult}
            selectedRouteIndex={selectedRouteIndex}
            onSelectRouteIndex={setSelectedRouteIndex}
            onModeChange={setTravelMode}
            onClearRoute={handleClearRoute}
            loading={routeLoading}
          />
        )}

        {/* Quick Instructions & Help */}
        <div className="bg-surface-container rounded-2xl p-4 text-xs text-on-surface-variant flex flex-col gap-2 border border-outline-variant/20">
          <div className="font-semibold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">
              info
            </span>
            <span>How to use Google Maps Transit Planning</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-outline">
            <li>Search locations using Google Places autocomplete at the top.</li>
            <li>Click on any bus stop or railway station marker to set it as origin or destination.</li>
            <li>Click anywhere on the map to drop custom origin/destination pins.</li>
            <li>Toggle between Transit, Driving, and Walking modes to compare travel durations.</li>
          </ul>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
