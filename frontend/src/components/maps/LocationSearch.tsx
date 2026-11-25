"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/services/googleMapsService";
import type { LatLngPoint } from "@/services/locationService";

export interface SearchPlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: LatLngPoint;
  category: "all" | "bus" | "railway" | "poi";
}

interface LocationSearchProps {
  map?: google.maps.Map | null;
  onSelectPlace: (place: SearchPlaceResult) => void;
  placeholder?: string;
}

export function LocationSearch({
  map,
  onSelectPlace,
  placeholder = "Search locations, bus stands, or railway stations...",
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [activeCategory, setActiveCategory] = useState<"all" | "bus" | "railway">("all");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled) return;
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        if (map) {
          placesServiceRef.current = new google.maps.places.PlacesService(map);
        }
      })
      .catch(() => {
        // Handled gracefully
      });

    return () => {
      cancelled = true;
    };
  }, [map]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim() || query.length < 2) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      if (!autocompleteServiceRef.current) {
        setLoading(false);
        return;
      }

      let searchQuery = query;
      if (activeCategory === "bus" && !query.toLowerCase().includes("bus")) {
        searchQuery = `${query} bus stand`;
      } else if (activeCategory === "railway" && !query.toLowerCase().includes("railway")) {
        searchQuery = `${query} railway station`;
      }

      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: searchQuery,
          componentRestrictions: { country: "in" },
        },
        (results, status) => {
          setLoading(false);
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            results &&
            results.length > 0
          ) {
            setPredictions(results.slice(0, 5));
            setIsOpen(true);
          } else {
            setPredictions([]);
            setIsOpen(false);
          }
        }
      );
    }, 250);
  }, [query, activeCategory]);

  function handleSelectPrediction(pred: google.maps.places.AutocompletePrediction) {
    setQuery(pred.structured_formatting?.main_text || pred.description);
    setIsOpen(false);

    if (!map) return;
    if (!placesServiceRef.current) {
      placesServiceRef.current = new google.maps.places.PlacesService(map);
    }

    placesServiceRef.current.getDetails(
      {
        placeId: pred.place_id,
        fields: ["name", "formatted_address", "geometry", "types"],
      },
      (place, status) => {
        if (
          status === google.maps.places.PlacesServiceStatus.OK &&
          place?.geometry?.location
        ) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();

          let category: SearchPlaceResult["category"] = "poi";
          const types = place.types || [];
          if (types.includes("bus_station") || place.name?.toLowerCase().includes("bus")) {
            category = "bus";
          } else if (types.includes("train_station") || place.name?.toLowerCase().includes("railway")) {
            category = "railway";
          }

          const result: SearchPlaceResult = {
            placeId: pred.place_id,
            name: place.name || pred.structured_formatting?.main_text || "Selected Place",
            formattedAddress: place.formatted_address || pred.description,
            location: { lat, lng },
            category,
          };

          map.panTo({ lat, lng });
          map.setZoom(15);
          onSelectPlace(result);
        }
      }
    );
  }

  return (
    <div className="relative w-full z-20">
      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
            activeCategory === "all"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          All Places
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("bus")}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
            activeCategory === "bus"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">
            directions_bus
          </span>
          <span>Bus Stands</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("railway")}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
            activeCategory === "railway"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">train</span>
          <span>Railway Stations</span>
        </button>
      </div>

      {/* Input Field */}
      <div className="flex items-center bg-surface-container rounded-xl px-3.5 h-12 shadow-md border border-outline-variant/30 focus-within:border-primary transition-colors">
        <span className="material-symbols-outlined text-primary text-[20px] mr-2.5 shrink-0">
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="bg-transparent text-on-surface text-sm w-full focus:outline-none placeholder:text-outline"
        />
        {loading && (
          <span className="material-symbols-outlined text-primary text-[18px] animate-spin mr-2">
            progress_activity
          </span>
        )}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setPredictions([]);
              setIsOpen(false);
            }}
            className="text-outline hover:text-on-surface p-1"
          >
            <span className="material-symbols-outlined text-[18px]">
              cancel
            </span>
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface-container rounded-xl shadow-2xl border border-outline-variant/40 overflow-hidden divide-y divide-outline-variant/20 z-30">
          {predictions.map((p) => {
            const isBus = p.description.toLowerCase().includes("bus");
            const isTrain = p.description.toLowerCase().includes("railway") || p.description.toLowerCase().includes("train");

            return (
              <button
                key={p.place_id}
                type="button"
                onClick={() => handleSelectPrediction(p)}
                className="w-full p-3 text-left hover:bg-surface-container-high flex items-start gap-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 text-primary mt-0.5">
                  <span className="material-symbols-outlined text-[18px]">
                    {isBus ? "directions_bus" : isTrain ? "train" : "location_on"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-on-surface truncate">
                    {p.structured_formatting?.main_text || p.description}
                  </div>
                  <div className="text-xs text-on-surface-variant truncate">
                    {p.structured_formatting?.secondary_text || p.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
