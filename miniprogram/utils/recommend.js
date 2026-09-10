/**
 * 一期推荐：仅使用用户真实衣橱，规则匹配槽位
 */

const THEME_META = {
  easy: { name: "省事", styles: ["省事", "极简", "运动"], preferLight: true },
  energy: { name: "元气", styles: ["甜美", "街头", "运动"], preferLight: true },
  lowkey: { name: "低调", styles: ["低调", "极简", "暗黑"], preferDark: true },
  slim: { name: "显瘦", styles: ["显瘦", "低调", "通勤"], preferDark: true },
};

const OUTFIT_TITLES = {
  easy: ["一键出门款", "少想多穿", "通勤省事套"],
  energy: ["元气拉满", "轻快出行", "周末好心情"],
  lowkey: ["低调干净", "不费力高级感", "静音穿搭"],
  slim: ["线条利落", "显瘦日常", "收身有型"],
};

const SLOT_LABEL = {
  tops: "上装",
  pants: "裤装",
  skirts: "裙装",
  coats: "外套",
  shoes: "鞋履",
  accessories: "配饰",
};

function climateBand(temp) {
  const t = Number(temp);
  if (Number.isNaN(t)) return "mild";
  if (t >= 28) return "hot";
  if (t >= 20) return "warm";
  if (t >= 12) return "mild";
  if (t >= 5) return "cool";
  return "cold";
}

function seasonForBand(band) {
  if (band === "hot" || band === "warm") return "夏";
  if (band === "mild") return "春";
  if (band === "cool") return "秋";
  return "冬";
}

function needCoat(band, rainy) {
  if (band === "hot") return rainy;
  if (band === "warm") return rainy;
  return true;
}

function preferredWeights(band) {
  if (band === "hot") return ["light"];
  if (band === "warm") return ["light", "mid"];
  if (band === "mild") return ["light", "mid"];
  if (band === "cool") return ["mid", "heavy"];
  return ["heavy", "mid"];
}

function guessWeight(item) {
  if (item.weight) return item.weight;
  const name = `${item.name || ""}${item.category || ""}`;
  if (/羽绒|大衣|厚|毛衣|靴/.test(name)) return "heavy";
  if (/短袖|短裤|背心|凉鞋|裙/.test(name)) return "light";
  return "mid";
}

function normalizeItem(raw) {
  return {
    id: raw.id || raw._id || `x_${Math.random().toString(36).slice(2, 8)}`,
    name: raw.name || "单品",
    category: raw.category || "tops",
    color: raw.color || "#F5E8D8",
    colorName: raw.colorName || "",
    brand: raw.brand || "",
    season: raw.season || [],
    styles: raw.styles || [],
    weight: guessWeight(raw),
    rainy: !!raw.rainy,
    worn: raw.worn || 0,
    real: true,
    image: raw.image || "",
  };
}

function scoreItem(item, ctx) {
  let score = 10;
  const { band, rainy, themeId, profileStyles, profileScenes, usedIds } = ctx;
  const theme = THEME_META[themeId] || THEME_META.easy;
  const weights = preferredWeights(band);
  const season = seasonForBand(band);

  if (usedIds[item.id]) score -= 80;

  if (item.season && item.season.length) {
    if (item.season.indexOf(season) >= 0) score += 10;
    else score -= 8;
  }

  if (weights.indexOf(item.weight || "mid") >= 0) score += 8;
  else score -= 4;

  if (rainy && item.rainy) score += 12;
  if (rainy && item.category === "shoes" && /白|米|浅/.test(item.colorName || item.name)) {
    score -= 6;
  }

  const styleHit = (item.styles || []).some(
    (s) =>
      (theme.styles || []).indexOf(s) >= 0 ||
      (profileStyles || []).indexOf(s) >= 0 ||
      (profileScenes || []).indexOf(s) >= 0
  );
  if (styleHit) score += 10;

  if (theme.preferDark && /黑|灰|炭|深蓝|咖/.test(`${item.colorName}${item.name}${item.color}`)) {
    score += 6;
  }
  if (theme.preferLight && /白|米|奶油|浅|粉/.test(`${item.colorName}${item.name}`)) {
    score += 5;
  }

  if ((item.worn || 0) === 0) score += 4;
  if ((item.worn || 0) > 8) score -= 3;

  score += Math.floor(Math.random() * 5);
  return score;
}

function pickBest(candidates, ctx) {
  if (!candidates.length) return null;
  let best = null;
  let bestScore = -Infinity;
  candidates.forEach((item) => {
    const s = scoreItem(item, ctx);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  });
  return best;
}

function byCategory(pool, category) {
  return pool.filter((i) => i.category === category);
}

function buildReason(ctx, pieces, coat) {
  const t = ctx.temp;
  const themeName = (THEME_META[ctx.themeId] || THEME_META.easy).name;
  const names = pieces.map((p) => p.name);
  const parts = [];

  if (ctx.rainy) parts.push(`今早约 ${t}°C 有雨`);
  else parts.push(`今早约 ${t}°C ${ctx.condition || ""}`.trim());

  if (coat) parts.push(ctx.rainy ? "建议带外套防雨" : "建议加一层外套");
  else if (ctx.band === "hot") parts.push("轻薄透气即可");

  parts.push(`主题「${themeName}」`);
  if (names.length) parts.push(`使用 ${names.slice(0, 3).join("、")}`);

  return parts.join(" · ");
}

function buildOneOutfit(pool, ctx, variant) {
  const usedIds = { ...ctx.usedIds };
  const localCtx = { ...ctx, usedIds };

  const tops = byCategory(pool, "tops");
  const bottoms = byCategory(pool, "pants").concat(byCategory(pool, "skirts"));
  const shoes = byCategory(pool, "shoes");
  const coats = byCategory(pool, "coats");

  let bottomPool = bottoms;
  if (variant === 2) {
    const skirts = byCategory(pool, "skirts");
    if (skirts.length) bottomPool = skirts.concat(byCategory(pool, "pants"));
  }

  const top = pickBest(tops, localCtx);
  if (top) usedIds[top.id] = true;
  localCtx.usedIds = usedIds;

  const bottom = pickBest(
    bottomPool.filter((i) => !usedIds[i.id]),
    localCtx
  );
  if (bottom) usedIds[bottom.id] = true;
  localCtx.usedIds = usedIds;

  const shoe = pickBest(
    shoes.filter((i) => !usedIds[i.id]),
    localCtx
  );
  if (shoe) usedIds[shoe.id] = true;
  localCtx.usedIds = usedIds;

  let coat = null;
  if (needCoat(ctx.band, ctx.rainy)) {
    coat = pickBest(
      coats.filter((i) => !usedIds[i.id]),
      localCtx
    );
    if (coat) usedIds[coat.id] = true;
  }

  const pieces = [top, bottom, shoe, coat].filter(Boolean);
  // 至少上装+下装，或任意 2 件才能成套
  if (pieces.length < 2) return null;
  if (!top || !bottom) return null;

  const pieceCards = pieces.map((p) => ({
    id: p.id,
    name: p.name,
    image: p.image || "",
    color: p.color || "#F5E8D8",
    real: true,
    slot: SLOT_LABEL[p.category] || "单品",
  }));

  const themeId = ctx.themeId || "easy";
  const titles = OUTFIT_TITLES[themeId] || OUTFIT_TITLES.easy;
  const title = titles[variant % titles.length];

  const tags = [];
  if (ctx.profileScenes && ctx.profileScenes[0]) tags.push(ctx.profileScenes[0]);
  if (ctx.profileScenes && ctx.profileScenes[1]) tags.push(ctx.profileScenes[1]);
  if (!tags.length) {
    tags.push(THEME_META[themeId]?.name || "日常");
    tags.push(ctx.rainy ? "防雨" : "适温");
  }

  const cover = pieces.find((p) => p.image)?.image || "";

  return {
    id: `rec_${themeId}_${variant}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    subtitle: variant === 0 ? "今日主推荐" : "备选方案",
    temp: ctx.tempLabel || "",
    reason: buildReason(ctx, pieces, coat),
    items: pieces.map((p) => p.name),
    pieces: pieceCards,
    tags: tags.slice(0, 2),
    liked: false,
    image: cover,
    realCount: pieces.length,
    totalSlots: pieces.length,
    real: true,
  };
}

function missingHint(pool) {
  const hasTop = byCategory(pool, "tops").length > 0;
  const hasBottom =
    byCategory(pool, "pants").length + byCategory(pool, "skirts").length > 0;
  const hasShoe = byCategory(pool, "shoes").length > 0;
  const miss = [];
  if (!hasTop) miss.push("上装");
  if (!hasBottom) miss.push("下装");
  if (!hasShoe) miss.push("鞋履");
  if (!pool.length) {
    return {
      emptyTip: "衣橱还是空的",
      emptySub: "先去添加几件常穿衣物，就能生成今日穿搭。",
    };
  }
  if (miss.length) {
    return {
      emptyTip: "单品品类还不够",
      emptySub: `再补一些${miss.join("、")}，推荐就能成套。`,
    };
  }
  return {
    emptyTip: "暂时凑不出新搭配",
    emptySub: "多入库几件不同品类，或换个主题再试。",
  };
}

/**
 * @param {object} options
 */
function buildOutfits(options) {
  const weather = options.weather || {};
  const themeId = options.themeId || "easy";
  const profile = options.profile || {};
  const count = options.count || 2;
  const temp = weather.temp != null ? weather.temp : 22;
  const rainy = !!weather.rainy || /雨/.test(weather.condition || "");
  const band = climateBand(temp);
  const pool = (options.clothes || []).map(normalizeItem);
  const wardrobeReal = pool.length;

  const ctx = {
    band,
    rainy,
    temp: Math.round(Number(temp) || 22),
    condition: weather.condition || "",
    tempLabel: weather.temp != null ? `${weather.temp}°C ${weather.condition || ""}` : "适温",
    themeId,
    profileStyles: profile.styles || [],
    profileScenes: profile.scenes || [],
    usedIds: {},
  };

  const outfits = [];
  for (let i = 0; i < count; i += 1) {
    const outfit = buildOneOutfit(pool, ctx, i);
    if (!outfit) break;
    outfits.push(outfit);
    (outfit.pieces || []).forEach((p) => {
      if (p && p.id) ctx.usedIds[p.id] = true;
    });
  }

  const empty = outfits.length === 0;
  const hint = empty ? missingHint(pool) : { emptyTip: "", emptySub: "" };

  return {
    outfits,
    empty,
    emptyTip: hint.emptyTip,
    emptySub: hint.emptySub,
    realRatio: `${wardrobeReal}`,
    band,
    rainy,
  };
}

module.exports = {
  buildOutfits,
  climateBand,
};
