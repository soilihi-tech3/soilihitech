const sharp = require("sharp");

// Clés API
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AQ.Ab8RN6LBUL64UdeO9MbYm2Ymz_zXrSARVAfdNauyrza9UUgNTA";
const COHERE_API_KEY = process.env.COHERE_API_KEY || "cohere_YmSaRKT2vHne7045fNRyHXOMQDzzvQwxAGGm8MIj2ka1t1";

/**
 * Timeout fetch helper
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
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
  // Retirer les blocs markdown ```json ... ```
  if (text.startsWith("```")) {
    text = text.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  // Trouver le premier { et dernier }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(text);
}

/**
 * Prompt système standardisé pour Soilihitech
 */
function buildSystemPrompt() {
  return `Tu es l'assistant IA expert e-commerce pour la boutique high-tech "Soilihitech", spécialisée dans les accessoires pour smartphones et appareils électroniques (iPhone, Samsung, Tecno, Infinix, Xiaomi, AirPods, chargeurs rapides GaN, câbles renforcés, glaces de protection 9D, pochettes et coques antichoc, écouteurs, batteries externes).
Génère une fiche produit professionnelle en français.

CONSIGNE STRICTE ET OBLIGATOIRE :
- N'UTILISE AUCUN ÉMOJI DANS LE TEXTE (AUCUN SYMBOLE, AUCUN ÉMOJI).
- LA DESCRIPTION DOIT ÊTRE TRÈS BRÈVE, COURTE, PRÉCISE ET EN TEXTE PUR.
Format exact de la description (4 à 5 lignes maximum) :
1. Une seule phrase d'accroche claire et percutante.
2. Un saut de ligne.
3. Exactement 3 à 4 tirets standards simples (-) résumant les spécifications clés en texte sobre :
   - Puissance et vitesse de charge
   - Sécurité et puce de protection
   - Compatibilité smartphone garantie
   - Finition, format et robustesse

Exemple type conforme :
"Chargeur rapide 20W certifié conçu pour recharger votre smartphone rapidement et en toute sécurité.

- Charge rapide Power Delivery atteignant 50% en 30 minutes
- Protection intelligente contre les surchauffes et variations de tension
- Compatibilité garantie avec iPhone, Samsung, Tecno et tous smartphones USB-C
- Boîtier compact et connecteurs renforcés pour une longue durabilité"

Tu DOIS répondre STRICTEMENT avec un objet JSON valide, sans aucun texte autour, au format :
{
  "nom": "Titre commercial court et sobre (max 60 caractères)",
  "marque": "Nom de la marque (ex: Apple, Samsung, Tecno, Infinix, Xiaomi, Oraimo, Anker, Baseus ou Neutre)",
  "famille": "Une famille parmi: Chargeurs & Blocs, Câbles & Connectique, Pochettes & Coques, Glaces & Protections, Écouteurs & Audio, Powerbanks & Batteries, Supports & Auto",
  "description": "La description courte en texte pur avec 1 phrase et 3 ou 4 tirets simples sans aucun emoji",
  "specifications": "- Puissance : ...\n- Compatibilité : ...\n- Norme : ...",
  "pointsForts": ["Point fort 1", "Point fort 2", "Point fort 3", "Point fort 4"],
  "studioImagePrompt": "Detailed commercial product photography prompt in english of this accessory isolated on pure white background"
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
 * Nettoyage et formatage final du résultat IA
 */
function sanitizeAiResult(res) {
  if (!res) return res;
  return {
    ...res,
    nom: stripEmojis(res.nom),
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
          temperature: 0.6,
          max_tokens: 1000
        })
      }, 8000);

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
 * 2. Génération via Gemini
 */
async function callGemini(userPrompt) {
  if (!GEMINI_API_KEY) throw new Error("Gemini API key non configurée");

  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
  let lastErr = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: buildSystemPrompt() + "\n\nDemande utilisateur:\n" + userPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1000
          }
        })
      }, 7000);

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = cleanAndParseJson(content);
      if (parsed && parsed.nom) {
        return sanitizeAiResult({ ...parsed, provider: "Gemini (" + model + ")" });
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
          temperature: 0.6
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
  const brand = marque || "Universel";
  const cat = categorie || "Accessoire Smartphone";
  const title = nom ? `${nom} pour ${brand}` : `${cat} Haute Performance pour ${brand}`;
  return {
    nom: title,
    marque: brand,
    famille: cat,
    description: `Accessoire haute performance pour vos smartphones ${brand}.\n\n- Finition soignée et durabilité maximale au quotidien\n- Puce de protection certifiée et ajustement parfait\n- 100% compatible avec les appareils de la marque ${brand}\n- Pratique, robuste et facile à transporter`,
    specifications: `- Marque : ${brand}\n- Type : ${cat}\n- Qualité : Norme CE, testé en atelier`,
    pointsForts: [
      "Compatibilité certifiée",
      "Matériaux résistants et durables",
      "Sécurité et protection optimales",
      "Garantie qualité Soilihitech"
    ],
    studioImagePrompt: `Clean professional studio product photo of ${title}, white background, soft studio lighting, sharp focus`,
    provider: "Soilihitech Engine (Fallback)"
  };
}

/**
 * Orchestrateur Multi-IA avec Failover automatique :
 * 1. Groq (Prioritaire car ultra-rapide)
 * 2. Si panne Groq -> Gemini prend le relais
 * 3. Si panne Gemini -> Cohere prend le relais
 * 4. Si tout échoue -> Fallback déterministe garanti
 */
async function generateProductDetails({ nom, marque, categorie, userInstructions, photoKeywords }) {
  const userPrompt = `Détails de l'article à créer pour Soilihitech :
- Nom approximatif / saisie : ${nom || "Non précisé"}
- Marque ciblée : ${marque || "Tous téléphones (iPhone / Samsung / Tecno / etc.)"}
- Catégorie d'accessoire : ${categorie || "Accessoire électronique"}
- Mots-clés visuels de la photo : ${photoKeywords || "Non spécifié"}
- Consigne : Très court, sobre, aucun emoji, une phrase d'accroche et 3-4 tirets simples`;

  console.log("[AI Service] Début de la génération avec failover...");

  try {
    const resGroq = await callGroq(userPrompt);
    return resGroq;
  } catch (errGroq) {
    console.warn("[AI Service] Groq indisponible :", errGroq.message);
  }

  try {
    const resGemini = await callGemini(userPrompt);
    return resGemini;
  } catch (errGemini) {
    console.warn("[AI Service] Gemini indisponible :", errGemini.message);
  }

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
  const m = (marque || "").toLowerCase();

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
  // Utiliser model=turbo pour une génération instantanée sans le rate limit de 45 secondes
  return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=800&height=800&nologo=true&model=turbo&seed=${seed}`;
}

module.exports = {
  generateProductDetails,
  generateStudioPhotoUrl,
  callGroq,
  callGemini,
  callCohere
};
