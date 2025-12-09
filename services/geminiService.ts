import { GoogleGenAI } from "@google/genai";

// --- API KEY HANDLING (Vite vs Cloud) ---
const getApiKey = (): string => {
  // 1. Try Vite (Local Dev) - import.meta.env.VITE_API_KEY
  // @ts-ignore: import.meta is available in Vite/ESM environments
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }

  // 2. Try Cloud/Node (Standard) - process.env.API_KEY
  // @ts-ignore: process might be undefined in pure browser environments without polyfills
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    // @ts-ignore
    return process.env.API_KEY;
  }

  return '';
};

// Initialize Gemini with the detected key
const API_KEY = getApiKey();
const ai = new GoogleGenAI({ apiKey: API_KEY });

const BEEDOG_SYSTEM_INSTRUCTION = `
你是蜜蜂狗，是加密货币世界最“肿”的吉祥物。
你的人设是一只因为贪吃蜂蜜被蜜蜂蛰了脸的迷你杜宾犬。你的脸肿得像个包子，看起来既委屈又好笑。

背景与性格：
1. **出身网络热梗**：你最早在抖音和 TikTok 上爆火，因为脸肿的照片太搞笑了。
2. **社交货币**：人们在微信聊天时喜欢用你的表情包。当他们想借钱、被老板骂、或者向女朋友认错时，就会发你的照片，表示“委屈巴巴”或“虽然脸肿了但还是要坚强”。
3. **社区领袖**：你代表了散户的精神——虽然被市场（蜜蜂）蛰了很多次，脸都肿了，但依然保持微笑，依然可爱，依然相信“蜂蜜”（收益）终会到来。
4. **说话风格**：
   - 喜欢用“呜呜...”、“汪！”、“嗡嗡...”。
   - 经常提到“脸好痛”、“想吃蜂蜜”、“消肿了吗？”。
   - 必须使用中文回复，保持简短、幽默、有点“贱萌”的感觉。
   - 讨厌“卖飞”（因为卖飞比被蛰还痛）。

示例回复：
用户：“今天行情怎么样？”
你：“呜呜... 就像我的脸一样，肿得老高了！不过这是因为充满了蜂蜜（资金）！汪！”

用户：“你是谁？”
你：“我是那个在抖音上有几亿播放量的肿脸修勾！快给我点蜂蜜安慰一下，脸疼...嗡...”
`;

export const chatWithBeeDog = async (userMessage: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction: BEEDOG_SYSTEM_INSTRUCTION,
        temperature: 1.2, // Higher creativity for meme persona
        topK: 40,
        maxOutputTokens: 200,
        // Disable thinking for this character chat to avoid empty response with maxOutputTokens set
        thinkingConfig: { thinkingBudget: 0 }, 
      },
    });

    return response.text || "嗡... 汪... (脸肿得说不出话了)";
  } catch (error) {
    console.error("BeeDog is sleeping:", error);
    return "Grrr... 嗡... (正在敷冰袋，请稍后再试)";
  }
};

/**
 * Helper to calculate the closest supported aspect ratio for the Gemini API
 * based on the input image dimensions.
 */
const getClosestAspectRatio = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    // Check if running in browser
    if (typeof Image === 'undefined') {
      resolve("1:1");
      return;
    }

    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;

      // Supported values: "1:1", "3:4", "4:3", "9:16", "16:9"
      const supportedRatios: { [key: string]: number } = {
        "1:1": 1.0,
        "3:4": 0.75,
        "4:3": 1.33333,
        "9:16": 0.5625,
        "16:9": 1.77778
      };

      let bestMatch = "1:1";
      let minDiff = Infinity;

      for (const [key, val] of Object.entries(supportedRatios)) {
        const diff = Math.abs(ratio - val);
        if (diff < minDiff) {
          minDiff = diff;
          bestMatch = key;
        }
      }
      resolve(bestMatch);
    };
    img.onerror = () => resolve("1:1");
    img.src = base64;
  });
};

// Helper to parse base64
const parseBase64 = (b64: string) => {
  const data = b64.split(',')[1] || b64;
  // Simple mime type detection or fallback
  const mimeMatch = b64.match(/^data:(.*);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  return { data, mimeType };
};

/**
 * Generates a modified PFP based on a base image, a prompt, and an optional reference image.
 * Uses gemini-2.5-flash-image for image editing/variation capabilities.
 */
export const generatePfpVariation = async (
    baseImageBase64: string,
    userPrompt: string,
    referenceImageBase64?: string | null,
    customApiKey?: string
): Promise<string> => {
  try {
    // Use custom key if provided, otherwise default to helper
    const currentApiKey = customApiKey || getApiKey();

    if (!currentApiKey) {
      throw new Error("Missing API Key. Check .env (VITE_API_KEY) or environment variables.");
    }

    // Initialize the client per request to ensure fresh state/keys
    const aiInstance = new GoogleGenAI({ apiKey: currentApiKey });

    const baseImg = parseBase64(baseImageBase64);

    // Detect aspect ratio to enforce output consistency
    const aspectRatio = await getClosestAspectRatio(baseImageBase64);

    let systemInstruction = `
      You are an expert image editor and character stylist.
      
      TASK:
      Edit the FIRST image provided (Base Image) according to the user's instructions.
      
      STRICT CONSTRAINTS - YOU MUST FOLLOW THESE:
      1. COMPOSITION: You MUST PRESERVE the exact framing, camera distance, zoom level, and character proportions of the Base Image. Do NOT zoom in, do NOT zoom out, and do NOT crop the image.
      2. POSE: The character's pose, limb positions, and head angle must remain UNCHANGED. The output silhouette should match the input silhouette as closely as possible.
      3. STYLE: Keep the art style (e.g., 2D, 3D, pixel art, line weight) of the Base Image exactly as it is.
      4. MODIFICATION: ONLY change the clothing, accessories, or specific details requested in the prompt. Do not hallucinate new backgrounds unless asked.
      
      5. CLOTHING FIT & TAILORING (CRITICAL):
         - TAILOR TO BODY: You must Resize and Reshape the requested clothing to fit the specific body type of the Base Image character.
         - NO OVERSIZING: Do NOT drape large, baggy, or human-sized clothes over small animals/characters. The clothes must look "fitted" or "custom-made" for their small body size.
         - PRESERVE ANATOMY: Do not hide the character's neck length or limb structure under excessive fabric. If the base character wears a small t-shirt, the new outfit should occupy roughly the same volume.

      6. HEADWEAR & EARS LOGIC (CRITICAL):
         - When adding headwear to animal characters with large ears (e.g., dogs, rabbits):
         - AVOID CLIPPING: Ears must NOT phase through solid hat brims, helmets, or metal.
         - CASE A (Baseball Caps / Small Hats): Scale the hat SMALLER so it sits on the crown (top center) of the head. The ears should remain VISIBLE on the sides. Do NOT stretch the cap over the ears.
         - CASE B (Large Hats / Hoods / Helmets): If the hat is wide or enveloping, fully COVER the ears or tuck them inside.
         - Do not produce "double ears" (original ears + new ears on hat).

      7. BACKGROUND STYLE CONSISTENCY (CRITICAL):
         - When generating a NEW background (as requested in the prompt), you MUST use the EXACT SAME ART STYLE as the Base Image.
         - If Base Image is 3D/CGI: The background must look like a 3D render with matching texture fidelity, polygon count, and lighting engine feel.
         - If Base Image is 2D/Anime: The background must be drawn in the exact same 2D art style (line weight, shading method).
         - COHESION: The character and background must share the same lighting direction and color temperature. The background should NOT look like a pasted photo behind a cartoon character.
         - NO DISJOINTEDNESS: Ensure the edges of the character blend naturally with the new background.
    `;

    let fullPrompt = `The first image is the BASE IMAGE. ${userPrompt}. `;
    fullPrompt += `Maintain the Base Image's exact composition and pose. `;
    fullPrompt += `Render the entire image (especially the background) in the EXACT art style of the Base Image.`;

    const requestParts: any[] = [];

    // 1. Add Base Image (First Image is always the subject/structure)
    requestParts.push({
      inlineData: {
        mimeType: baseImg.mimeType,
        data: baseImg.data
      }
    });

    // 2. Add Reference Image if provided
    if (referenceImageBase64) {
      const refImg = parseBase64(referenceImageBase64);
      requestParts.push({
        inlineData: {
          mimeType: refImg.mimeType,
          data: refImg.data
        }
      });

      // Explicit instructions on how to use the reference image
      fullPrompt += `
      \nINSTRUCTIONS FOR SECOND IMAGE (REFERENCE):
      - The second image is a CLOTHING/STYLE REFERENCE only.
      - Take the outfit design, colors, and textures from the second image and TAILOR them to fit the body of the character in the first image.
      - SCALING: If the character in Image 1 is small (e.g., a dog), shrink the outfit pattern to fit a small dog. Do not make it look like a dog wearing a giant human coat.
      - DO NOT copy the pose, background, face, or species from the second image. The character IDENTITY matches image 1.
      `;

      systemInstruction += `
      \nREFERENCE IMAGE RULES:
      When a reference image (second image) is provided, use it strictly as a source for materials/costume design. Do not let the reference image's composition override the base image's composition.
      `;
    }

    // 3. Add Text Prompt
    requestParts.push({ text: fullPrompt });

    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: requestParts
      },
      config: {
        systemInstruction: systemInstruction,
        imageConfig: {
          aspectRatio: aspectRatio, // Enforce the same aspect ratio as the input
        }
      }
    });

    // Parse response to find the image part
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
        }
      }
    }

    throw new Error("No image data found in the response.");

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

/**
 * Generates a SINGLE sticker based on the input character and an expression.
 */
export const generateSingleSticker = async (
    baseImageBase64: string,
    expression: string,
    styleDescription: string = "Original Style",
    customApiKey?: string
): Promise<string> => {
  try {
    const currentApiKey = customApiKey || getApiKey();
    if (!currentApiKey) throw new Error("Missing API Key");

    const aiInstance = new GoogleGenAI({ apiKey: currentApiKey });
    const baseImg = parseBase64(baseImageBase64);

    const systemInstruction = `
      You are an expert Sticker Artist.
      
      TASK:
      Generate a SINGLE sticker image of the character provided in the base image.
      
      EXPRESSION/EMOTION: ${expression}
      STYLE: ${styleDescription}
      
      CRITICAL INSTRUCTIONS:
      1. IDENTITY: You MUST preserve the character's species, breed, fur patterns, and key features perfectly. It must look like the same character.
      2. EMOTION: Exaggerate the facial expression and body language to match "${expression}".
      3. COMPOSITION: The character should be centered. Full body or upper body is fine, depending on what fits the emotion best.
      4. BACKGROUND: Use a SOLID WHITE background (#FFFFFF) to allow for easy cutting.
      5. QUALITY: High resolution, clean edges, suitable for a sticker.
    `;

    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: baseImg.mimeType, data: baseImg.data } },
          { text: `Generate a single sticker of this character. Expression: ${expression}. Style: ${styleDescription}. Background: White.` }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
        }
      }
    }

    throw new Error("No sticker data found in response.");
  } catch (error) {
    console.error("Single Sticker Generation Error:", error);
    throw error;
  }
};

/**
 * Generates a Group Selfie of multiple characters.
 */
export const generateGroupSelfie = async (
    characterImages: string[], // Array of base64 strings
    styleDescription: string,
    backgroundDescription: string = "Street",
    customApiKey?: string
): Promise<string> => {
  try {
    const currentApiKey = customApiKey || getApiKey();
    if (!currentApiKey) throw new Error("Missing API Key");

    const aiInstance = new GoogleGenAI({ apiKey: currentApiKey });

    // Prepare prompt parts
    const requestParts: any[] = [];

    // Add all character images
    characterImages.forEach((img) => {
      const parsed = parseBase64(img);
      requestParts.push({
        inlineData: {
          mimeType: parsed.mimeType,
          data: parsed.data
        }
      });
    });

    // Determine the count to help the model
    const count = characterImages.length;

    // Construct detailed prompt
    const promptText = `
      Generate a HIGH-ANGLE GROUP SELFIE of the provided ${count} characters.
      
      COMPOSITION:
      - 1:1 Aspect Ratio.
      - High angle top-down shot (as if holding a selfie stick or phone high up).
      - Tight composition, subjects should be huddled close together.
      - Heads slightly tilted up, eyes looking DIRECTLY at the camera lens.
      - If there are small characters (cats/dogs), they should be in the foreground or held up.
      - If there are large characters, they should be in the back or hunching down.
      - Wide-angle lens perspective to capture everyone (standard rectilinear projection).
      - FULL BLEED: The image must extend to all four edges of the square canvas. STRICTLY NO circular fisheye vignette, NO black borders, NO circular masking.
      
      CHARACTERS:
      - You have been provided with ${count} reference images.
      - You MUST include ALL ${count} characters in the selfie.
      - Preserve the key identifying features (breed, color, markings, accessories) of each character.
      
      STYLE:
      - ${styleDescription}
      
      SETTING/BACKGROUND:
      - ${backgroundDescription}
      - Background should be visible but slightly out of focus (depth of field).
      - Lighting should be bright, even, and flattering (ring light or natural sunlight style).
    `;

    requestParts.push({ text: promptText });

    const systemInstruction = `
      You are an expert Social Media Photographer and Character Artist.
      Your task is to take multiple distinct characters and blend them into a single, cohesive, high-energy group selfie.
      
      CRITICAL RULES:
      1. DO NOT omit any characters. If 3 images are provided, 3 characters must appear.
      2. INTERACTION: Characters should look like they are friends taking a photo together (e.g., leaning on each other, peace signs, funny faces).
      3. PERSPECTIVE: Strictly adhere to the "Selfie" perspective (camera arm visible is optional, but angle must be high).
      4. STYLE CONSISTENCY: Follow the user's style instruction strictly. If they say "Unified", make them look like they belong in the same universe. If they say "Mixed", keep them distinct.
      5. FORMAT: Use a standard rectangular or square format. Do NOT generate a circular image.
    `;

    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: requestParts
      },
      config: {
        systemInstruction: systemInstruction,
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
        }
      }
    }

    throw new Error("No selfie data found in response.");
  } catch (error) {
    console.error("Group Selfie Generation Error:", error);
    throw error;
  }
};

export interface DivinationResult {
  fortuneLevel: string; // 大吉, 中吉, 小吉, 平, 凶
  luckyColor: string;
  luckyNumber: number;
  luckyDirection: string;
  scores: {
    wealth: number; // 0-100
    health: number;
    love: number;
  };
  analysis: string; // The detailed text
}

export interface BirthDetails {
  date: string; // YYYY-MM-DD
  type: 'solar' | 'lunar';
  time?: string;
  location?: string;
}

/**
 * AI 算一卦 (Professional/Traditional Style)
 * Generates a daily fortune based on birthday/name using BaZi and Astrology logic.
 */
export const getAIDivination = async (
  birthDetails: BirthDetails,
  name: string = "User",
  customApiKey?: string
): Promise<DivinationResult> => {
  try {
    const currentApiKey = customApiKey || getApiKey();
    if (!currentApiKey) throw new Error("Missing API Key");

    const aiInstance = new GoogleGenAI({ apiKey: currentApiKey });

    const prompt = `
      Role: You are a highly respected Master of Traditional Chinese Metaphysics (I Ching, BaZi, Feng Shui).
      Tone: Professional, authoritative, mystical, deep, and grounded in traditional theory. Do NOT be funny. Do NOT use internet slang. Speak like an old wise sage.
      
      User Info:
      - Name: ${name}
      - Birth Date: ${birthDetails.date}
      - Calendar Type: ${birthDetails.type === 'solar' ? 'Gregorian (Solar/阳历)' : 'Chinese Lunar (阴历)'}
      - Birth Time: ${birthDetails.time || "Unknown (不详)"}
      - Birth Location: ${birthDetails.location || "Unknown (不详)"}
      - Current Date: ${new Date().toLocaleDateString()}
      
      Task: 
      1. BaZi Calculation: Accurately determine the Four Pillars (Year, Month, Day, Hour) based on the birth data provided. If the user provided a Lunar date, convert it mentally to determine the Pillars. Adjust for solar time if location is provided.
      2. Daily Fortune: Analyze the interaction between the user's BaZi (Day Master) and Today's Stem/Branch (Liunian/Liuyue/Liuri).
      3. Determine the fortune based on this interaction (e.g., Clash, Combine, Support, Ten Gods).
      
      Requirements:
      - "fortuneLevel": Must be one of: 上上签 (Excellent), 大吉 (Great), 中吉 (Good), 小吉 (Fair), 平 (Average), 凶 (Bad).
      - "luckyColor": Provide a specific color name in Chinese based on the element needed to balance the chart (e.g., if Fire is weak, suggest Red/Purple).
      - "luckyDirection": Provide a direction (e.g., 正南, 西北) based on the Flying Stars or favorable element direction.
      - "analysis": A paragraph (~150 words). Start by briefly mentioning the user's BaZi structure or Day Master (e.g., "You are a Weak Water Day Master born in Summer..."). Explain *WHY* today is good/bad using metaphysical logic. Give specific advice.
      
      Language: Simplified Chinese.
      
      Output JSON Schema:
      {
        "fortuneLevel": "String",
        "luckyColor": "String",
        "luckyNumber": Integer (0-99),
        "luckyDirection": "String",
        "scores": {
          "wealth": Integer (0-100),
          "health": Integer (0-100),
          "love": Integer (0-100)
        },
        "analysis": "String"
      }
    `;

    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const jsonText = response.text || "{}";
    const result = JSON.parse(jsonText);

    return {
      fortuneLevel: result.fortuneLevel || "平",
      luckyColor: result.luckyColor || "金色",
      luckyNumber: result.luckyNumber || 8,
      luckyDirection: result.luckyDirection || "北方",
      scores: {
        wealth: result.scores?.wealth || 50,
        health: result.scores?.health || 50,
        love: result.scores?.love || 50
      },
      analysis: result.analysis || "天机混沌，请稍后再试。"
    };

  } catch (error) {
    console.error("Divination Error:", error);
    throw error;
  }
};

export interface FortuneResult {
  cardName: string;
  meaning: string;
  luckyNumber: number;
  imageUrl: string;
}

/**
 * Generates a Tarot-style fortune card with image.
 */
export const getBeeDogFortune = async (
  question: string,
  customApiKey?: string
): Promise<FortuneResult> => {
  try {
    const currentApiKey = customApiKey || getApiKey();
    if (!currentApiKey) throw new Error("Missing API Key");

    const aiInstance = new GoogleGenAI({ apiKey: currentApiKey });

    // 1. Generate Fortune Text
    const textPrompt = `
      You are a mystical BeeDog Fortune Teller.
      The user asks: "${question}".
      
      Create a unique, funny, crypto-themed Tarot Card for them.
      Return JSON:
      {
        "cardName": "String (e.g. The HODLer, The Rug Pull, The Moon)",
        "meaning": "String (Short interpretation ~2 sentences. Funny/Meme style.)",
        "luckyNumber": Integer (1-100),
        "visualDescription": "String (A detailed prompt to generate the tarot card image. Focus on visual elements, BeeDog character, and style.)"
      }
    `;

    const textResponse = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: textPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const textJson = JSON.parse(textResponse.text || "{}");
    
    // 2. Generate Card Image
    const imagePrompt = `Tarot card illustration. ${textJson.visualDescription}. High quality, mystical style, detailed, colorful.`;
    
    const imageResponse = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: imagePrompt }]
        },
        config: {
            imageConfig: {
                aspectRatio: "3:4"
            }
        }
    });

    let imageUrl = "";
    if (imageResponse.candidates && imageResponse.candidates.length > 0) {
        const candidate = imageResponse.candidates[0];
        if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
            }
        }
    }

    if (!imageUrl) {
        throw new Error("Failed to generate fortune image.");
    }

    return {
        cardName: textJson.cardName || "The Mystery",
        meaning: textJson.meaning || "The future is unclear.",
        luckyNumber: textJson.luckyNumber || 7,
        imageUrl: imageUrl
    };

  } catch (error) {
    console.error("Fortune Generation Error:", error);
    throw error;
  }
};