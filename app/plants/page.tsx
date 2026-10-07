"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

/*
 * This is the shape returned by GET /api/plants.
 */
type PlantLibraryItem = {
  id: string;

  nickname: string;

  confirmed_species:
    | string
    | null;

  location_city:
    | string
    | null;

  location_country:
    | string
    | null;

  placement:
    | "indoor"
    | "balcony"
    | "outdoor"
    | null;

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

  latest_status:
    | "healthy"
    | "watch"
    | "needs_attention"
    | "uncertain"
    | null;

  last_checked_at:
    | string
    | null;
};


/*
 * Convert database-style enum values into nicer UI labels.
 *
 * afternoon_sun → Afternoon sun
 */
function formatLabel(
  value: string | null
) {
  if (!value) {
    return "Unknown";
  }

  const withSpaces =
    value.replaceAll("_", " ");

  return (
    withSpaces.charAt(0).toUpperCase() +
    withSpaces.slice(1)
  );
}


/*
 * Format the timestamp using the user's browser locale.
 */
function formatDate(
  value: string | null
) {
  if (!value) {
    return "No check-ins yet";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(value));
}


/*
 * Keep status styling in one place.
 */
function getStatusClasses(
  status:
    | PlantLibraryItem["latest_status"]
) {
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


export default function PlantsPage() {
  const [plants, setPlants] =
    useState<PlantLibraryItem[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);


  useEffect(() => {
    async function loadPlants() {
      try {
        const response =
          await fetch("/api/plants");

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Could not load plants."
          );
        }

        setPlants(data.plants);
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError(
            "Something unexpected happened."
          );
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadPlants();
  }, []);


  return (
    <main className="min-h-screen bg-green-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl">

        {/* Page heading */}
        <header className="mb-10">
          <Link
            href="/"
            className="text-sm font-medium text-green-800 hover:underline"
          >
            ← Back to PlantLens
          </Link>

          <h1 className="mt-4 text-4xl font-bold text-green-950">
            My Plants
          </h1>

          <p className="mt-2 text-slate-600">
            Your saved plants and their latest
            check-in status.
          </p>
        </header>


        {/* Loading state */}
        {isLoading && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-slate-600">
              Loading plants...
            </p>
          </div>
        )}


        {/* Error state */}
        {error && (
          <div className="rounded-2xl bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}


        {/* Empty library */}
        {!isLoading &&
          !error &&
          plants.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-semibold">
                No plants saved yet
              </h2>

              <p className="mt-2 text-slate-600">
                Analyze a plant photo and save
                your first plant profile.
              </p>

              <Link
                href="/"
                className="mt-5 inline-block rounded-lg bg-green-800 px-5 py-2.5 font-medium text-white hover:bg-green-900"
              >
                Analyze a plant
              </Link>
            </div>
          )}


        {/* Plant cards */}
        {!isLoading &&
          !error &&
          plants.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plants.map((plant) => (
                <Link
                  key={plant.id}

                  href={`/plants/${plant.id}`}

                  className="group rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-950 group-hover:text-green-900">
                        {plant.nickname}
                      </h2>

                      <p className="mt-1 text-sm italic text-slate-600">
                        {plant.confirmed_species ??
                          "Species not confirmed"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                        plant.latest_status
                      )}`}
                    >
                      {plant.latest_status
                        ? formatLabel(
                            plant.latest_status
                          )
                        : "No status"}
                    </span>
                  </div>


                  {/* Growing context */}
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <p className="text-sm text-slate-700">
                      {formatLabel(
                        plant.placement
                      )}
                      {" · "}
                      {formatLabel(
                        plant.light_exposure
                      )}
                    </p>

                    {plant.location_city && (
                      <p className="mt-1 text-sm text-slate-500">
                        {plant.location_city}
                        {plant.location_country
                          ? `, ${plant.location_country}`
                          : ""}
                      </p>
                    )}
                  </div>


                  {/* Last check-in */}
                  <div className="mt-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Last checked
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      {formatDate(
                        plant.last_checked_at
                      )}
                    </p>
                  </div>


                  <p className="mt-5 text-sm font-medium text-green-800">
                    View plant →
                  </p>
                </Link>
              ))}
            </div>
          )}
      </div>
    </main>
  );
}