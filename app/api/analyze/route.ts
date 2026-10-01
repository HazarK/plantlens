import Groq from "groq-sdk";
import { z } from "zod";
import { plantAnalysisSchema } from "@/lib/plant-analysis-schema";

export const runtime = "nodejs";

// Create a Groq client, this code runs on the SERVER, so the API key is not exposed
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    // The incoming request will use multipart/form-data because  it contains an image file.
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return Response.json(
        { error: "No image file was provided." },
        { status: 400 }
      );
    }

    // For this first experiment, only accept image files.
    if (!image.type.startsWith("image/")) {
      return Response.json(
        { error: "The uploaded file must be an image." },
        { status: 400 }
      );
    }

    // Groq currently documents a 20 MB image request limit.w e enforce the same ceiling before sending anything.
    const maxFileSize = 20 * 1024 * 1024;

    if (image.size > maxFileSize) {
      return Response.json(
        { error: "The image must be smaller than 20 MB." },
        { status: 400 }
      );
    }


    const imageBuffer = Buffer.from(await image.arrayBuffer());

    const base64Image = imageBuffer.toString("base64");

    // A data URL includes both the image MIME type and its base64-encoded contents.
    // It will look roughly like: data:image/jpeg;base64,/9j/4AAQSkZJRg...
    const imageDataUrl = `data:${image.type};base64,${base64Image}`;

    // Send BOTH text instructions and the image to Groq
    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      
      messages: [
        {
          role: "system",
          content: `
        You are the plant-analysis component of PlantLens.
        
        Analyze ONE supplied plant photograph conservatively.
        
        Your job is to separate:
        1. what is directly visible,
        2. what might reasonably be inferred,
        3. what cannot be determined from the image.
        
        VISIBLE OBSERVATIONS
        
        visible_observations must contain only direct visual evidence.
        
        Good:
        "The leaves have silver-green stripes and purple undersides."
        
        Bad:
        "The plant has the characteristic coloration of Tradescantia zebrina."
        
        Good:
        "Small white particles are visible in the potting mix."
        
        Bad:
        "The soil contains perlite to improve drainage."
        
        Good:
        "The soil surface appears dark."
        
        Bad:
        "The soil is moist."
        
        Do not include species identification, diagnoses, causes,
        care advice, or inferred function inside visible_observations.
        
        Do not infer soil moisture from color or appearance alone.
        
        POSSIBLE ISSUES
        
        possible_issues may interpret visible evidence, but:
        - every issue must cite the visible evidence supporting it,
        - symptoms must not be treated as proof of a cause,
        - uncertainty must be reflected in certainty.
        
        RECOMMENDATIONS
        
        Do not claim that the plant needs watering, fertilizer,
        repotting, or another intervention unless the evidence supports it.
        
        When an action depends on information not visible in the photo,
        recommend checking that information first and use:
        
        basis = "missing_information"
        
        SPECIES IDENTIFICATION
        
        likely_species is a prediction, not a confirmed fact.
        
        If the image does not support a useful identification,
        set likely_species to null.
        
        IMAGE CONTEXT
        
        You have exactly ONE photograph.
        
        Never refer to:
        - another image,
        - a crop,
        - a close-up,
        - another angle,
        - another view,
        - a bottom view,
        
        unless that separate image was actually supplied.
        
        STATUS RULES
        
        Use:
        
        healthy:
        The visible parts of the plant show no meaningful signs of a current problem.
        
        watch:
        There are minor, ambiguous, or low-severity visible findings worth monitoring.
        
        needs_attention:
        There is clear visible evidence of a meaningful issue that reasonably warrants action.
        
        uncertain:
        The photograph itself is too unclear, incomplete, obstructed, or low-quality
        to make a useful visible-health assessment.
        
        Do NOT use "uncertain" merely because watering history, root condition,
        fertilization history, or other non-visible context is unavailable.
        
        MISSING INFORMATION
        
        Use questions_or_missing_information for contextual information
        that could improve diagnosis or recommendations.
        
        It is normal for this array to contain items even when status is
        healthy or watch.
        
        NEEDS REVIEW
        
        needs_review should be true only when human review is particularly useful,
        for example:
        - the image is too poor for reliable analysis,
        - an important finding is highly ambiguous,
        - identification is unusually uncertain and matters to the analysis,
        - or the model cannot safely interpret an important visible feature.
        
        Missing routine care information by itself does not require needs_review.
        
        Never invent hidden information.
        Never claim certainty that the image does not support.
          `.trim(),
        },
    
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
    Analyze this plant photograph according to the PlantLens schema.
    
    Return observations, possible issues, recommendations,
    missing information, and an overall status.
              `.trim(),
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
    
      /*
       * Groq Structured Outputs:
       *
       * Instead of merely asking for JSON, we provide an actual
       * JSON Schema that constrains what the model may return.
       */
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "plant_analysis",
    
          /*
           * strict:true asks Groq to constrain the response
           * to our schema rather than just attempting to follow it.
           */
          strict: true,
    
          /*
           * Convert our Zod definition into JSON Schema.
           */
          schema: z.toJSONSchema(plantAnalysisSchema),
        },
      },
    
      /*
       * Structured output is larger than our previous description,
       * so give the model enough output space to finish.
       */
      max_completion_tokens: 1200,
    });

    const rawResponse = completion.choices[0]?.message?.content;

    if (!rawResponse) {
      throw new Error("Groq returned no analysis.");
    }
    
    /* 
     * First convert the JSON text returned by Groq into a JavaScript object.
     */
    const parsedResponse = JSON.parse(rawResponse);
    
    /*
     * Then validate it against OUR schema as an additional
     * application-level check.
     *
     * If the structure is wrong, Zod throws an error instead
     * of letting bad data silently enter PlantLens.
     */
    const analysis = plantAnalysisSchema.parse(parsedResponse);
    
    return Response.json({
      success: true,
      model: "qwen/qwen3.8-27b",
      filename: image.name,
      analysis,
    });


  } catch (error) {
    console.error("PlantLens analysis error:", error);
    
    return Response.json(
      {
        success: false,
        error: "Failed to analyze image.",
      },
      { status: 500 }
    );
  }
}