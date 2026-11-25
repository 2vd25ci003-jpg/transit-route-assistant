"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/KpiCard";
import { TransitMap } from "@/components/TransitMap";
import { api, getStoredAdminKey, setStoredAdminKey } from "@/lib/api";
import { CONFIG } from "@/lib/config";
import type {
  AdminAnalytics,
  BenchmarkResults,
  ForecastResponse,
  OptimizeResponse,
  Vehicle,
} from "@/lib/types";

export default function AdminDashboardPage() {
  const [adminKey, setAdminKey] = useState<string>("");
  const [keyInput, setKeyInput] = useState<string>("");
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkResults | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<number>(1);
  const [fleetSize, setFleetSize] = useState<number>(2);
  const [optResult, setOptResult] = useState<OptimizeResponse | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard(keyOverride?: string) {
    const activeKey = keyOverride ?? adminKey;
    if (!activeKey) return;
    try {
      const [aData, vData, bData] = await Promise.all([
        api.getAdminAnalytics(activeKey),
        api.getVehicles(),
        api.getBenchmarkResults(activeKey).catch(() => null),
      ]);
      setAnalytics(aData);
      setVehicles(vData);
      setBenchmarks(bData);
      if (aData.stop_demands.length > 0) {
        const firstId = aData.stop_demands[0].stop_id;
        setSelectedStopId((prev) => prev || firstId);
      }
      setAuthenticated(true);
      setAuthError(null);
      setError(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load admin analytics";
      if (
        msg.toLowerCase().includes("admin") ||
        msg.toLowerCase().includes("key") ||
        msg.includes("401") ||
        msg.includes("403")
      ) {
        setAuthenticated(false);
        setStoredAdminKey("");
        setAuthError(msg);
      } else {
        setError(msg);
      }
    }
  }

  useEffect(() => {
    const saved = getStoredAdminKey();
    if (saved) {
      setAdminKey(saved);
      loadDashboard(saved);
    }
  }, []);

  function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setAuthError("Please enter the Admin API key.");
      return;
    }
    setStoredAdminKey(trimmed);
    setAdminKey(trimmed);
    loadDashboard(trimmed);
  }

  function handleAdminLogout() {
    setStoredAdminKey("");
    setAdminKey("");
    setKeyInput("");
    setAuthenticated(false);
    setAnalytics(null);
    setBenchmarks(null);
  }

  useEffect(() => {
    if (!selectedStopId) return;
    api
      .getForecast(selectedStopId, 6)
      .then(setForecast)
      .catch(() => setForecast(null));
  }, [selectedStopId]);

  async function handleOptimize() {
    if (!analytics || analytics.stop_demands.length < 2) return;
    try {
      setOptLoading(true);
      const stopIds = analytics.stop_demands.map((s) => s.stop_id);
      const res = await api.optimizeDispatch(stopIds, fleetSize, stopIds[0]);
      setOptResult(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Optimization request failed"
      );
    } finally {
      setOptLoading(false);
    }
  }

  const maxHourlyVal = analytics
    ? Math.max(
        1,
        ...analytics.hourly_demand_series.flatMap((p) => [
          p.actual_avg,
          p.forecast_avg,
        ])
      )
    : 50;

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center p-6">
        <form
          onSubmit={handleAdminLogin}
          className="w-full max-w-md bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 shadow-2xl flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">
                lock
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-on-surface">
                Operator Admin Login
              </h1>
              <p className="text-xs text-on-surface-variant">
                Enter your <code>X-Admin-Key</code> to access fleet telemetry
              </p>
            </div>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
              {authError}
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-on-surface-variant font-semibold">
              Admin API Key
            </span>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="transit-admin-dev-key"
              className="h-11 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface focus:outline-none focus:border-primary"
            />
          </label>

          <div className="flex items-center justify-between gap-3 pt-1">
            <Link
              href="/"
              className="text-xs text-on-surface-variant hover:text-on-surface"
            >
              ← Back to Passenger View
            </Link>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90"
            >
              Sign In
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-surface-container-low border-r border-outline-variant/20 flex-col justify-between py-5 px-4 z-40">
        <div>
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">
                departure_board
              </span>
            </div>
            <div>
              <div className="text-sm font-bold text-on-surface">
                METRO OPS
              </div>
              <div className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                {CONFIG.cityName}
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5">
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold"
            >
              <span className="material-symbols-outlined text-[20px]">
                dashboard
              </span>
              <span>Overview</span>
            </Link>
            <Link
              href="/live"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[20px]">
                radar
              </span>
              <span>Live Fleet Map</span>
            </Link>
            <Link
              href="/routes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[20px]">
                alt_route
              </span>
              <span>Routes & Stops</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[20px]">
                search
              </span>
              <span>Passenger View</span>
            </Link>
          </nav>
        </div>

        <div className="bg-surface-container rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-on-surface-variant uppercase">
              Backend API
            </span>
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="text-xs text-on-surface font-mono truncate">
            {CONFIG.apiUrl}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64">
        <header className="sticky top-0 z-30 h-16 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-on-surface">
              {CONFIG.cityName} Fleet Operations
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-xs font-semibold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
              Live Telemetry
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadDashboard()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[18px]">
                autorenew
              </span>
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleAdminLogout}
              className="px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-semibold"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="p-6 flex flex-col gap-6 max-w-7xl mx-auto">
          {error && (
            <div className="p-4 rounded-xl bg-error-container text-on-error-container text-sm">
              {error}
            </div>
          )}

          {/* KPI Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Average Headway"
              value={analytics ? analytics.avg_headway_min : "—"}
              unit="min"
              subtitle="Target: 10.0 min scheduled"
              icon="timer"
              accent="primary"
            />
            <KpiCard
              label="Bunching Alerts"
              value={analytics ? analytics.bunching_alerts : "—"}
              unit="events"
              subtitle="Headway < 4.0 min threshold"
              icon="merge_type"
              accent="tertiary"
            />
            <KpiCard
              label="Forecast Model"
              value="RF"
              unit={forecast?.model_type === "random_forest" ? "Live" : "Mean"}
              subtitle="Random Forest vs Prev-Week"
              icon="analytics"
              accent="secondary"
            />
            <KpiCard
              label="Active Vehicles"
              value={analytics ? analytics.active_vehicles : "—"}
              unit={`/ ${analytics?.total_routes ?? 0} routes`}
              subtitle={`${analytics?.total_stops ?? 0} total stops`}
              icon="directions_bus"
              accent="primary"
            />
          </section>

          {/* Map + Headway Variance */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-surface-container-low rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-on-surface">
                    Corridor Demand Heatmap & Live Fleet
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Circle radius & amber color indicate higher average hourly
                    boardings
                  </p>
                </div>
              </div>

              <TransitMap
                stopDemands={analytics?.stop_demands ?? []}
                vehicles={vehicles}
                heightClass="h-[380px]"
              />
            </div>

            <div className="lg:col-span-5 bg-surface-container-low rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-on-surface">
                    Headway Variance by Route
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Measured from recent simulated & historical trips
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {(analytics?.route_headways ?? []).map((rh) => {
                  const isBunching = rh.status === "bunching";
                  const pct = Math.min(
                    100,
                    Math.round((rh.avg_headway_min / 15) * 100)
                  );
                  return (
                    <div
                      key={rh.route_id}
                      className="bg-surface-container p-3.5 rounded-xl flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-on-surface truncate">
                          {rh.route_name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                            isBunching
                              ? "bg-tertiary/20 text-tertiary"
                              : "bg-primary/20 text-primary"
                          }`}
                        >
                          {isBunching
                            ? `${rh.bunching_events} Bunching`
                            : "Nominal"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant">
                        <span>Avg: {rh.avg_headway_min}m</span>
                        <span>StdDev: {rh.headway_std_min}m</span>
                        <span>Target: {rh.target_headway_min}m</span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isBunching ? "bg-tertiary" : "bg-primary"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Bottom Grid: Forecast vs Actual + OR-Tools Optimizer */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Forecast vs Actual */}
            <div className="bg-surface-container-low rounded-xl p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-on-surface">
                    Hourly Demand: Actual vs RF Forecast
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    60-day hourly boarding profile across network stops
                  </p>
                </div>
                <select
                  aria-label="Select stop for 6h forecast"
                  value={selectedStopId}
                  onChange={(e) => setSelectedStopId(Number(e.target.value))}
                  className="bg-surface-container text-on-surface text-xs rounded-lg px-3 py-1.5"
                >
                  {(analytics?.stop_demands ?? []).map((s) => (
                    <option key={s.stop_id} value={s.stop_id}>
                      {s.stop_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bar comparison chart */}
              <div className="bg-surface-container-lowest rounded-xl p-4 flex items-end gap-1.5 h-52 overflow-x-auto">
                {(analytics?.hourly_demand_series ?? []).map((pt) => {
                  const actualH = Math.max(
                    6,
                    Math.round((pt.actual_avg / maxHourlyVal) * 140)
                  );
                  const predH = Math.max(
                    6,
                    Math.round((pt.forecast_avg / maxHourlyVal) * 140)
                  );
                  return (
                    <div
                      key={pt.hour}
                      className="flex-1 min-w-[24px] flex flex-col items-center gap-1"
                    >
                      <div className="flex items-end gap-0.5 h-36">
                        <div
                          title={`Actual ${pt.label}: ${pt.actual_avg}`}
                          className="w-2.5 bg-primary rounded-t"
                          style={{ height: `${actualH}px` }}
                        />
                        <div
                          title={`Forecast ${pt.label}: ${pt.forecast_avg}`}
                          className="w-2.5 bg-secondary/75 rounded-t"
                          style={{ height: `${predH}px` }}
                        />
                      </div>
                      <span className="text-[10px] text-outline font-mono">
                        {pt.hour}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded bg-primary" /> Actual Avg
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded bg-secondary/75" /> RF
                  Forecast
                </span>
              </div>

              {forecast && (
                <div className="bg-surface-container rounded-lg p-3 text-xs">
                  <div className="font-semibold text-on-surface mb-1.5">
                    Next {forecast.horizon_hours}h Forecast for{" "}
                    {forecast.stop_name} ({forecast.model_type})
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {forecast.predictions.slice(0, 6).map((p, idx) => (
                      <div
                        key={`${p.ts}-${idx}`}
                        className="bg-surface-container-high p-2 rounded flex flex-col"
                      >
                        <span className="text-outline font-mono">
                          {new Date(p.ts).getHours()}:00
                        </span>
                        <span className="text-primary font-bold">
                          {p.predicted_count} pax
                        </span>
                        <span className="text-[10px] text-on-surface-variant">
                          Base: {p.baseline_count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Fleet Dispatch Optimizer */}
            <div className="bg-surface-container-low rounded-xl p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-on-surface">
                    Fleet Dispatch Optimizer (OR-Tools)
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Compares OR-Tools mTSP against Nearest-Neighbor baseline
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-on-surface-variant">
                    Fleet:
                  </label>
                  <select
                    aria-label="Fleet size"
                    value={fleetSize}
                    onChange={(e) => setFleetSize(Number(e.target.value))}
                    className="bg-surface-container text-on-surface text-xs rounded-lg px-2.5 py-1.5"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "Bus" : "Buses"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleOptimize}
                    disabled={optLoading}
                    className="px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {optLoading ? "Solving..." : "Run Optimizer"}
                  </button>
                </div>
              </div>

              {!optResult ? (
                <div className="bg-surface-container rounded-xl p-6 text-center text-xs text-on-surface-variant">
                  Click <strong>Run Optimizer</strong> to compute balanced
                  dispatch routes across all {analytics?.total_stops ?? 15}{" "}
                  stops.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-surface-container p-3 rounded-lg">
                      <div className="text-[11px] text-on-surface-variant">
                        OR-Tools Total
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {optResult.total_distance_km} km
                      </div>
                    </div>
                    <div className="bg-surface-container p-3 rounded-lg">
                      <div className="text-[11px] text-on-surface-variant">
                        NN Baseline
                      </div>
                      <div className="text-lg font-bold text-on-surface">
                        {optResult.baseline_distance_km} km
                      </div>
                    </div>
                    <div className="bg-surface-container p-3 rounded-lg">
                      <div className="text-[11px] text-on-surface-variant">
                        Savings
                      </div>
                      <div className="text-lg font-bold text-secondary">
                        {optResult.savings_pct > 0
                          ? `-${optResult.savings_pct}%`
                          : `${optResult.savings_pct}%`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                    {optResult.routes.map((r) => (
                      <div
                        key={r.vehicle_id}
                        className="bg-surface-container p-3 rounded-lg text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-on-surface mb-1">
                          <span>Bus #{r.vehicle_id}</span>
                          <span className="text-primary font-mono">
                            {r.distance_km} km ({r.stop_ids.length} stops)
                          </span>
                        </div>
                        <div className="text-on-surface-variant leading-relaxed">
                          {r.stop_names.join(" → ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Benchmark Results Card */}
          {benchmarks && (
            <section className="bg-surface-container-low rounded-xl p-5 flex flex-col gap-4 border border-outline-variant/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-on-surface">
                      System Benchmark Results
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[11px] font-semibold">
                      Synthetic &amp; Simulated Data
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {benchmarks.synthetic_data_note} (Generated:{" "}
                    {benchmarks.generated_at})
                  </p>
                </div>
                <span className="text-xs font-mono text-primary">
                  /routes/search p95: {benchmarks.route_search_latency.p95_ms}{" "}
                  ms
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Forecast */}
                <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2">
                  <div className="font-semibold text-on-surface flex items-center justify-between">
                    <span>Demand Forecast (Test)</span>
                    <span className="text-primary font-mono">
                      +{benchmarks.forecast.mae_improvement_pct}% MAE
                    </span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Random Forest MAE / RMSE</span>
                    <span className="font-mono text-on-surface font-semibold">
                      {benchmarks.forecast.rf_mae} /{" "}
                      {benchmarks.forecast.rf_rmse}
                    </span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Prev-Week Baseline</span>
                    <span className="font-mono">
                      {benchmarks.forecast.baseline_mae} /{" "}
                      {benchmarks.forecast.baseline_rmse}
                    </span>
                  </div>
                </div>

                {/* Optimizer */}
                <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2">
                  <div className="font-semibold text-on-surface">
                    Optimizer (OR-Tools vs NN)
                  </div>
                  {benchmarks.optimizer.map((opt) => (
                    <div
                      key={opt.fleet_size}
                      className="flex justify-between text-on-surface-variant"
                    >
                      <span>{opt.fleet_size} buses:</span>
                      <span className="font-mono text-on-surface">
                        {opt.ortools_km} km vs {opt.baseline_km} km (
                        <span className="text-primary">
                          -{opt.savings_pct}%
                        </span>
                        )
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bunching Experiment */}
                <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2">
                  <div className="font-semibold text-on-surface flex items-center justify-between">
                    <span>Holding Strategy (Simulated)</span>
                    <span className="text-tertiary font-mono">
                      {benchmarks.bunching.std_reduction_pct}% StdDev
                    </span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Without Holding (StdDev / Bunching)</span>
                    <span className="font-mono text-on-surface">
                      {benchmarks.bunching.without_holding.headway_std_min}m /{" "}
                      {benchmarks.bunching.without_holding.bunching_count}
                    </span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>With Holding (StdDev / Bunching)</span>
                    <span className="font-mono text-primary font-semibold">
                      {benchmarks.bunching.with_holding.headway_std_min}m /{" "}
                      {benchmarks.bunching.with_holding.bunching_count}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
