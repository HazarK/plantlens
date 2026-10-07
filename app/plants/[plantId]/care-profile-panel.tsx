"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { PlantCareProfile } from "@/lib/plant-care-profile-schema";

type GrowingContext = {
  locationCity: string | null;
  locationCountry: string | null;
  placement: string | null;
  lightExposure: string | null;
};

type CareProfilePanelProps = {
  careProfile: PlantCareProfile;
  growingContext: GrowingContext;
  generatedAt: string | null;
  generatedModel: string | null;
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

function firstSentence(text: string, max = 88) {
  const sentence = text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? text;

  if (sentence.length <= max) {
    return sentence;
  }

  return `${sentence.slice(0, max).trimEnd()}…`;
}

function toBullets(text: string) {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [text];
}

function temperatureHeadline(
  sensitivity: PlantCareProfile["temperature"]["cold_sensitivity"]
) {
  switch (sensitivity) {
    case "high":
      return "Protect from cold";
    case "medium":
      return "Some cold protection";
    case "low":
      return "Cold tolerant";
  }
}

function placementHeadline(profile: PlantCareProfile["placement"]) {
  const indoor = formatLabel(profile.indoor_suitability);
  const outdoor = formatLabel(profile.outdoor_suitability);

  return `${indoor} indoor · ${outdoor} outdoor`;
}

const DETAIL_KEYS = [
  "light",
  "water",
  "fertilizer",
  "placement",
  "setup",
  "temperature",
  "humidity",
  "repotting",
  "issues",
  "notes",
] as const;

type DetailKey = (typeof DETAIL_KEYS)[number];

export function CareProfilePanel({
  careProfile,
  growingContext,
  generatedAt,
  generatedModel,
}: CareProfilePanelProps) {
  const [expanded, setExpanded] = useState<Record<DetailKey, boolean>>(() =>
    Object.fromEntries(DETAIL_KEYS.map((key) => [key, true])) as Record<
      DetailKey,
      boolean
    >
  );

  const allExpanded = useMemo(
    () => DETAIL_KEYS.every((key) => expanded[key]),
    [expanded]
  );

  function toggle(key: DetailKey) {
    setExpanded((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function toggleAll() {
    const next = !allExpanded;

    setExpanded(
      Object.fromEntries(DETAIL_KEYS.map((key) => [key, next])) as Record<
        DetailKey,
        boolean
      >
    );
  }

  const glanceCards = [
    {
      title: "Light",
      headline: formatLabel(careProfile.light.requirement),
      summary: firstSentence(careProfile.light.guidance),
      icon: <SunIcon />,
      className: "bg-amber-50 text-amber-950",
      iconClassName: "text-amber-500",
    },
    {
      title: "Water",
      headline: formatLabel(careProfile.watering.preference),
      summary: firstSentence(careProfile.watering.guidance),
      icon: <DropIcon />,
      className: "bg-sky-50 text-sky-950",
      iconClassName: "text-sky-500",
    },
    {
      title: "Fertilizer",
      headline: firstSentence(careProfile.fertilizer.growing_season_cadence, 32),
      summary: firstSentence(careProfile.fertilizer.guidance),
      icon: <LeafIcon />,
      className: "bg-green-50 text-green-950",
      iconClassName: "text-green-600",
    },
    {
      title: "Placement",
      headline: placementHeadline(careProfile.placement),
      summary: firstSentence(careProfile.placement.guidance),
      icon: <HomeIcon />,
      className: "bg-violet-50 text-violet-950",
      iconClassName: "text-violet-500",
    },
    {
      title: "Temperature",
      headline: temperatureHeadline(careProfile.temperature.cold_sensitivity),
      summary: firstSentence(careProfile.temperature.guidance),
      icon: <ThermometerIcon />,
      className: "bg-orange-50 text-orange-950",
      iconClassName: "text-orange-500",
    },
    {
      title: "Humidity",
      headline: formatLabel(careProfile.humidity.preference),
      summary: firstSentence(careProfile.humidity.guidance),
      icon: <HumidityIcon />,
      className: "bg-cyan-50 text-cyan-950",
      iconClassName: "text-cyan-600",
    },
  ];

  const locationLabel = [growingContext.locationCity, growingContext.locationCountry]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mt-6 space-y-6">
      {careProfile.overview && (
        <p className="text-sm leading-relaxed text-slate-600">
          {careProfile.overview}
        </p>
      )}

      <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-lg font-semibold text-green-950">
            Quick care at a glance
          </h3>
          <p className="text-xs italic text-slate-500">
            The essentials for this species
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {glanceCards.map((card) => (
            <article
              key={card.title}
              className={`rounded-2xl px-4 py-4 ${card.className}`}
            >
              <div className={`mb-3 ${card.iconClassName}`}>{card.icon}</div>
              <p className="text-sm font-medium opacity-80">{card.title}</p>
              <p className="mt-1 text-base font-semibold leading-snug">
                {card.headline}
              </p>
              <p className="mt-2 text-xs leading-relaxed opacity-80">
                {card.summary}
              </p>
            </article>
          ))}
        </div>

        {careProfile.light.afternoon_sun_guidance && (
          <div className="mt-4 flex gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="mt-0.5 shrink-0 text-amber-500">
              <TipIcon />
            </span>
            <p>
              <span className="font-semibold">Care tip: </span>
              {careProfile.light.afternoon_sun_guidance}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-950">
            All care details
          </h3>
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm font-medium text-green-800 hover:underline"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailCard
            title="Light"
            icon={<SunIcon />}
            expanded={expanded.light}
            onToggle={() => toggle("light")}
          >
            <BulletList items={toBullets(careProfile.light.guidance)} />
            {careProfile.light.afternoon_sun_guidance && (
              <p className="mt-2 text-slate-500">
                {careProfile.light.afternoon_sun_guidance}
              </p>
            )}
          </DetailCard>

          <DetailCard
            title="Water"
            icon={<DropIcon />}
            expanded={expanded.water}
            onToggle={() => toggle("water")}
          >
            <BulletList
              items={[
                `${formatLabel(careProfile.watering.preference)} water needs.`,
                ...toBullets(careProfile.watering.guidance),
                careProfile.watering.before_watering_check,
              ]}
            />
          </DetailCard>

          <DetailCard
            title="Fertilizer"
            icon={<LeafIcon />}
            expanded={expanded.fertilizer}
            onToggle={() => toggle("fertilizer")}
          >
            <BulletList
              items={[
                careProfile.fertilizer.growing_season_cadence,
                ...toBullets(careProfile.fertilizer.guidance),
                careProfile.fertilizer.winter_guidance,
              ]}
            />
          </DetailCard>

          <DetailCard
            title="Indoor & outdoor placement"
            icon={<HomeIcon />}
            expanded={expanded.placement}
            onToggle={() => toggle("placement")}
          >
            <BulletList items={toBullets(careProfile.placement.guidance)} />
          </DetailCard>

          <DetailCard
            title="Your growing setup"
            icon={<ChartIcon />}
            expanded={expanded.setup}
            onToggle={() => toggle("setup")}
          >
            <div className="space-y-2">
              {locationLabel && <p>{locationLabel}</p>}
              <p>
                {formatLabel(growingContext.placement)}
                {" · "}
                {formatLabel(growingContext.lightExposure)}
              </p>
              <p
                className={`rounded-xl px-3 py-2 text-sm ${
                  careProfile.growing_context_assessment.fit === "good"
                    ? "bg-green-50 text-green-900"
                    : careProfile.growing_context_assessment.fit === "poor"
                      ? "bg-red-50 text-red-800"
                      : "bg-amber-50 text-amber-950"
                }`}
              >
                Overall fit:{" "}
                {formatLabel(careProfile.growing_context_assessment.fit)}.{" "}
                {careProfile.growing_context_assessment.summary}
              </p>
              {careProfile.growing_context_assessment.seasonal_notes.length >
                0 && (
                <BulletList
                  items={careProfile.growing_context_assessment.seasonal_notes}
                />
              )}
            </div>
          </DetailCard>

          <DetailCard
            title="Temperature"
            icon={<ThermometerIcon />}
            expanded={expanded.temperature}
            onToggle={() => toggle("temperature")}
          >
            <BulletList items={toBullets(careProfile.temperature.guidance)} />
          </DetailCard>

          <DetailCard
            title="Humidity"
            icon={<HumidityIcon />}
            expanded={expanded.humidity}
            onToggle={() => toggle("humidity")}
          >
            <BulletList items={toBullets(careProfile.humidity.guidance)} />
          </DetailCard>

          <DetailCard
            title="Repotting"
            icon={<PotIcon />}
            expanded={expanded.repotting}
            onToggle={() => toggle("repotting")}
          >
            <BulletList
              items={[
                ...toBullets(careProfile.repotting.guidance),
                ...careProfile.repotting.signs_to_watch_for,
              ]}
            />
          </DetailCard>

          {careProfile.common_issues.length > 0 && (
            <DetailCard
              title="Common issues to watch for"
              icon={<AlertIcon />}
              expanded={expanded.issues}
              onToggle={() => toggle("issues")}
            >
              <BulletList
                items={careProfile.common_issues.map(
                  (issue) => `${issue.issue}: ${issue.watch_for}`
                )}
              />
            </DetailCard>
          )}

          {careProfile.useful_notes.length > 0 && (
            <DetailCard
              title="Useful notes"
              icon={<NotesIcon />}
              expanded={expanded.notes}
              onToggle={() => toggle("notes")}
            >
              <BulletList items={careProfile.useful_notes} />
            </DetailCard>
          )}
        </div>

        {generatedAt && (
          <p className="mt-5 text-xs text-slate-400">
            Generated {formatDate(generatedAt)}
            {generatedModel ? ` · ${generatedModel}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function DetailCard({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="inline-flex h-5 w-5 text-green-700 [&>svg]:h-5 [&>svg]:w-5">
            {icon}
          </span>
          {title}
        </span>
        <span
          className={`text-slate-400 transition ${expanded ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>
      {expanded && <div className="mt-3 text-sm text-slate-700">{children}</div>}
    </article>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.filter(Boolean).map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M12 3.5c2.8 3.6 6 7.6 6 10.6a6 6 0 1 1-12 0C6 11.1 9.2 7.1 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M5 19c8-.5 13-6 14-14-8 1-13.5 6-14 14Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 16c2.5-2 5-6 6.5-10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThermometerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M10 14.2V6.5a2 2 0 1 1 4 0v7.7a3.5 3.5 0 1 1-4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function HumidityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M8 16.5c0 1.4 1.8 2.5 4 2.5s4-1.1 4-2.5-1.8-2.5-4-2.5-4 1.1-4 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 5.5c1.4 1.8 3 3.8 3 5.3a3 3 0 1 1-6 0c0-1.5 1.6-3.5 3-5.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M9 18h6M10 21h4M7.5 10.5a4.5 4.5 0 1 1 7.2 3.6c-.7.5-1.2 1.3-1.4 2.2H9.7c-.2-.9-.7-1.7-1.4-2.2A4.5 4.5 0 0 1 7.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M5 19V9M12 19V5M19 19v-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PotIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M12 4c1.5 1.6 2.5 3.2 2.5 4.6a2.5 2.5 0 0 1-5 0C9.5 7.2 10.5 5.6 12 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7 13h10l-1 7H8l-1-7ZM6 13h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M12 4 3.8 19h16.4L12 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4M12 16.5v.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M7 4h10a1 1 0 0 1 1 1v14l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
