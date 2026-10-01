"use client";

import { useState } from "react";
import type { PlantAnalysis } from "@/lib/plant-analysis-schema"; 

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
   * Lets us show loading feedback while Groq is working.
   */
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  /*
   * Store a user-facing error if something goes wrong.
   */
  const [error, setError] = useState<string | null>(null);

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

              <p className="mt-3">
                <span className="font-medium">Likely species:</span>{" "}
                {analysis.likely_species ?? "Could not identify reliably"}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Identification certainty:{" "}
                {analysis.identification_certainty}
              </p>
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
          </section>
        )}
      </div>
    </main>
  );
}