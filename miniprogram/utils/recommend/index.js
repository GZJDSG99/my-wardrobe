/**
 * 规则引擎入口：Intent → 召回 → 组合 → 硬过滤 → 评分 → 多样性 TopN
 */

const { buildIntent } = require("./intent.js");
const { enrichClothes, climateBand, SLOT_LABEL } = require("./enrich.js");
const { recallCandidates } = require("./recall.js");
const { generateOutfits } = require("./combine.js");
const { filterOutfits } = require("./rules.js");
const { scoreOutfit } = require("./score.js");
const { diversifySelect } = require("./rank.js");
const { readPref, markSeen } = require("./preference.js");
const { getStrategy } = require("./strategies.js");

const OUTFIT_TITLES = {
  easy: ["一键出门款", "少想多穿", "通勤省事套"],
  energy: ["元气拉满", "轻快出行", "周末好心情"],
  lowkey: ["低调干净", "不费力高级感", "静音穿搭"],
  slim: ["线条利落", "显瘦日常", "收身有型"],
};

function missingHint(pool) {
  const hasTop = pool.some((i) => i.category === "tops");
  const hasBottom = pool.some(
    (i) => i.category === "pants" || i.category === "skirts"
  );
  const hasShoe = pool.some((i) => i.category === "shoes");
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

function buildReason(intent, scored) {
  const dims = scored.scoreDims || {};
  const parts = [];
  parts.push(`${intent.tempLabel || intent.temp + "°C"}`.trim());
  if (intent.scene === "business") parts.push("偏正式");
  else if (intent.scene === "commute") parts.push("通勤");
  else parts.push("日常");
  parts.push(intent.replyLabel || intent.strategyName || "推荐");

  const why = [];
  if (dims.weather >= 85) why.push("气温匹配好");
  if (intent.colorFocus) why.push(`优先${intent.colorFocus.label}`);
  else if (dims.color >= 85 && intent.prefer_light) why.push("浅色更干净");
  else if (dims.color >= 85 && intent.prefer_dark) why.push("深色更利落");
  if (dims.difficulty >= 85) why.push("好搭省事");
  if (dims.style >= 80) why.push("风格贴近你的偏好");
  if (dims.novelty >= 80) why.push("最近较少穿到");

  const head = parts.filter(Boolean).join(" · ");
  if (why.length) return `${head}。${why.slice(0, 2).join("，")}。`;
  return `${head}。综合天气、场景与衣橱匹配选出。`;
}

function toCard(scored, intent, index) {
  const pieces = scored.pieces || [];
  const titles = OUTFIT_TITLES[intent.strategyId] || OUTFIT_TITLES.easy;
  const pieceCards = pieces.map((p) => ({
    id: p.id,
    name: p.name,
    image: p.image || "",
    color: p.color || "#F5E8D8",
    color_family: p.color_family,
    category: p.category,
    real: true,
    slot: p.slot || SLOT_LABEL[p.category] || "单品",
  }));

  const tags = [];
  tags.push(intent.replyLabel || intent.strategyName || "推荐");
  if (intent.scene === "business") tags.push("偏正式");
  else if (intent.scenes && intent.scenes[0] === "commute") tags.push("通勤");
  else tags.push("日常");
  if (intent.rainy) tags.push("防雨");

  const coverItem = pieces.find((p) => p.image);
  return {
    id: `rec_${intent.strategyId}_${index}_${scored.dedupeKey.slice(0, 12)}`,
    dedupeKey: scored.dedupeKey,
    title: titles[index % titles.length],
    subtitle: index === 0 ? "今日主推荐" : "备选方案",
    temp: intent.tempLabel || "",
    reason: buildReason(intent, scored),
    items: pieces.map((p) => p.name),
    pieces: pieceCards,
    tags: tags.slice(0, 3),
    liked: false,
    image: (coverItem && coverItem.image) || "",
    realCount: pieces.length,
    totalSlots: pieces.length,
    real: true,
    score: scored.finalScore != null ? scored.finalScore : scored.score,
    scoreDims: scored.scoreDims,
  };
}

/**
 * @param {object} options
 * @param {object} [options.weather]
 * @param {string} [options.themeId]
 * @param {string} [options.userText]
 * @param {object} [options.profile]
 * @param {array}  [options.clothes]
 * @param {number} [options.count]
 * @param {boolean} [options.excludeSeen] 换一批时排除已看
 * @param {boolean} [options.markAsSeen]
 */
function buildOutfits(options) {
  const count = options.count || 3;
  const intent = buildIntent({
    themeId: options.themeId,
    userText: options.userText,
    profile: options.profile,
    weather: options.weather,
  });

  const pool = enrichClothes(options.clothes || []);
  const wardrobeReal = pool.length;
  const preference = readPref();

  if (!pool.length) {
    const hint = missingHint(pool);
    return {
      outfits: [],
      empty: true,
      emptyTip: hint.emptyTip,
      emptySub: hint.emptySub,
      realRatio: "0",
      band: climateBand(intent.temp),
      rainy: intent.rainy,
      intent,
    };
  }

  const recalled = recallCandidates(pool, intent, preference);
  let combos = generateOutfits(recalled, intent, 48);
  combos = filterOutfits(combos, intent);

  // 若过滤过严，用全库再试一轮组合
  if (combos.length < count) {
    const more = filterOutfits(generateOutfits(pool, intent, 48), intent);
    const seen = {};
    combos.forEach((c) => {
      seen[c.dedupeKey] = true;
    });
    more.forEach((c) => {
      if (!seen[c.dedupeKey]) combos.push(c);
    });
  }

  const scored = combos.map((o) => scoreOutfit(o, intent, preference));
  const excludeKeys = options.excludeSeen ? preference.seenOutfitKeys || [] : [];
  let selected = diversifySelect(scored, count, excludeKeys);

  // 排除后不够则清空已看再取
  if (selected.length < count && excludeKeys.length) {
    selected = diversifySelect(scored, count, []);
  }

  const outfits = selected.map((o, i) => toCard(o, intent, i));

  if (options.markAsSeen !== false && outfits.length) {
    markSeen(outfits.map((o) => o.dedupeKey));
  }

  const empty = outfits.length === 0;
  const hint = empty ? missingHint(pool) : { emptyTip: "", emptySub: "" };

  return {
    outfits,
    empty,
    emptyTip: hint.emptyTip,
    emptySub: hint.emptySub,
    realRatio: `${wardrobeReal}`,
    band: climateBand(intent.temp),
    rainy: intent.rainy,
    intent,
  };
}

module.exports = {
  buildOutfits,
  buildIntent,
  climateBand,
  getStrategy,
  SLOT_LABEL,
  applyOutfitFeedback: require("./preference.js").applyOutfitFeedback,
  clearSeen: require("./preference.js").clearSeen,
};
