import type { PlantAnalysis } from "@/lib/plant-analysis-schema";

/*
 * Important:
 *
 * This function does NOT attempt to understand arbitrary
 * natural-language observations.
 *
 * It only compares fields where deterministic application
 * logic is appropriate.
 */

type Status = PlantAnalysis["status"];

type StatusDirection =
  | "improving"
  | "stable"
  | "worsening"
  | "uncertain";

export type DeterministicComparison = {
  previousStatus: Status;
  currentStatus: Status;
  statusDirection: StatusDirection;

  previousNeedsReview: boolean;
  currentNeedsReview: boolean;
};

/*
 * Lower number = healthier visible state.
 *
 * "uncertain" deliberately has no numerical ranking because
 * uncertainty is not inherently better or worse.
 */
const statusRank: Record<
  Exclude<Status, "uncertain">,
  number
> = {
  healthy: 0,
  watch: 1,
  needs_attention: 2,
};

export function compareObservations(
  previous: PlantAnalysis,
  current: PlantAnalysis
): DeterministicComparison {
  let statusDirection: StatusDirection;

  /*
   * Never claim improvement/worsening when either assessment
   * itself was uncertain.
   */
  if (
    previous.status === "uncertain" ||
    current.status === "uncertain"
  ) {
    statusDirection = "uncertain";
  } else {
    const previousRank = statusRank[previous.status];
    const currentRank = statusRank[current.status];

    if (currentRank < previousRank) {
      statusDirection = "improving";
    } else if (currentRank > previousRank) {
      statusDirection = "worsening";
    } else {
      statusDirection = "stable";
    }
  }

  return {
    previousStatus: previous.status,
    currentStatus: current.status,
    statusDirection,

    previousNeedsReview: previous.needs_review,
    currentNeedsReview: current.needs_review,
  };
}