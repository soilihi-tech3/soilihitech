const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Clés API
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AQ.Ab8RN6LBUL64UdeO9MbYm2Ymz_zXrSARVAfdNauyrza9UUgNTA";
const COHERE_API_KEY = process.env.COHERE_API_KEY || "cohere_YmSaRKT2vHne7045fNRyHXOMQDzzvQwxAGGm8MIj2ka1t1";

/**
 * Timeout fetch helper
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Nettoyage et parsing JSON robuste
 */
function cleanAndParseJson(rawText) {
  if (!rawText) return null;
  let text = rawText.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(text);
}

/**
 * Extraction des données binaires d'image (base64 / uploads / url) pour Gemini Vision
 */
async function parseImageData(photoUrl) {
  if (!photoUrl) return null;
  try {
    if (photoUrl.startsWith("data:image/")) {
      const match = photoUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return { mimeType: match[1], base64: match[2] };
      }
    }
    if (photoUrl.includes("/uploads/")) {
      const filename = photoUrl.split("/uploads/").pop().split("?")[0];
      const localPath = path.join(__dirname, "../../uploads", filename);
      if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(filename).toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        return { mimeType, base64: buffer.toString("base64") };
      }
    }
    if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
      const res = await fetchWithTimeout(photoUrl, {}, 5000);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const mimeType = res.headers.get("content-type") || "image/jpeg";
        return { mimeType, base64: buffer.toString("base64") };
      }
    }
  } catch (err) {
    console.warn("[AI Service] Impossible d'extraire les données de l'image:", err.message);
  }
  return null;
}

/**
 * Prompt système standardisé pour Soilihitech
 * EXIGENCE UTILISATEUR : NOM D'ARTICLE BREF ET PRÉCIS (PAS DE LONGUE PHRASE EN TITRE)
 */
function buildSystemPrompt() {
  return `Tu es l'assistant IA expert e-commerce pour la boutique high-tech "Soilihitech", spécialisée dans les accessoires pour smartphones et appareils électroniques (chargeurs rapides, coques, glaces 9D, câbles, écouteurs, batteries, etc.).

RÈGLE D'OR ABSOLUE POUR LE NOM D'ARTICLE ("nom") :
- LE NOM DOIT ÊTRE TRÈS BREF, COURT ET PRÉCIS : 3 À 5 MOTS MAXIMUM.
- INTERDICTION FORMELLE DE METTRE UNE PHRASE, UN PARAGRAPHE OU DES SOUS-TITRES DANS LE NOM.
- VA DIRECTEMENT AU BUT AVEC LE NOM COMMERCIAL EXACT DE L'ACCESSOIRE.
- Exemples parfaits de noms courts attendus :
  * "Chargeur Rapide 20W Type-C"
  * "Coque Silicone iPhone 15"
  * "Écouteurs Sans Fil TWS"
  * "Glace de Protection 9D"
  * "Câble Tressé USB-C 100W"
  * "Batterie Externe 10000mAh"
  * "Support Téléphone Voiture"
- Si une photo est fournie ou si l'utilisateur ne donne que la photo, identifie directement l'accessoire sur la photo et donne un nom court de ce type.

RÈGLES POUR LE RESTE DE LA FICHE :
- N'UTILISE STRICTEMENT AUCUN ÉMOJI DANS LE TEXTE (AUCUN SYMBOLE, AUCUN ÉMOJI).
- La description doit être très courte : 1 seule phrase d'accroche sobre suivie de 3 ou 4 tirets simples (-).

Tu DOIS répondre STRICTEMENT avec un objet JSON valide :
{
  "nom": "Nom ultra court et précis (3 à 5 mots max)",
  "marque": "Nom de la marque ou Neutre",
  "famille": "Une famille parmi: Chargeurs & Blocs, Câbles & Connectique, Pochettes & Coques, Glaces & Protections, Écouteurs & Audio, Powerbanks & Batteries, Supports & Auto",
  "description": "Phrase d'accroche courte et claire.\\n\\n- Spécification clé 1\\n- Spécification clé 2\\n- Spécification clé 3",
  "specifications": "- Spécification 1\\n- Spécification 2",
  "pointsForts": ["Point fort 1", "Point fort 2", "Point fort 3"],
  "studioImagePrompt": "Short english prompt of this accessory isolated on seamless pure white studio background"
}`;
}

function stripEmojis(str) {
  if (!str) return "";
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FC}\u{25FB}\u{25B6}\u{25C0}\u{1F004}\u{1F0CF}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F201}\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}\u{1F251}\u{203C}\u{2049}\u{00A9}\u{00AE}\u{2122}\u{2139}\u{2194}-\u{2199}\u{21A9}\u{21AA}\u{231A}\u{231B}\u{23E9}-\u{23EC}\u{23F0}\u{23F3}\u{24C2}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2600}-\u{2604}\u{260E}\u{2611}\u{2614}\u{2615}\u{2618}\u{261D}\u{2620}\u{2622}\u{2623}\u{2626}\u{262A}\u{262E}\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{2648}-\u{2653}\u{2660}\u{2663}\u{2665}\u{2666}\u{2668}\u{267B}\u{267F}\u{2692}-\u{2697}\u{2699}\u{269B}\u{269C}\u{26A0}\u{26A1}\u{26AA}\u{26AB}\u{26B0}\u{26B1}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26C8}\u{26CE}\u{26CF}\u{26D1}\u{26D3}\u{26D4}\u{26E9}\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}\u{2709}\u{270A}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}\u{2935}\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, "")
    .replace(/[•●▪]/g, "-")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Nettoyage et formatage final du résultat IA avec validation stricte du nom
 */
function sanitizeAiResult(res) {
  if (!res) return res;
  let cleanName = stripEmojis(res.nom || "").trim();
  
  // Couper les sous-titres verbeux
  if (cleanName.includes(" - ")) cleanName = cleanName.split(" - ")[0].trim();
  if (cleanName.includes(" | ")) cleanName = cleanName.split(" | ")[0].trim();
  if (cleanName.includes(" : ")) cleanName = cleanName.split(" : ")[0].trim();
  if (cleanName.includes(" – ")) cleanName = cleanName.split(" – ")[0].trim();

  // Limiter à maximum 5 à 6 mots pour garantir la brièveté demandée
  const words = cleanName.split(/\s+/);
  if (words.length > 5) {
    cleanName = words.slice(0, 5).join(" ");
  }
  if (cleanName.length > 45) {
    cleanName = cleanName.slice(0, 45).trim();
  }

  return {
    ...res,
    nom: cleanName,
    description: stripEmojis(res.description),
    specifications: stripEmojis(res.specifications)
  };
}

/**
 * 1. Génération via Groq
 */
async function callGroq(userPrompt) {
  if (!GROQ_API_KEY) throw new Error("Groq API key non configurée");
  
  const models = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
  let lastErr = null;

  for (const model of models) {
    try {
      const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 800,
          response_format: { type: "json_object" }
        })
      }, 7000);

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Groq HTTP ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      const parsed = cleanAndParseJson(content);
      if (parsed && parsed.nom) {
        return sanitizeAiResult({ ...parsed, provider: "Groq (" + model + ")" });
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Groq a échoué");
}

/**
 * 2. Génération via Gemini (avec vision multimodale si image fournie)
 */
async function callGemini(userPrompt, imageData = null) {
  if (!GEMINI_API_KEY) throw new Error("Gemini API key non configurée");

  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
  let lastErr = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      const parts = [
        { text: buildSystemPrompt() + "\n\nDemande utilisateur:\n" + userPrompt }
      ];

      // Si image disponible, l'injecter directement pour l'analyse visuelle par l'IA
      if (imageData && imageData.base64 && imageData.mimeType) {
        parts.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.base64
          }
        });
      }

      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800
          }
        })
      }, 8000);

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = cleanAndParseJson(content);
      if (parsed && parsed.nom) {
        const providerName = imageData ? `Gemini Vision (${model})` : `Gemini (${model})`;
        return sanitizeAiResult({ ...parsed, provider: providerName });
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Gemini a échoué");
}

/**
 * 3. Génération via Cohere
 */
async function callCohere(userPrompt) {
  if (!COHERE_API_KEY) throw new Error("Cohere API key non configurée");

  const models = ["command-r-plus-08-2024", "command-r", "command-r-08-2024"];
  let lastErr = null;

  for (const model of models) {
    try {
      const res = await fetchWithTimeout("https://api.cohere.com/v2/chat", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${COHERE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.5
        })
      }, 8000);

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Cohere HTTP ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const content = data?.message?.content?.[0]?.text;
      const parsed = cleanAndParseJson(content);
      if (parsed && parsed.nom) {
        return sanitizeAiResult({ ...parsed, provider: "Cohere (" + model + ")" });
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Cohere a échoué");
}

/**
 * Fallback de secours programmatique garanti
 */
function programmaticFallback(nom, marque, categorie) {
  const brand = marque && marque !== "Neutre" ? marque : "Universel";
  const cat = categorie || "Accessoire Smartphone";
  let title = nom ? nom.trim() : `${cat} ${brand}`.trim();
  const words = title.split(/\s+/);
  if (words.length > 5) title = words.slice(0, 5).join(" ");

  return {
    nom: title,
    marque: brand,
    famille: cat,
    description: `Accessoire fiable et performant adapté à vos smartphones ${brand}.\n\n- Finition de haute qualité et ajustement précis\n- Puce de protection certifiée contre les surtensions\n- 100% compatible avec votre appareil ${brand}\n- Robuste, durable et pratique au quotidien`,
    specifications: `- Marque : ${brand}\n- Type : ${cat}\n- Qualité : Conforme aux normes CE`,
    pointsForts: [
      "Compatibilité certifiée",
      "Matériaux résistants et durables",
      "Protection et sécurité intégrées"
    ],
    studioImagePrompt: `Clean professional studio product photo of ${title}, white background, soft studio lighting, sharp focus`,
    provider: "Soilihitech Engine (Fallback)"
  };
}

/**
 * Orchestrateur Multi-IA avec Failover automatique :
 * 1. Si image fournie -> Gemini Vision prioritaire pour voir la photo directement
 * 2. Groq (Prioritaire en mode texte pour sa rapidité)
 * 3. Gemini Flash
 * 4. Cohere
 * 5. Fallback déterministe garanti
 */
async function generateProductDetails({ nom, marque, categorie, userInstructions, photoKeywords, photoUrl }) {
  const imageData = await parseImageData(photoUrl);

  const userPrompt = `Détails de l'article pour Soilihitech :
- Nom saisi / indication : ${nom || "Non précisé, analyse attentivement la photo"}
- Marque ciblée : ${marque || "Détermine la marque sur la photo ou mets Neutre"}
- Catégorie : ${categorie || "Détermine la catégorie sur la photo"}
${photoKeywords ? `- Mots-clés visuels : ${photoKeywords}` : ""}
${userInstructions ? `- Consigne utilisateur : ${userInstructions}` : ""}
- CONSIGNE IMPORTANTE : LE NOM DE L'ARTICLE DOIT ÊTRE TRÈS BREF ET COURT (3 À 5 MOTS MAX). AUCUNE PHRASE EN TITRE.`;

  console.log("[AI Service] Début de la génération. Image fournie ?", !!imageData);

  // 1. Si une image réelle est transmise, utiliser Gemini Vision en premier
  if (imageData) {
    try {
      const resGeminiVision = await callGemini(userPrompt, imageData);
      if (resGeminiVision) return resGeminiVision;
    } catch (errVision) {
      console.warn("[AI Service] Gemini Vision a échoué, passage aux autres moteurs :", errVision.message);
    }
  }

  // 2. Groq
  try {
    const resGroq = await callGroq(userPrompt);
    return resGroq;
  } catch (errGroq) {
    console.warn("[AI Service] Groq indisponible :", errGroq.message);
  }

  // 3. Gemini Texte
  try {
    const resGemini = await callGemini(userPrompt);
    return resGemini;
  } catch (errGemini) {
    console.warn("[AI Service] Gemini indisponible :", errGemini.message);
  }

  // 4. Cohere
  try {
    const resCohere = await callCohere(userPrompt);
    return resCohere;
  } catch (errCohere) {
    console.warn("[AI Service] Cohere indisponible :", errCohere.message);
  }

  return programmaticFallback(nom, marque, categorie);
}

/**
 * Génération d'une vraie photo publicitaire studio haut de gamme sur fond blanc pur (modèle turbo rapide sans rate-limit)
 */
function generateStudioPhotoUrl({ nom, marque, categorie, studioImagePrompt, slot = "principale" }) {
  let subject = "";
  const n = (nom || "").toLowerCase();

  if (n.includes("charg") || n.includes("bloc") || n.includes("adapt") || n.includes("20w") || n.includes("65w") || n.includes("prise")) {
    const brandLabel = marque && marque !== "Neutre" ? marque : "Apple style";
    subject = `${brandLabel} fast charging usb-c power adapter block with white cable, sleek clean tech gadget`;
  } else if (n.includes("glac") || n.includes("verr") || n.includes("protect") || n.includes("film") || n.includes("espion") || n.includes("screen")) {
    subject = `9D tempered glass screen protector for smartphone with clean luxury packaging, crystal clear`;
  } else if (n.includes("coq") || n.includes("poch") || n.includes("silicon") || n.includes("hous") || n.includes("etui") || n.includes("case")) {
    subject = `matte silicone protective shockproof slim phone case, modern design`;
  } else if (n.includes("ecout") || n.includes("airpod") || n.includes("earbud") || n.includes("casq") || n.includes("audio")) {
    subject = `wireless bluetooth earbuds with glossy charging case, sleek audio gear`;
  } else if (n.includes("cabl") || n.includes("cord") || n.includes("type-c") || n.includes("lightning") || n.includes("fil")) {
    subject = `durable braided fast charging cable neatly coiled, aluminum connectors`;
  } else if (n.includes("power") || n.includes("batt") || n.includes("externe")) {
    subject = `slim portable power bank external battery pack with digital display, metallic finish`;
  } else if (n.includes("supp") || n.includes("trepied") || n.includes("auto")) {
    subject = `magnetic car dashboard phone holder mount, aluminum alloy`;
  } else if (studioImagePrompt && studioImagePrompt.length > 10) {
    subject = studioImagePrompt.slice(0, 150);
  } else {
    subject = `${nom || "modern smartphone tech accessory"} ${marque || ""}`.trim();
  }

  const angle = slot === "secondaire" 
    ? "45 degree isometric perspective angle" 
    : "front commercial product packshot";

  const fullPrompt = `commercial product advertising photography of ${subject}, ${angle}, isolated on seamless pure white studio background, soft studio lightbox illumination, sharp focus, 8k resolution, high quality e-commerce advertisement catalog photo, centered, no watermark`;

  const cleanPrompt = encodeURIComponent(fullPrompt.replace(/[^a-zA-Z0-9 ,.-]/g, "").slice(0, 300));
  const seed = Math.floor(Math.random() * 900000) + 1000;
  return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=800&height=800&nologo=true&model=turbo&seed=${seed}`;
}

module.exports = {
  generateProductDetails,
  generateStudioPhotoUrl,
  callGroq,
  callGemini,
  callCohere
};
