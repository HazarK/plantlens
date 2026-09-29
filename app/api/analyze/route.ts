import Groq from "groq-sdk";

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
          role: "user",
          content: [
              {
                type: "text",
                text: `
              Describe what is visibly present in this plant photo.
              
              Focus only on observable visual details such as:
              - leaf color
              - leaf shape
              - visible discoloration
              - visible damage
              - wilting or drooping if apparent
              - visible new growth
              - visible soil condition if the soil can actually be seen
              - visible pests only if they are clearly apparent
              
              Do not diagnose the cause of any issue.
              Do not make watering, fertilizer, or repotting recommendations.
              Do not claim to see something that is not clearly visible.
              
              If something cannot be determined from the photo, say so.
              
              Keep the description concise.
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
      // Keep the experiment inexpensive and the answer short.
      max_completion_tokens: 300,
    });

    const modelResponse =
      completion.choices[0]?.message?.content ??
      "The model returned no text.";
    
    return Response.json({
      success: true,
      model: "qwen/qwen3.8-27b",
      filename: image.name,
       // For Phase 3, our AI contract is simply:
      // image → textual visual description.
      description: modelResponse,
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