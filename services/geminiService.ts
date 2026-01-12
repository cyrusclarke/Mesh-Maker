
import { GoogleGenAI } from "@google/genai";
import { GenerationConfig } from "../types";

const SYSTEM_PROMPT_REQUIREMENTS = `
CORE AESTHETIC REQUIREMENTS:
1. Geometric Wireframe Mesh: Depict the object solely as a wireframe mesh. NO solid surfaces, shading, textures, or photorealistic elements. Show the underlying geometric structure.
2. Color Palette: Use strictly Cyan (#00FFFF), Magenta (#FF00FF), and Electric Yellow/Amber (#FFFF00). No other colors.
3. Retro-Futuristic Style: Evoke classic CAD software from the 80s/90s, sharp and clean technical blueprint look.
4. Background: Pure black (#000000) only.
5. No Interface Elements: Do NOT include any CAD UI, text, coordinates, or frames. Just the object.
`;

const getApiKey = () => {
  const key = process.env.API_KEY;
  if (!key) {
    console.error("Critical: API_KEY is not defined in process.env.");
  }
  return key || "";
};

export const generateWireframeImage = async (
  prompt: string,
  config: GenerationConfig
): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const finalPrompt = `Generate a stylized CAD wireframe rendering of: ${prompt}. ${SYSTEM_PROMPT_REQUIREMENTS}`;

  try {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: {
        parts: [{ text: finalPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio,
          ...(config.model === 'gemini-3-pro-image-preview' ? { imageSize: config.quality } : {})
        },
      },
    });

    const candidates = response.candidates || [];
    if (!candidates.length) throw new Error("No candidates generated.");
    
    for (const part of candidates[0].content.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned in parts.");
  } catch (err) {
    console.error("Gemini Image Generation Error:", err);
    throw err;
  }
};

export const editWireframeImage = async (
  base64Image: string,
  instruction: string,
  config: GenerationConfig
): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const base64Data = base64Image.split(',')[1] || base64Image;
  const finalPrompt = `Apply this modification to the wireframe schematic: ${instruction}. Maintain mesh aesthetic. ${SYSTEM_PROMPT_REQUIREMENTS}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/png',
            },
          },
          { text: finalPrompt },
        ],
      },
    });

    const candidates = response.candidates || [];
    if (!candidates.length) throw new Error("No candidates generated for edit.");

    for (const part of candidates[0].content.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No edited image data returned.");
  } catch (err) {
    console.error("Gemini Image Edit Error:", err);
    throw err;
  }
};

export const generateRotatingVideo = async (
  base64Image: string,
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const base64Data = base64Image.split(',')[1] || base64Image;

  const prompt = "A smooth 360-degree cinematic rotation of this 3D wireframe mesh object. The camera orbits the object. Smooth motion.";

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      image: {
        imageBytes: base64Data,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio,
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation completed but no URI returned.");

    const fetchUrl = downloadLink.includes('?') 
      ? `${downloadLink}&key=${apiKey}` 
      : `${downloadLink}?key=${apiKey}`;
      
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`Video download failed with status: ${response.status}`);
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("Veo Video Generation Error:", err);
    throw err;
  }
};
