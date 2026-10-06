"use client";

import {
  useEffect,
  useState,
} from "react";

import type { PlantAnalysis } from "@/lib/plant-analysis-schema"; 

import type {
  PlantComparison,
} from "@/lib/plant-comparison-schema";

/*
 * frontend knows the exact structure of the AI result. 
 * PlantAnalysis itself comes from the Zod schema we already created.
 */
type AnalyzeResponse = {
  success: boolean;
  model?: string;
  filename?: string;
  analysis?: PlantAnalysis;
  error?: string;
};

type SavedPlantOption = {
  id: string;
  nickname: string;
  confirmed_species: string | null;
};

type SpeciesReview = {
  decision: "unreviewed" | "confirmed" | "corrected";
  confirmedSpecies: string | null;
};

export default function Home() {
  /*
   * Store the image selected by the user.
   */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /*
   * Store the structured AI result.
   */
  const [analysis, setAnalysis] = useState<PlantAnalysis | null>(null);
  /*
  * Human review is stored separately from the AI output.
  */
  const [speciesReview, setSpeciesReview] = useState<SpeciesReview>({
    decision: "unreviewed",
    confirmedSpecies: null,
  });

  const [speciesCorrection, setSpeciesCorrection] = useState("");

  /*
  * Controls whether the correction form is currently visible.
  */
  const [isCorrectingSpecies, setIsCorrectingSpecies] = useState(false);

  /*
   * Lets us show loading feedback while Groq is working.
   */
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  /*
   * Store a user-facing error if something goes wrong.
   */
  const [error, setError] = useState<string | null>(null);
  /*
  * Nickname for the persistent Plant profile.
  */
  const [plantNickname, setPlantNickname] = useState("");

  /*
  * List of existing plants that can be selected for comparison.
  */

  const [existingPlants, setExistingPlants] = useState<SavedPlantOption[]>([]);

  const [selectedExistingPlantId, setSelectedExistingPlantId] = useState("");

  const [isSavingObservation, setIsSavingObservation] = useState(false);

  const [observationSaveError, setObservationSaveError] = useState<string | null>(null);

  type LongitudinalComparison = {
    deterministic: {
      previousStatus:
        | "healthy"
        | "watch"
        | "needs_attention"
        | "uncertain";
  
      currentStatus:
        | "healthy"
        | "watch"
        | "needs_attention"
        | "uncertain";
  
      statusDirection:
        | "improving"
        | "stable"
        | "worsening"
        | "uncertain";
  
      previousNeedsReview: boolean;
      currentNeedsReview: boolean;
    };
  
    semantic: PlantComparison | null;
  
    semanticComparisonFailed: boolean;
  };
  
  const [
    comparisonResult,
    setComparisonResult,
  ] = useState<LongitudinalComparison | null>(
    null
  );

  /*
  * Save-request state.
  */
  const [isSaving, setIsSaving] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(
    null
  );

  /*
  * IDs returned by Supabase after a successful save.
  *
  * Keeping them lets us show that a real persistent record
  * was created.
  */
  const [savedPlant, setSavedPlant] = useState<{
    plantId: string;
    observationId: string;
  } | null>(null);

  useEffect(() => {
    async function loadPlants() {
      try {
        const response = await fetch("/api/plants");
  
        const data = await response.json();
  
        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Could not load plants."
          );
        }
  
        setExistingPlants(data.plants);
      } catch (error) {
        console.error(
          "Failed to load existing plants:",
          error
        );
      }
    }
  
    loadPlants();
  }, []);
  async function handleSaveObservation() {
    if (!selectedExistingPlantId) {
      setObservationSaveError(
        "Choose an existing plant first."
      );
      return;
    }
  
    if (!selectedFile || !analysis) {
      setObservationSaveError(
        "Analyze a photo before saving an observation."
      );
      return;
    }
  
    setIsSavingObservation(true);
    setObservationSaveError(null);
    setComparisonResult(null);
  
    try {
      const formData = new FormData();
  
      formData.append(
        "image",
        selectedFile
      );
  
      formData.append(
        "analysis",
        JSON.stringify(analysis)
      );
  
      formData.append(
        "speciesReview",
        JSON.stringify(speciesReview)
      );
  
      const response = await fetch(
        `/api/plants/${selectedExistingPlantId}/observations`,
        {
          method: "POST",
          body: formData,
        }
      );
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Could not save observation."
        );
      }
  
      if (data.comparison) {
        setComparisonResult(
          data.comparison
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        setObservationSaveError(
          error.message
        );
      } else {
        setObservationSaveError(
          "Something unexpected happened."
        );
      }
    } finally {
      setIsSavingObservation(false);
    }
  }

  async function handleAnalyze() {
    /*
     * The user must select a photo before we can send anything.
     */
    if (!selectedFile) {
      setError("Please choose a plant photo first.");
      return;
    }

    /*
     * Reset the previous state before beginning a new analysis.
     */
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const formData = new FormData();

      formData.append("image", selectedFile);

      /*
       * Send the image to OUR backend.
       */
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data: AnalyzeResponse = await response.json();

      if (!response.ok || !data.success || !data.analysis) {
        throw new Error(data.error || "Plant analysis failed.");
      }

      /*
       * Store the structured result in React state.
       * Updating state causes React to render the result below.
       */
      setAnalysis(data.analysis);
      /*
        * This is a new AI prediction, so it has not been reviewed yet.
      */
      setSpeciesReview({
        decision: "unreviewed",
        confirmedSpecies: null,
      });

      setSpeciesCorrection("");
      setIsCorrectingSpecies(false);

    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Something unexpected went wrong.");
      }
    } finally {
      /*
       * This runs whether the request succeeds or fails.
       */
      setIsAnalyzing(false);
    }
  }
  
  async function handleSavePlant() {
    if (!selectedFile) {
      setSaveError("The original plant photo is missing.");
      return;
    }
  
    if (!analysis) {
      setSaveError("Analyze the plant before saving it.");
      return;
    }
  
    const nickname = plantNickname.trim();
  
    if (!nickname) {
      setSaveError("Give this plant a nickname first.");
      return;
    }
  
    setIsSaving(true);
    setSaveError(null);
  
    try {
      const formData = new FormData();
  
      /*
       * Send the same original image that was analyzed.
       */
      formData.append("image", selectedFile);
  
      formData.append("nickname", nickname);
  
      /*
       * FormData cannot directly contain arbitrary JavaScript
       * objects, so serialize structured values to JSON strings.
       */
      formData.append(
        "analysis",
        JSON.stringify(analysis)
      );
  
      formData.append(
        "speciesReview",
        JSON.stringify(speciesReview)
      );
  
      const response = await fetch("/api/plants", {
        method: "POST",
        body: formData,
      });
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not save the plant."
        );
      }
  
      setSavedPlant({
        plantId: data.plant.id,
        observationId: data.observation.id,
      });
    } catch (error) {
      if (error instanceof Error) {
        setSaveError(error.message);
      } else {
        setSaveError(
          "Something unexpected happened while saving."
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-green-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl">
        {/* Product heading */}
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-green-900">
            PlantLens
          </h1>

          <p className="mt-2 text-green-800">
            Upload a plant photo to get a structured visual assessment.
          </p>
        </header>

        {/* Upload section */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            Analyze a plant
          </h2>

          <div className="mt-4">
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-green-800 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-green-900">
            Choose plant photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
              
                setSelectedFile(file);
                setAnalysis(null);
                setError(null);
                setPlantNickname("");
                setSaveError(null);
                setSavedPlant(null);
              
                setSpeciesReview({
                  decision: "unreviewed",
                  confirmedSpecies: null,
                });
              
                setSpeciesCorrection("");
                setIsCorrectingSpecies(false);
              }}
          />
          </label>

          {selectedFile ? (
            <p className="mt-3 text-sm text-slate-600">
              Selected: {selectedFile.name}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              JPG, PNG, or another image format
            </p>
          )}
        </div>

          {selectedFile && (
            <p className="mt-3 text-sm text-slate-600">
              Selected: {selectedFile.name}
            </p>
          )}

          <button
            className="mt-5 rounded-lg bg-green-800 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleAnalyze}
            disabled={!selectedFile || isAnalyzing}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze plant"}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>

        {/* Results only appear after a successful analysis */}
        {analysis && (
          <section className="mt-8 space-y-6">
            {/* High-level result */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                Overall status
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                {analysis.status}
              </h2>

              <p className="mt-4 text-slate-700">
                {analysis.summary}
              </p>
            </div>

            {/* Species identification */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">
                Identification
              </h2>

              {/* Always preserve and display the original AI prediction. */}
              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">
                  AI prediction
                </p>

                <p className="mt-1 text-lg font-semibold">
                  {analysis.likely_species ?? "Could not identify reliably"}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  AI certainty: {analysis.identification_certainty}
                </p>
              </div>

              {/* No human decision yet. */}
              {speciesReview.decision === "unreviewed" && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700">
                    Is this identification correct?
                  </p>

                  <div className="mt-3 flex flex-wrap gap-3">
                   {analysis.likely_species && (
                    <button
                      type="button"
                      className="rounded-lg bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-900"
                      onClick={() => {
                      setSpeciesReview({
                    decision: "confirmed",
                    confirmedSpecies: analysis.likely_species,
                  });
                    setIsCorrectingSpecies(false);
                  }}
                >
                  Confirm identification
                    </button>
                 )}
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setIsCorrectingSpecies(true);
                  }}
                    >
                      Correct identification
                    </button>
                </div>
            </div>
          )}

            {/* Correction form */}
            {speciesReview.decision === "unreviewed" && isCorrectingSpecies && (
              <div className="mt-5 rounded-lg border border-slate-200 p-4">
                <label
                  htmlFor="species-correction"
                  className="block text-sm font-medium text-slate-700"
                >
                  Correct species
                </label>
                <input
                  id="species-correction"
                  type="text"
                  value={speciesCorrection}
                  onChange={(event) => {
                    setSpeciesCorrection(event.target.value);
                  }}
                  placeholder="e.g. Philodendron hederaceum"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-green-700"
                />

              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-green-800 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!speciesCorrection.trim()}
                  onClick={() => {
                    const correctedSpecies = speciesCorrection.trim();
                    if (!correctedSpecies) {
                      return;
                    }
                  setSpeciesReview({
                    decision: "corrected",
                    confirmedSpecies: correctedSpecies,
              });
              setIsCorrectingSpecies(false);
             }}
                >
                    Save correction
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    setIsCorrectingSpecies(false);
                    setSpeciesCorrection("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

  {/* Human-reviewed result */}
  {speciesReview.decision !== "unreviewed" && (
    <div className="mt-5 rounded-lg bg-green-50 p-4">
      <p className="text-sm font-medium text-green-800">
        Human-confirmed species
      </p>

      <p className="mt-1 text-lg font-semibold text-green-950">
        {speciesReview.confirmedSpecies}
      </p>

      <p className="mt-1 text-sm text-green-700">
        {speciesReview.decision === "confirmed"
          ? "AI prediction confirmed by user"
          : "AI prediction corrected by user"}
      </p>

      <button
        type="button"
        className="mt-3 text-sm font-medium text-green-800 underline"
        onClick={() => {
          /*
           * Allow the human review to be changed without
           * touching the original AI result.
           */
          setSpeciesReview({
            decision: "unreviewed",
            confirmedSpecies: null,
          });

          setSpeciesCorrection("");
          setIsCorrectingSpecies(false);
        }}
      >
        Change review
      </button>
    </div>
  )}
</div>

            {/* Direct visual evidence */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">
                Visible observations
              </h2>

              <ul className="mt-4 space-y-3">
                {analysis.visible_observations.map(
                  (item, index) => (
                    <li
                      key={index}
                      className="rounded-lg bg-slate-50 p-3"
                    >
                      <p>{item.observation}</p>

                      <p className="mt-1 text-xs text-slate-500">
                        Certainty: {item.certainty}
                      </p>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Possible interpretations */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">
                Possible issues
              </h2>

              {analysis.possible_issues.length === 0 ? (
                <p className="mt-3 text-slate-600">
                  No visible issues identified.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {analysis.possible_issues.map(
                    (issue, index) => (
                      <li
                        key={index}
                        className="rounded-lg bg-slate-50 p-4"
                      >
                        <p className="font-medium">
                          {issue.issue}
                        </p>

                        <p className="mt-2 text-sm text-slate-700">
                          Evidence: {issue.evidence}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Certainty: {issue.certainty}
                        </p>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>

            {/* Recommendations */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">
                Recommendations
              </h2>

              {analysis.recommendations.length === 0 ? (
                <p className="mt-3 text-slate-600">
                  No action recommended from this image.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {analysis.recommendations.map(
                    (recommendation, index) => (
                      <li
                        key={index}
                        className="rounded-lg bg-slate-50 p-4"
                      >
                        <p className="font-medium">
                          {recommendation.action}
                        </p>

                        <p className="mt-2 text-sm text-slate-700">
                          {recommendation.reason}
                        </p>

                        <p className="mt-2 text-xs text-slate-500">
                          Certainty: {recommendation.certainty}
                          {" · "}
                          Basis: {recommendation.basis}
                        </p>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>

            {/* Information the image cannot provide */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">
                Missing information
              </h2>

              {analysis.questions_or_missing_information.length ===
              0 ? (
                <p className="mt-3 text-slate-600">
                  No additional information requested.
                </p>
              ) : (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
                  {analysis.questions_or_missing_information.map(
                    (question, index) => (
                      <li key={index}>{question}</li>
                    )
                  )}
                </ul>
              )}
            </div>

            {/* Human review */}
            {analysis.needs_review && (
              <div className="rounded-2xl bg-amber-50 p-6">
                <h2 className="text-xl font-semibold">
                  Human review recommended
                </h2>

                <p className="mt-2 text-slate-700">
                  {analysis.review_reason ??
                    "This analysis contains important uncertainty."}
                </p>
              </div>
            )}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">
                Save this plant
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                This will create a plant profile and save this analysis
                as its first observation.
              </p>

              {!savedPlant ? (
                <>
                  <label
                    htmlFor="plant-nickname"
                    className="mt-5 block text-sm font-medium text-slate-700"
                  >
                    Plant nickname
                  </label>

                  <input
                    id="plant-nickname"
                    type="text"
                    value={plantNickname}
                    onChange={(event) => {
                      setPlantNickname(event.target.value);
                      setSaveError(null);
                    }}
                    placeholder="e.g. Living room Tradescantia"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-green-700"
                  />

                  <button
                    type="button"
                    onClick={handleSavePlant}
                    disabled={
                      !plantNickname.trim() ||
                      isSaving ||
                      !selectedFile
                    }
                    className="mt-4 rounded-lg bg-green-800 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save plant"}
                  </button>

                  {saveError && (
                    <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      {saveError}
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-5 rounded-lg bg-green-50 p-4">
                  <p className="font-medium text-green-900">
                    Plant saved successfully.
                  </p>

                  <p className="mt-2 text-sm text-green-800">
                    Plant ID: {savedPlant.plantId}
                  </p>

                  <p className="mt-1 text-sm text-green-800">
                    Observation ID: {savedPlant.observationId}
                  </p>
                </div>
              )}
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">
                  Add check-in to an existing plant
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Save this analysis as the next observation for a plant
                  you already created.
                </p>

                <label
                  htmlFor="existing-plant"
                  className="mt-5 block text-sm font-medium text-slate-700"
                >
                  Existing plant
                </label>

                <select
                  id="existing-plant"
                  value={selectedExistingPlantId}
                  onChange={(event) => {
                    setSelectedExistingPlantId(
                      event.target.value
                    );

                    setComparisonResult(null);
                    setObservationSaveError(null);
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">
                    Choose a plant
                  </option>

                  {existingPlants.map((plant) => (
                    <option
                      key={plant.id}
                      value={plant.id}
                    >
                      {plant.nickname}
                      {plant.confirmed_species
                        ? ` — ${plant.confirmed_species}`
                        : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={
                    !selectedExistingPlantId ||
                    isSavingObservation
                  }
                  onClick={handleSaveObservation}
                  className="mt-4 rounded-lg bg-green-800 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingObservation
                    ? "Saving check-in..."
                    : "Save check-in"}
                </button>

                {observationSaveError && (
                  <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {observationSaveError}
                  </p>
                )}

                {comparisonResult && (
                  <div className="mt-5 space-y-4">
                    {/* Deterministic comparison */}
                    <div className="rounded-lg bg-green-50 p-4">
                      <p className="font-medium text-green-900">
                        Check-in saved.
                      </p>

                      <p className="mt-3 text-sm text-green-800">
                        Previous status:{" "}
                        {
                          comparisonResult
                            .deterministic
                            .previousStatus
                        }
                      </p>

                      <p className="text-sm text-green-800">
                        Current status:{" "}
                        {
                          comparisonResult
                            .deterministic
                            .currentStatus
                        }
                      </p>

                      <p className="mt-2 font-medium text-green-950">
                        Status direction:{" "}
                        {
                          comparisonResult
                            .deterministic
                            .statusDirection
                        }
                      </p>
                   </div>

    {/* Semantic comparison */}
    {comparisonResult?.semantic && (
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Compared with previous check-in
        </p>

        <h3 className="mt-2 text-xl font-semibold">
          {comparisonResult.semantic.trend}
        </h3>

        <p className="mt-3 text-slate-700">
          {comparisonResult.semantic.summary}
        </p>

        <p className="mt-2 text-xs text-slate-500">
          Comparison certainty:{" "}
          {
            comparisonResult.semantic
              .trend_certainty
          }
        </p>

        {comparisonResult.semantic.changes.length >
          0 && (
          <div className="mt-5">
            <h4 className="font-medium">
              Observed changes
            </h4>

            <ul className="mt-3 space-y-3">
              {comparisonResult.semantic.changes.map(
                (change, index) => (
                  <li
                    key={index}
                    className="rounded-lg bg-slate-50 p-3"
                  >
                    <p className="font-medium">
                      {change.aspect}
                    </p>

                    <p className="mt-1 text-sm">
                      Change: {change.direction}
                    </p>

                    {change.previous_evidence && (
                      <p className="mt-2 text-sm text-slate-600">
                        Before:{" "}
                        {
                          change.previous_evidence
                        }
                      </p>
                    )}

                    {change.current_evidence && (
                      <p className="mt-1 text-sm text-slate-600">
                        Now:{" "}
                        {
                          change.current_evidence
                        }
                      </p>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      Certainty:{" "}
                      {change.certainty}
                    </p>
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {comparisonResult.semantic.limitations
          .length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium">
              Comparison limitations
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {comparisonResult.semantic.limitations.map(
                (limitation, index) => (
                  <li key={index}>
                    {limitation}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {comparisonResult.semantic
          .needs_review && (
          <div className="mt-5 rounded-lg bg-amber-50 p-3">
            <p className="font-medium text-amber-900">
              Comparison needs review
            </p>

            <p className="mt-1 text-sm text-amber-800">
              {comparisonResult.semantic
                .review_reason ??
                "The available observations do not support a confident comparison."}
            </p>
          </div>
        )}
      </div>
    )}

    {/* Graceful-degradation state */}
    {comparisonResult
      .semanticComparisonFailed && (
      <div className="rounded-lg bg-amber-50 p-4">
        <p className="font-medium text-amber-900">
          Check-in saved, but the detailed comparison
          could not be generated.
        </p>

        <p className="mt-1 text-sm text-amber-800">
          Your observation is safely stored. The
          status comparison above is still available.
        </p>
      </div>
    )}
  </div>
                )}



              </div>
          </section>
        )}
      </div>
    </main>
  );
}