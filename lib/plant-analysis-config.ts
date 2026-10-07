/*
 * Keeping these values in one place means both analysis and
 * persistence agree about which AI system produced an observation.
 */

export const PLANT_ANALYSIS_MODEL = "qwen/qwen3.8-27b";

export const PLANT_ANALYSIS_VERSION = "v1";

/*
 * General species-care profile system.
 *
 * Keeping this version separate from image analysis lets us
 * improve care generation independently.
 */
export const PLANT_CARE_PROFILE_VERSION =
  "care-v1";