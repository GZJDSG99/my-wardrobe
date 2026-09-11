/**
 * 多维评分（软规则）
 */

const { inTempRange, styleHit, sceneHit } = require("./recall.js");
const { climateBand } = require("./enrich.js");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function scoreWeather(pieces, intent) {
  const tol = (intent.constraints && intent.constraints.temperature_tolerance) || 3;
  const scores = pieces.map((p) => {
    if (inTempRange(p, intent.temp, tol)) return 95;
    if (inTempRange(p, intent.temp, tol + 4)) return 70;
    return 35;
  });
  let s = avg(scores);
  if (intent.rainy) {
    const hasCoat = pieces.some((p) => p.category === "coats");
    s += hasCoat ? 5 : -8;
  }
  const band = climateBand(intent.temp);
  if (band === "hot" && pieces.every((p) => p.weight !== "heavy")) s += 4;
  return clamp(s, 0, 100);
}

function scoreScene(pieces, intent) {
  const scenes = intent.scenes || [intent.scene];
  const hits = pieces.filter((p) => sceneHit(p, scenes)).length;
  let s = 55 + (hits / Math.max(1, pieces.length)) * 40;
  if (intent.formality === "medium_high") {
    const form = avg(pieces.map((p) => p.formality || 2));
    s += form >= 3 ? 10 : -12;
  }
  if ((intent.avoid || []).indexOf("too_formal") >= 0) {
    const form = avg(pieces.map((p) => p.formality || 2));
    if (form >= 4.2) s -= 15;
  }
  return clamp(s, 0, 100);
}

function scoreStyle(pieces, intent) {
  const hits = pieces.filter((p) => styleHit(p, intent.styles)).length;
  let s = 50 + (hits / Math.max(1, pieces.length)) * 45;
  if ((intent.body_effect || []).length) {
    const bodyHits = pieces.filter((p) =>
      (intent.body_effect || []).some((e) => (p.body_effect || []).indexOf(e) >= 0)
    ).length;
    s += bodyHits * 6;
  }
  return clamp(s, 0, 100);
}

function scorePreference(pieces, preference) {
  const pref = preference || { colors: {}, categories: {}, styles: {} };
  let s = 70;
  pieces.forEach((p) => {
    s += (pref.colors[p.color_family] || 0) * 25;
    s += (pref.categories[p.category] || 0) * 20;
  });
  return clamp(s, 0, 100);
}

function scoreColor(pieces, intent) {
  const families = Array.from(
    new Set(pieces.map((p) => p.color_family).filter(Boolean))
  );
  let s = 88;
  if (families.length === 1) s = 92;
  if (families.length === 2) s = 90;
  if (families.length >= 4) s = 55;
  if (intent.prefer_light) {
    const lightRatio =
      pieces.filter((p) => p.color_family === "light").length / pieces.length;
    s += lightRatio * 12;
  }
  if (intent.prefer_dark) {
    const darkRatio =
      pieces.filter((p) => p.color_family === "dark").length / pieces.length;
    s += darkRatio * 12;
  }

  const focus = intent.colorFocus;
  if (focus) {
    const tokens = focus.tokens || [];
    const hit = pieces.filter((p) => {
      const bag = `${p.colorName || ""}${p.name || ""}${p.color_family || ""}`;
      if (focus.family && p.color_family === focus.family) return true;
      return tokens.some((tk) => bag.indexOf(tk) >= 0);
    }).length;
    const ratio = hit / Math.max(1, pieces.length);
    s = s * 0.45 + (40 + ratio * 60) * 0.55;
  }

  const hasLightDark =
    families.indexOf("light") >= 0 && families.indexOf("dark") >= 0;
  if (hasLightDark && !focus) s += 4;
  return clamp(s, 0, 100);
}

function scoreCompleteness(pieces) {
  const hasTop = pieces.some((p) => p.category === "tops");
  const hasBottom = pieces.some(
    (p) => p.category === "pants" || p.category === "skirts"
  );
  const hasShoe = pieces.some((p) => p.category === "shoes");
  const hasCoat = pieces.some((p) => p.category === "coats");
  let s = 40;
  if (hasTop && hasBottom) s = 75;
  if (hasShoe) s += 15;
  if (hasCoat) s += 10;
  return clamp(s, 0, 100);
}

function scoreNovelty(pieces, preference) {
  const seen = (preference && preference.seenOutfitKeys) || [];
  const key = pieces
    .map((p) => p.id)
    .sort()
    .join("|");
  if (seen.indexOf(key) >= 0) return 25;
  const avgWorn = avg(pieces.map((p) => p.worn || 0));
  if (avgWorn === 0) return 95;
  if (avgWorn < 2) return 80;
  if (avgWorn < 5) return 65;
  return 45;
}

function scoreDifficulty(pieces, intent) {
  const avgDiff = avg(pieces.map((p) => p.difficulty || 2));
  // 难度越低分越高（省事）
  let s = 100 - (avgDiff - 1) * 28;
  if (intent.operation_cost === "low") {
    s += avgDiff <= 1.5 ? 8 : -10;
  }
  return clamp(s, 0, 100);
}

function scoreOutfit(outfit, intent, preference) {
  const pieces = outfit.pieces || [];
  const w = intent.weights || {};
  const dims = {
    weather: scoreWeather(pieces, intent),
    scene: scoreScene(pieces, intent),
    style: scoreStyle(pieces, intent),
    preference: scorePreference(pieces, preference),
    color: scoreColor(pieces, intent),
    completeness: scoreCompleteness(pieces),
    novelty: scoreNovelty(pieces, preference),
    difficulty: scoreDifficulty(pieces, intent),
  };

  let totalW = 0;
  let sum = 0;
  Object.keys(dims).forEach((k) => {
    const wk = Number(w[k] != null ? w[k] : 0);
    totalW += wk;
    sum += dims[k] * wk;
  });
  const score = totalW ? sum / totalW : 0;

  return {
    ...outfit,
    score: Math.round(score * 10) / 10,
    scoreDims: dims,
  };
}

module.exports = {
  scoreOutfit,
};
