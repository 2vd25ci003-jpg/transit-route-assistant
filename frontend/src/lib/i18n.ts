"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Locale = "en" | "kn";

export const DICTIONARY = {
  en: {
    appTitle: "Transit Search",
    liveDispatch: "Live Dispatch Active",
    findRoutes: "Find Routes",
    originPlaceholder: "Select origin stop...",
    destPlaceholder: "Select destination stop...",
    nearbyStops: "Nearby Stops",
    savedStops: "Saved Stops",
    favoriteRoutes: "Favorite Routes",
    serviceAlerts: "Service Alerts",
    allNormal: "All corridors running normally (Simulated)",
    bunchingAdvisory: "Minor bunching detected on trunk corridor (Simulated)",
    activeVehicles: "Active Vehicles",
    crowding: "Crowding",
    crowdLow: "Low",
    crowdMedium: "Medium",
    crowdHigh: "High",
    searchNav: "Search",
    routesNav: "Routes",
    mapNav: "3D Map",
    liveNav: "Live",
    adminNav: "Admin",
    liveFleetRadar: "Live Fleet Radar",
    operatorOps: "Operator Ops",
    minWalk: "min walk",
    away: "away",
    noApproaching: "No active buses approaching right now.",
  },
  kn: {
    appTitle: "ಸಾರಿಗೆ ಹುಡುಕಾಟ",
    liveDispatch: "ನೇರ ರವಾನೆ ಸಕ್ರಿಯವಾಗಿದೆ",
    findRoutes: "ಮಾರ್ಗಗಳನ್ನು ಹುಡುಕಿ",
    originPlaceholder: "ಆರಂಭಿಕ ನಿಲ್ದಾಣ ಆಯ್ಕೆಮಾಡಿ...",
    destPlaceholder: "ಗಮ್ಯಸ್ಥಾನ ನಿಲ್ದಾಣ ಆಯ್ಕೆಮಾಡಿ...",
    nearbyStops: "ಹತ್ತಿರದ ನಿಲ್ದಾಣಗಳು",
    savedStops: "ಉಳಿಸಿದ ನಿಲ್ದಾಣಗಳು",
    favoriteRoutes: "ನೆಚ್ಚಿನ ಮಾರ್ಗಗಳು",
    serviceAlerts: "ಸೇವಾ ಎಚ್ಚರಿಕೆಗಳು",
    allNormal: "ಎಲ್ಲಾ ಮಾರ್ಗಗಳು ಸಾಮಾನ್ಯವಾಗಿ ಚಲಿಸುತ್ತಿವೆ (Simulated)",
    bunchingAdvisory: "ಮುಖ್ಯ ಮಾರ್ಗದಲ್ಲಿ ಸಣ್ಣ ವಿಳಂಬ ಕಂಡುಬಂದಿದೆ (Simulated)",
    activeVehicles: "ಸಕ್ರಿಯ ಬಸ್ಸುಗಳು",
    crowding: "ಜನಸಂದಣಿ",
    crowdLow: "ಕಡಿಮೆ",
    crowdMedium: "ಮಧ್ಯಮ",
    crowdHigh: "ಹೆಚ್ಚು",
    searchNav: "ಹುಡುಕು",
    routesNav: "ಮಾರ್ಗಗಳು",
    mapNav: "3D ನಕ್ಷೆ",
    liveNav: "ಲೈವ್",
    adminNav: "ನಿರ್ವಾಹಕ",
    liveFleetRadar: "ನೇರ ಬಸ್ ರಾಡಾರ್",
    operatorOps: "ನಿರ್ವಾಹಕ ಕೇಂದ್ರ",
    minWalk: "ನಿಮಿಷ ನಡಿಗೆ",
    away: "ದೂರದಲ್ಲಿ",
    noApproaching: "ಪ್ರಸ್ತುತ ಯಾವುದೇ ಬಸ್ಸುಗಳು ಬರುತ್ತಿಲ್ಲ.",
  },
} as const;

export type TranslationKey = keyof (typeof DICTIONARY)["en"];

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => DICTIONARY.en[key],
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("transit_locale");
    if (saved === "en" || saved === "kn") {
      setLocaleState(saved);
    }
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem("transit_locale", next);
  }

  function t(key: TranslationKey): string {
    return DICTIONARY[locale][key] ?? DICTIONARY.en[key];
  }

  return React.createElement(
    I18nContext.Provider,
    { value: { locale, setLocale, t } },
    children
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
