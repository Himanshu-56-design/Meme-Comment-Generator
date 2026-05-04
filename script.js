const API_KEY = "";
const OPENROUTER_MODEL = "openrouter/free";
const OPENROUTER_RETRY_MODEL = "openrouter/auto";

const imageInput = document.getElementById("imageInput");
const imageUrlInput = document.getElementById("imageUrl");
const apiKeyInput = document.getElementById("apiKey");
const rememberKey = document.getElementById("rememberKey");
const captionStyle = document.getElementById("captionStyle");
const emojiMode = document.getElementById("emojiMode");
const qualityMode = document.getElementById("qualityMode");
const languageMode = document.getElementById("languageMode");
const memeContext = document.getElementById("memeContext");
const userTopic = document.getElementById("userTopic");
const generateBtn = document.getElementById("generateBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyAllEnglishBtn = document.getElementById("copyAllEnglishBtn");
const copyAllHinglishBtn = document.getElementById("copyAllHinglishBtn");
const themeToggle = document.getElementById("themeToggle");
const loadingState = document.getElementById("loadingState");
const errorBox = document.getElementById("errorBox");
const previewImage = document.getElementById("previewImage");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const imageStatus = document.getElementById("imageStatus");
const captionGrid = document.getElementById("captionGrid");
const toast = document.getElementById("toast");
const fileNameDisplay = document.getElementById("fileNameDisplay");

let currentImageDescription = "";
let currentImageContent = null;
let generatedComments = { english: [], hinglish: [] };
let lastSceneSummary = "";
let toastTimer;
const favorites = new Set(loadFavorites());

imageInput.addEventListener("change", handleImageUpload);
imageUrlInput.addEventListener("input", handleImageUrlPreview);
generateBtn.addEventListener("click", generateCaptions);
regenerateBtn.addEventListener("click", generateCaptions);
downloadBtn.addEventListener("click", downloadCaptions);
copyAllEnglishBtn.addEventListener("click", copyAllEnglish);
copyAllHinglishBtn.addEventListener("click", copyAllHinglish);
themeToggle.addEventListener("click", toggleTheme);
rememberKey.addEventListener("change", handleRememberToggle);
languageMode.addEventListener("change", () => renderCaptions(generatedComments));

function handleImageUpload(event) {
  const file = event.target.files[0];

  if (!file) {
    fileNameDisplay.textContent = "No file chosen";
    if (!imageUrlInput.value.trim()) {
      resetPreview();
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (loadEvent) {
    const originalDataUrl = loadEvent.target.result;
    const aiSafeDataUrl = await normalizeUploadDataUrl(originalDataUrl);

    currentImageDescription = `Uploaded meme image file named "${file.name}"`;
    currentImageContent = {
      type: "image_url",
      image_url: {
        url: aiSafeDataUrl
      }
    };
    fileNameDisplay.textContent = file.name;
    imageUrlInput.value = "";
    showPreview(originalDataUrl, `Preview loaded from uploaded file: ${file.name}`);
  };
  reader.readAsDataURL(file);
}

function handleImageUrlPreview() {
  const url = imageUrlInput.value.trim();

  if (!url) {
    if (!imageInput.files[0]) {
      resetPreview();
    }
    return;
  }

  fileNameDisplay.textContent = imageInput.files[0]?.name || "No file chosen";
  currentImageDescription = `Image URL provided: ${url}`;
  currentImageContent = {
    type: "image_url",
    image_url: {
      url
    }
  };
  showPreview(url, "Preview loaded from pasted image URL.");
}

function showPreview(source, statusText) {
  previewImage.src = source;
  previewImage.classList.remove("hidden");
  previewPlaceholder.classList.add("hidden");
  imageStatus.textContent = statusText;
}

function resetPreview() {
  currentImageDescription = "";
  currentImageContent = null;
  if (!imageInput.files[0]) {
    fileNameDisplay.textContent = "No file chosen";
  }
  previewImage.removeAttribute("src");
  previewImage.classList.add("hidden");
  previewPlaceholder.classList.remove("hidden");
  imageStatus.textContent = "No image selected yet.";
}

function toggleTheme() {
  document.body.classList.toggle("theme-dark");
}

function handleRememberToggle() {
  const key = apiKeyInput.value.trim();

  if (rememberKey.checked) {
    if (!key) {
      rememberKey.checked = false;
      showError("Enter your OpenRouter API key first.");
      return;
    }

    localStorage.setItem("meme_api_key", key);
    showToast("API key saved on this device");
    return;
  }

  localStorage.removeItem("meme_api_key");
  showToast("Saved API key removed");
}

async function generateCaptions() {
  hideError();

  const apiKey = apiKeyInput.value.trim() || API_KEY;
  const contextText = memeContext.value.trim();
  const style = captionStyle.value;
  const emoji = emojiMode.value;
  const quality = qualityMode.value;
  const language = languageMode.value;
  const topic = userTopic.value.trim();
  if (!apiKey) {
    showError("Enter your OpenRouter API key to continue.");
    return;
  }

  if (rememberKey.checked) {
    localStorage.setItem("meme_api_key", apiKey);
  }

  if (!currentImageContent) {
    showError("Please upload or paste a meme image so AI can understand the meme first.");
    return;
  }

  const context = buildContext(contextText, topic);
  const prompt = buildPrompt(context, style, emoji, topic, quality, language, Boolean(currentImageContent));

  setLoading(true);
  lastSceneSummary = "";
  renderLoadingCards();

  try {
    const result = await fetchBilingualCommentsFromOpenRouter(prompt, apiKey, currentImageContent, style);
    generatedComments = {
      english: result.english.slice(0, 5),
      hinglish: result.hinglish.slice(0, 5)
    };
    lastSceneSummary = result.scene;
    renderCaptions(generatedComments);
    showToast("Relatable bilingual comments generated");
  } catch (error) {
    generatedComments = { english: [], hinglish: [] };
    lastSceneSummary = "";
    renderEmptyState("Comment generation failed. Check your API key, model quota, or internet connection.");
    showError(error.message || "Something went wrong while generating comments.");
  } finally {
    setLoading(false);
  }
}

function buildContext(contextText, topic) {
  const parts = [];
  if (contextText) {
    parts.push(contextText);
  }
  if (currentImageDescription) {
    parts.push(currentImageDescription);
  }
  if (topic) {
    parts.push(`Topic hint: ${topic}`);
  }
  return parts.join(". ");
}

function buildPrompt(imageContext, style, emoji, topic, quality, language, hasImage) {
  const styleInstruction =
    style === "sarcastic"
      ? "Make the comments clearly sarcastic, teasing, and irony-driven. They should sound like a smart roast, not plain jokes."
      : style === "dark"
        ? "Make the comments dark-humor style, but still safe. Use grim, savage, or emotionally damaged humor that matches the exact meme situation."
        : style === "wholesome"
          ? "Make the comments wholesome, warm, and feel-good while still matching the exact meme scene."
          : "Make the comments witty, clever, and sharp. They should feel like quick intelligent punchlines, not generic jokes.";

  const emojiInstruction =
    emoji === "light"
      ? "Add a light emoji touch to some comments."
      : emoji === "extra"
        ? "Add playful emojis in comments."
        : "Do not use emojis.";

  const qualityInstruction =
    quality === "short"
      ? "Keep each comment very short, 4 to 8 words."
      : quality === "edgy"
        ? "Make comments sharper and bolder, but avoid hate, abuse, or slurs."
        : "Keep comments natural and medium punchy, 8 to 14 words.";

  const topicInstruction = topic ? `Focus loosely on this topic: ${topic}.` : "";
  const imageInstruction = hasImage
    ? "Use the provided meme image as the primary source of meaning."
    : "No image is provided, so infer from text context only.";
  const languageInstruction =
    language === "english"
      ? "Return only English comments. Hinglish array must be empty."
      : language === "hinglish"
        ? "Return only Hinglish comments. English array must be empty."
        : "Return both English and Hinglish comments.";

  return `Generate bilingual meme comments for this image context: ${imageContext}.
${imageInstruction}
Tone: ${style}.
${styleInstruction}
${emojiInstruction}
${qualityInstruction}
${languageInstruction}
${topicInstruction}
Step 1: Analyze the image and infer the exact meme situation, emotion, and social context.
Step 2: Identify what is funny, painful, awkward, embarrassing, overdramatic, or relatable in THIS specific meme.
Step 3: Write relatable comments that match THIS exact meme scene.
Return ONLY valid JSON object in this exact format:
{"scene":"short scene understanding","english":["e1","e2","e3","e4","e5"],"hinglish":["h1","h2","h3","h4","h5"]}
Rules:
- English comments must be natural English.
- Hinglish comments must be natural Indian Hinglish in latin script.
- Each list must have 5 comments.
- Keep each comment under 16 words.
- Every comment must feel tied to the uploaded meme content, not usable on random memes.
- Use only details that can reasonably come from the uploaded image and the user's context.
- Do not write broad internet-style meme replies that could fit unrelated images.
- Mention the situation, emotion, behavior, or consequence shown in the meme.
- Avoid generic lines like "so true", "relatable", "same", "me every day", or filler reactions.
- Different comments should explore different angles of the same meme situation.
- No markdown or extra text.`;
}

async function fetchBilingualCommentsFromOpenRouter(prompt, apiKey, imageContent, style) {
  let response;
  try {
    response = await requestOpenRouter(prompt, apiKey, imageContent, OPENROUTER_MODEL);
  } catch (error) {
    const message = String(error.message || "").toLowerCase();
    const shouldRetry =
      message.includes("provider returned error") ||
      message.includes("no endpoints found") ||
      message.includes("temporarily unavailable");

    if (!shouldRetry) {
      throw error;
    }

    response = await requestOpenRouter(prompt, apiKey, imageContent, OPENROUTER_RETRY_MODEL);
  }

  const data = await response.json();
  const output = extractTextFromChoice(data?.choices?.[0]);
  let parsed = normalizeParsedComments(parseComments(output));

  if (
    (parsed.english.length || parsed.hinglish.length) &&
    (!commentsLookRelatable(parsed.scene, parsed.english, parsed.hinglish) || !commentsReadNaturally(parsed.english, parsed.hinglish))
  ) {
    const refined = await requestRelatableRewrite(apiKey, imageContent, parsed, style);
    if (refined.english.length || refined.hinglish.length) {
      parsed = normalizeParsedComments(refined);
    }
  }

  if (!parsed.english.length && !parsed.hinglish.length) {
    throw new Error("The API responded, but no comments were found.");
  }

  return parsed;
}

async function requestOpenRouter(prompt, apiKey, imageContent, model) {
  const userContent = [{ type: "text", text: prompt }];
  if (imageContent) {
    userContent.push(imageContent);
  }
  const siteOrigin = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost";

  let response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": siteOrigin,
        "X-Title": "AI Meme Comment Generator"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are an expert meme writer. Be highly scene-aware, style-accurate, and specific to the uploaded image. Never give generic meme comments."
          },
          {
            role: "user",
            content: userContent
          }
        ],
        temperature: 0.72,
        max_tokens: 420
      })
    });
  } catch (error) {
    throw new Error("Network request failed. Open the project with a local server (not file://) and try again.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractOpenRouterError(errorData));
  }

  return response;
}

async function requestRelatableRewrite(apiKey, imageContent, parsed, style) {
  const refinementPrompt = `You are rewriting meme comments to improve relatability and scene relevance.
Scene understanding: ${parsed.scene || "Unknown"}
Required tone: ${style}
English comments:
${parsed.english.map((comment, index) => `${index + 1}. ${comment}`).join("\n")}
Hinglish comments:
${parsed.hinglish.map((comment, index) => `${index + 1}. ${comment}`).join("\n")}

Return ONLY valid JSON object in this exact format:
{"scene":"short scene understanding","english":["e1","e2","e3","e4","e5"],"hinglish":["h1","h2","h3","h4","h5"]}
Rules:
- Keep both English and Hinglish natural and meme-specific.
- Make the comments strongly match the required tone: witty means clever, sarcastic means roast-like irony, dark means dark humor.
- No generic comments.
- Tie each comment to the exact meme situation, emotion, or visual joke.
- The comments must work for this uploaded meme only, not for random memes.
- Every comment must be complete and natural. No cut-off wording, no broken grammar, no missing words.
- Under 16 words each.
- No markdown or extra text.`;

  const response = await requestOpenRouter(refinementPrompt, apiKey, imageContent, OPENROUTER_RETRY_MODEL);
  const data = await response.json();
  const output = extractTextFromChoice(data?.choices?.[0]);
  return parseComments(output);
}

function parseComments(text) {
  const normalized = String(text || "").trim();
  let scene = "";

  if (!normalized) {
    return { scene, english: [], hinglish: [] };
  }

  const jsonCandidate = extractBestJsonCandidate(normalized);

  try {
    const parsed = JSON.parse(jsonCandidate);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      scene = typeof parsed.scene === "string" ? parsed.scene.trim() : "";
      const english = Array.isArray(parsed.english)
        ? parsed.english.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
        : [];
      const hinglish = Array.isArray(parsed.hinglish)
        ? parsed.hinglish.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
        : [];

      if (english.length || hinglish.length) {
        return { scene, english, hinglish };
      }

      if (Array.isArray(parsed.captions)) {
        return {
          scene,
          english: parsed.captions.map((item) => String(item).trim()).filter(Boolean).slice(0, 5),
          hinglish: []
        };
      }
    }

    if (Array.isArray(parsed)) {
      return {
        scene,
        english: parsed.map((item) => String(item).trim()).filter(Boolean).slice(0, 5),
        hinglish: []
      };
    }
  } catch (error) {
    // fall through
  }

  return {
    scene,
    english: normalized
      .split("\n")
      .map((line) => line.replace(/^\s*[\-\*\d]+[\).\s-]*/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 5),
    hinglish: []
  };
}

function normalizeParsedComments(parsed) {
  return {
    scene: String(parsed?.scene || "").trim(),
    english: (parsed?.english || []).map(cleanComment).filter(isUsableComment).slice(0, 5),
    hinglish: (parsed?.hinglish || []).map(cleanComment).filter(isUsableComment).slice(0, 5)
  };
}

function cleanComment(comment) {
  return String(comment || "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.,:;])/g, "$1")
    .trim();
}

function isUsableComment(comment) {
  if (!comment) {
    return false;
  }

  const words = comment.split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return false;
  }

  if (!hasBalancedWrapping(comment)) {
    return false;
  }

  if (/[,:;/-]$/.test(comment)) {
    return false;
  }

  return true;
}

function hasBalancedWrapping(text) {
  const pairs = [
    ['"', '"'],
    ["'", "'"],
    ["(", ")"],
    ["[", "]"]
  ];

  return pairs.every(([open, close]) => {
    const openCount = [...text].filter((char) => char === open).length;
    const closeCount = [...text].filter((char) => char === close).length;
    return openCount === closeCount;
  });
}

function extractBestJsonCandidate(text) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch && objectMatch[0]) {
    return objectMatch[0].trim();
  }

  return text;
}

function commentsLookRelatable(scene, english, hinglish) {
  const all = [...english, ...hinglish];
  if (!all.length) {
    return false;
  }

  const genericPatterns = [
    /same/i,
    /so true/i,
    /me everyday/i,
    /monday mood/i,
    /relatable/i,
    /lol/i,
    /literally me/i,
    /too real/i,
    /this is me/i,
    /can.t stop laughing/i
  ];
  const genericCount = all.filter((comment) => genericPatterns.some((pattern) => pattern.test(comment))).length;

  const sceneTokens = tokenizeMeaningful(scene);
  const commentTokens = tokenizeMeaningful(all.join(" "));
  const overlapCount = [...sceneTokens].filter((token) => commentTokens.has(token)).length;
  const averageLength = all.reduce((sum, comment) => sum + comment.split(/\s+/).filter(Boolean).length, 0) / all.length;
  const shortGenericCount = all.filter((comment) => comment.split(/\s+/).filter(Boolean).length <= 4).length;

  const hasVariety = new Set(all.map((comment) => comment.toLowerCase())).size >= 6;
  const acceptableGenericRatio = genericCount <= 2;
  const hasSceneAnchoring = overlapCount >= 2 || sceneTokens.size === 0;
  const hasEnoughSpecificity = averageLength >= 5 && shortGenericCount <= 2;

  return hasVariety && acceptableGenericRatio && hasSceneAnchoring && hasEnoughSpecificity;
}

function commentsReadNaturally(english, hinglish) {
  const all = [...english, ...hinglish];
  if (!all.length) {
    return false;
  }

  return all.every((comment) => {
    const words = comment.split(/\s+/).filter(Boolean);
    if (words.length < 4) {
      return false;
    }

    if (!hasBalancedWrapping(comment)) {
      return false;
    }

    if (/[,:;/-]$/.test(comment)) {
      return false;
    }

    if (/^[a-z0-9]+\s+[a-z0-9]+$/i.test(comment) && words.length <= 4) {
      return false;
    }

    return true;
  });
}

function tokenizeMeaningful(text) {
  const stopWords = new Set([
    "the", "and", "for", "that", "with", "this", "from", "have", "your", "just",
    "been", "into", "when", "then", "they", "them", "their", "about", "under",
    "very", "what", "where", "would", "could", "should", "being", "are", "you",
    "its", "it's", "our", "out", "all", "too", "one", "two", "was", "were", "his",
    "her", "she", "him", "who", "how", "why", "not", "but", "like"
  ]);

  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3 && !stopWords.has(token))
  );
}

function extractTextFromChoice(choice) {
  if (!choice) {
    return "";
  }

  const messageContent = choice.message?.content;
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  if (typeof messageContent === "string") {
    return messageContent.trim();
  }

  if (typeof choice.text === "string") {
    return choice.text.trim();
  }

  if (typeof choice.delta?.content === "string") {
    return choice.delta.content.trim();
  }

  return "";
}

function extractOpenRouterError(errorData) {
  const message = errorData?.error?.message || "OpenRouter request failed.";
  const providerMessage =
    errorData?.error?.metadata?.raw ||
    errorData?.error?.metadata?.provider_error ||
    "";

  return providerMessage ? `${message}: ${providerMessage}` : message;
}

async function normalizeUploadDataUrl(dataUrl) {
  try {
    return await convertDataUrlToPng(dataUrl);
  } catch (error) {
    return dataUrl;
  }
}

function convertDataUrlToPng(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas context not available."));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Image conversion failed."));
    image.src = dataUrl;
  });
}

function renderLoadingCards() {
  captionGrid.innerHTML = `
    <article class="empty-card">
      <h3>Cooking up comment-section chaos...</h3>
      <p>AI is reading the meme vibe, spotting the scene, and writing sharper reactions.</p>
    </article>
  `;
}

function renderEmptyState(message) {
  captionGrid.innerHTML = `
    <article class="empty-card">
      <h3>Your meme moment starts here</h3>
      <p>${message}</p>
    </article>
  `;
}

function renderCaptions(commentsByLanguage) {
  captionGrid.innerHTML = "";

  if (lastSceneSummary) {
    const contextCard = document.createElement("article");
    contextCard.className = "empty-card";
    contextCard.innerHTML = `
      <h3>Meme understanding</h3>
      <p>${escapeHtml(lastSceneSummary)}</p>
    `;
    captionGrid.appendChild(contextCard);
  }

  const mode = languageMode.value;
  if (mode === "both" || mode === "english") {
    renderLanguageCards("English", commentsByLanguage.english || []);
  }
  if (mode === "both" || mode === "hinglish") {
    renderLanguageCards("Hinglish", commentsByLanguage.hinglish || []);
  }
}

function renderLanguageCards(languageName, comments) {
  comments.forEach((comment, index) => {
    const card = document.createElement("article");
    card.className = "caption-card";
    card.style.animationDelay = `${index * 120}ms`;

    const top = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `${languageName} ${index + 1}`;

    const commentText = document.createElement("p");
    commentText.className = "caption-text";
    commentText.textContent = comment;

    const meta = document.createElement("p");
    meta.className = "caption-meta";
    meta.textContent = `${languageName} meme comment`;

    top.appendChild(title);
    top.appendChild(commentText);
    top.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "caption-actions";

    const favoriteBtn = document.createElement("button");
    favoriteBtn.className = "favorite-btn";
    favoriteBtn.type = "button";
    const favoriteId = buildFavoriteId(languageName, comment);
    favoriteBtn.textContent = favorites.has(favoriteId) ? "♥ Saved" : "♡ Save";
    favoriteBtn.addEventListener("click", () => {
      toggleFavorite(favoriteId);
      favoriteBtn.textContent = favorites.has(favoriteId) ? "♥ Saved" : "♡ Save";
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => copyCaption(comment));

    const saveBtn = document.createElement("button");
    saveBtn.className = "download-single-btn";
    saveBtn.type = "button";
    saveBtn.textContent = "Download";
    saveBtn.addEventListener("click", () => downloadSingleCaption(comment, `${languageName.toLowerCase()}-${index + 1}`));

    actions.appendChild(favoriteBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(saveBtn);
    card.appendChild(top);
    card.appendChild(actions);
    captionGrid.appendChild(card);
  });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

async function copyCaption(caption) {
  try {
    await navigator.clipboard.writeText(caption);
    showToast("Copied!");
  } catch (error) {
    showError("Clipboard access failed. Try running this project from a local server.");
  }
}

async function copyAllEnglish() {
  const english = generatedComments.english || [];
  if (!english.length) {
    showError("No English comments to copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(english.map((comment, index) => `${index + 1}. ${comment}`).join("\n"));
    showToast("All English comments copied");
  } catch (error) {
    showError("Copy all failed. Clipboard may be blocked.");
  }
}

async function copyAllHinglish() {
  const hinglish = generatedComments.hinglish || [];
  if (!hinglish.length) {
    showError("No Hinglish comments to copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(hinglish.map((comment, index) => `${index + 1}. ${comment}`).join("\n"));
    showToast("All Hinglish comments copied");
  } catch (error) {
    showError("Copy all failed. Clipboard may be blocked.");
  }
}

function downloadSingleCaption(caption, id) {
  downloadTextFile(`meme-comment-${id}.txt`, caption);
  showToast(`Comment ${id} downloaded`);
}

function downloadCaptions() {
  const english = generatedComments.english || [];
  const hinglish = generatedComments.hinglish || [];

  if (!english.length && !hinglish.length) {
    showError("Generate comments first before downloading.");
    return;
  }

  const englishBlock = english.map((comment, index) => `${index + 1}. ${comment}`).join("\n");
  const hinglishBlock = hinglish.map((comment, index) => `${index + 1}. ${comment}`).join("\n");
  const text = `Scene understanding:\n${lastSceneSummary || "N/A"}\n\nEnglish comments:\n${englishBlock || "N/A"}\n\nHinglish comments:\n${hinglishBlock || "N/A"}`;
  downloadTextFile("meme-comments-bilingual.txt", text);
  showToast("All bilingual comments downloaded");
}

function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function setLoading(isLoading) {
  loadingState.classList.toggle("hidden", !isLoading);
  generateBtn.disabled = isLoading;
  regenerateBtn.disabled = isLoading;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove("hidden");
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 1800);
}

function buildFavoriteId(languageName, comment) {
  return `${languageName.toLowerCase()}::${comment.trim()}`;
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem("meme_favorites");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem("meme_favorites", JSON.stringify([...favorites]));
}

function toggleFavorite(favoriteId) {
  if (favorites.has(favoriteId)) {
    favorites.delete(favoriteId);
    showToast("Removed from favorites");
  } else {
    favorites.add(favoriteId);
    showToast("Saved to favorites");
  }
  saveFavorites();
}

const savedKey = localStorage.getItem("meme_api_key");
if (savedKey && apiKeyInput && rememberKey) {
  apiKeyInput.value = savedKey;
  rememberKey.checked = true;
}
