"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { PlantCareProfile } from "@/lib/plant-care-profile-schema";
import { CareProfilePanel } from "./care-profile-panel";

type PlantProfile = {
  id: string;
  nickname: string;
  confirmed_species: string | null;
  location_city: string | null;
  location_country: string | null;
  placement: "indoor" | "balcony" | "outdoor" | null;
  light_exposure:
    | "low"
    | "indirect"
    | "morning_sun"
    | "afternoon_sun"
    | "full_sun"
    | "mixed"
    | "unknown"
    | null;
  created_at: string;
  care_profile: PlantCareProfile | null;
  care_profile_invalid: boolean;
  care_profile_stale: boolean;
  care_profile_species: string | null;
  care_profile_model: string | null;
  care_profile_version: string | null;
  care_profile_generated_at: string | null;
  latest_status: "healthy" | "watch" | "needs_attention" | "uncertain" | null;
  last_checked_at: string | null;
  latest_observation_id: string | null;
  history: CheckInHistoryEntry[];
};

type CheckInHistoryEntry = {
  id: string;
  created_at: string;
  status: "healthy" | "watch" | "needs_attention" | "uncertain";
  summary: string;
};

function formatLabel(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const withSpaces = value.replaceAll("_", " ");

  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCheckInDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusClasses(status: PlantProfile["latest_status"]) {
  switch (status) {
    case "healthy":
      return "bg-green-100 text-green-800";
    case "watch":
      return "bg-amber-100 text-amber-800";
    case "needs_attention":
      return "bg-red-100 text-red-800";
    case "uncertain":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function PlantDetailPage() {
  const params = useParams<{ plantId: string }>();
  const plantId = params.plantId;

  const [plant, setPlant] = useState<PlantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingCareProfile, setIsGeneratingCareProfile] = useState(false);
  const [careProfileError, setCareProfileError] = useState<string | null>(null);

  const loadPlant = useCallback(async () => {
    if (!plantId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/plants/${plantId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load this plant.");
      }

      setPlant(data.plant);
    } catch (loadError) {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("Something unexpected happened.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [plantId]);

  useEffect(() => {
    loadPlant();
  }, [loadPlant]);

  async function generateCareProfile() {
    if (!plantId) {
      return;
    }

    setIsGeneratingCareProfile(true);
    setCareProfileError(null);

    try {
      const response = await fetch(`/api/plants/${plantId}/care-profile`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not generate the care profile."
        );
      }

      await loadPlant();
    } catch (generateError) {
      if (generateError instanceof Error) {
        setCareProfileError(generateError.message);
      } else {
        setCareProfileError("Could not generate the care profile.");
      }
    } finally {
      setIsGeneratingCareProfile(false);
    }
  }

  const careProfile = plant?.care_profile ?? null;

  return (
    <main className="min-h-screen bg-green-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <Link
            href="/plants"
            className="text-sm font-medium text-green-800 hover:underline"
          >
            ← Back to My Plants
          </Link>
        </header>

        {isLoading && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-slate-600">Loading plant...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 p-6 text-red-700">{error}</div>
        )}

        {!isLoading && !error && plant && (
          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-4xl font-bold text-green-950">
                    {plant.nickname}
                  </h1>
                  <p className="mt-2 text-sm italic text-slate-600">
                    {plant.confirmed_species ?? "Species not confirmed"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                    plant.latest_status
                  )}`}
                >
                  {plant.latest_status
                    ? formatLabel(plant.latest_status)
                    : "No status"}
                </span>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-700">
                  {formatLabel(plant.placement)}
                  {" · "}
                  {formatLabel(plant.light_exposure)}
                </p>
                {plant.location_city && (
                  <p className="mt-1 text-sm text-slate-500">
                    {plant.location_city}
                    {plant.location_country
                      ? `, ${plant.location_country}`
                      : ""}
                  </p>
                )}
                <p className="mt-4 text-sm text-slate-700">
                  Last checked {formatDate(plant.last_checked_at)}
                </p>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">
                Check-in history
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                When each photo was uploaded, and how the plant looked.
              </p>

              {plant.history.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  No check-ins yet.
                </p>
              ) : (
                <ol className="mt-5 space-y-4">
                  {plant.history.map((entry) => (
                    <li
                      key={entry.id}
                      className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">
                          <time dateTime={entry.created_at}>
                            {formatCheckInDate(entry.created_at)}
                          </time>
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                            entry.status
                          )}`}
                        >
                          {formatLabel(entry.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {entry.summary}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    Care profile
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Species-level guidance for this plant’s confirmed identity
                    and growing context.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generateCareProfile}
                  disabled={
                    isGeneratingCareProfile || !plant.confirmed_species
                  }
                  className="rounded-lg bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isGeneratingCareProfile
                    ? "Generating..."
                    : careProfile
                      ? "Regenerate"
                      : "Generate care profile"}
                </button>
              </div>

              {!plant.confirmed_species && (
                <p className="mt-4 text-sm text-amber-800">
                  Confirm the species before generating a care profile.
                </p>
              )}

              {plant.care_profile_stale && (
                <p className="mt-4 text-sm text-amber-800">
                  This guide was generated for{" "}
                  {plant.care_profile_species ?? "a different species"}.
                  Regenerate it for {plant.confirmed_species}.
                </p>
              )}

              {plant.care_profile_invalid && (
                <p className="mt-4 text-sm text-red-700">
                  The stored care profile could not be validated. Generate a
                  new one.
                </p>
              )}

              {careProfileError && (
                <p className="mt-4 text-sm text-red-700">{careProfileError}</p>
              )}

              {careProfile ? (
                <CareProfilePanel
                  careProfile={careProfile}
                  growingContext={{
                    locationCity: plant.location_city,
                    locationCountry: plant.location_country,
                    placement: plant.placement,
                    lightExposure: plant.light_exposure,
                  }}
                  generatedAt={plant.care_profile_generated_at}
                  generatedModel={plant.care_profile_model}
                />
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  No care profile yet.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
