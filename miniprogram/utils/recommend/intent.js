/**
 * 需求结构化：标签 / 关键词 → Intent JSON
 */

const { getStrategy } = require("./strategies.js");

const KEYWORD_MAP = {
  easy: ["简单", "省事", "不想花时间", "懒得搭", "好搭"],
  energy: ["元气", "活泼", "精神", "甜", "街头", "周末", "轻快"],
  lowkey: ["低调", "高级", "静音", "极简", "干净", "不张扬"],
  slim: ["显瘦", "显得瘦", "不要显胖", "利落", "修身", "线条"],
  formal: ["正式", "商务", "开会", "见客户", "会议"],
  casual: ["休闲", "轻松", "随意"],
  skirt: ["裙", "裙装", "连衣裙"],
  pants: ["裤", "裤装", "西裤", "牛仔裤"],
  avoid_skirt: ["不要裙", "不穿裙", "别穿裙"],
};

/** 颜色词：长词优先；仅颜色时 replyLabel 用颜色名，不落成「省事」 */
const COLOR_RULES = [
  { keys: ["米白色", "米白", "米色", "奶油色", "奶油"], label: "米色", family: "light", tokens: ["米", "奶油", "杏"] },
  { keys: ["白色", "纯白", "乳白"], label: "白色", family: "light", tokens: ["白"] },
  { keys: ["浅色", "淡色"], label: "浅色", family: "light", tokens: ["浅", "白", "米"] },
  { keys: ["黑色", "纯黑"], label: "黑色", family: "dark", tokens: ["黑"] },
  { keys: ["深色", "暗色"], label: "深色", family: "dark", tokens: ["深", "黑", "炭", "咖"] },
  { keys: ["灰色", "深灰", "浅灰"], label: "灰色", family: "mid", tokens: ["灰"] },
  { keys: ["蓝色", "深蓝", "浅蓝", "牛仔蓝"], label: "蓝色", family: "denim", tokens: ["蓝", "牛仔"] },
  { keys: ["粉色", "藕粉"], label: "粉色", family: "light", tokens: ["粉"] },
  { keys: ["驼色", "卡其", "棕色", "咖色"], label: "驼色", family: "mid", tokens: ["驼", "卡其", "棕", "咖"] },
  { keys: ["砖红", "红色"], label: "红色", family: "mid", tokens: ["红", "砖红"] },
];

function detectHits(text, keys) {
  const t = text || "";
  return keys.filter((k) => t.indexOf(k) >= 0);
}

function detectColor(text) {
  const t = text || "";
  for (let i = 0; i < COLOR_RULES.length; i += 1) {
    const rule = COLOR_RULES[i];
    if (detectHits(t, rule.keys).length) return rule;
  }
  // 单字兜底（整句很短时）
  if (t === "白" || t === "黑" || t === "灰" || t === "蓝" || t === "粉") {
    return COLOR_RULES.find((r) => r.tokens.indexOf(t) >= 0) || null;
  }
  return null;
}

function parseUserText(text) {
  const t = (text || "").trim();
  if (!t) return {};

  let strategyId = null;
  ["easy", "energy", "lowkey", "slim"].forEach((id) => {
    if (detectHits(t, KEYWORD_MAP[id]).length && !strategyId) strategyId = id;
  });

  const styles = [];
  const avoid = [];
  let scene = null;
  let formality = null;
  let prefer_light = null;
  let prefer_dark = null;
  let bottom_pref = null;
  let replyLabel = null;
  let colorFocus = null;

  if (detectHits(t, KEYWORD_MAP.formal).length) {
    scene = "business";
    formality = "medium_high";
    styles.push("smart", "minimal");
    if (!strategyId) strategyId = "lowkey";
    replyLabel = "正式";
  }
  if (detectHits(t, KEYWORD_MAP.casual).length) {
    scene = scene || "daily";
    formality = formality || "low";
    styles.push("casual", "energetic");
    if (!strategyId) strategyId = "energy";
    if (!replyLabel) replyLabel = "休闲";
  }

  const color = detectColor(t);
  if (color) {
    colorFocus = {
      label: color.label,
      family: color.family,
      tokens: color.tokens || [],
    };
    if (color.family === "light") prefer_light = true;
    if (color.family === "dark") prefer_dark = true;
    // 只有颜色、没有风格策略时：文案用颜色，不沿用「省事」
    if (!replyLabel) replyLabel = color.label;
  }

  if (detectHits(t, KEYWORD_MAP.skirt).length) bottom_pref = "skirts";
  if (detectHits(t, KEYWORD_MAP.pants).length) bottom_pref = "pants";
  if (detectHits(t, KEYWORD_MAP.avoid_skirt).length) {
    avoid.push("skirts");
    bottom_pref = "pants";
  }
  if (/不要太正式|别太正式|不太严肃/.test(t)) {
    formality = "medium";
    avoid.push("too_formal");
    if (!replyLabel) replyLabel = "轻松正式";
  }

  return {
    strategyId,
    scene,
    styles,
    formality,
    prefer_light,
    prefer_dark,
    bottom_pref,
    avoid,
    replyLabel,
    colorFocus,
    rawText: t,
  };
}

/**
 * @param {object} options
 * @param {string} [options.themeId]
 * @param {string} [options.userText]
 * @param {object} [options.profile]
 * @param {object} [options.weather]
 */
function buildIntent(options) {
  const parsed = parseUserText(options.userText || "");
  const strategyId = parsed.strategyId || options.themeId || "easy";
  const strategy = getStrategy(strategyId);
  const defaults = strategy.intentDefaults || {};
  const profile = options.profile || {};
  const weather = options.weather || {};

  const styles = Array.from(
    new Set([].concat(defaults.styles || [], parsed.styles || [], profile.styles || []))
  ).slice(0, 8);

  const scenes = Array.from(
    new Set(
      []
        .concat(parsed.scene ? [parsed.scene] : [])
        .concat(defaults.scene ? [defaults.scene] : [])
        .concat(profile.scenes || [])
    )
  );

  const temp = weather.temp != null ? Number(weather.temp) : 22;
  const rainy = !!weather.rainy || /雨/.test(weather.condition || "");

  // 颜色意图时抬高 color 权重
  let weights = { ...strategy.weights };
  if (parsed.colorFocus) {
    weights = {
      ...weights,
      color: Math.max(weights.color || 10, 28),
      style: Math.max(8, (weights.style || 15) - 6),
    };
  }

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    // 仅解析出明确标签/颜色时对外展示；避免闲聊却套上当前策略名
    replyLabel: parsed.replyLabel || null,
    scene: scenes[0] || "daily",
    scenes,
    styles,
    operation_cost: defaults.operation_cost || "medium",
    color_complexity: defaults.color_complexity || "medium",
    prefer_light:
      parsed.prefer_light != null ? parsed.prefer_light : !!defaults.prefer_light,
    prefer_dark:
      parsed.prefer_dark != null ? parsed.prefer_dark : !!defaults.prefer_dark,
    colorFocus: parsed.colorFocus || null,
    body_effect: defaults.body_effect || [],
    item_count_max: defaults.item_count_max || 4,
    formality: parsed.formality || null,
    bottom_pref: parsed.bottom_pref || null,
    avoid: parsed.avoid || [],
    temp: Number.isNaN(temp) ? 22 : temp,
    condition: weather.condition || "",
    rainy,
    tempLabel:
      weather.temp != null
        ? `${weather.temp}°C ${weather.condition || ""}`.trim()
        : "适温",
    rawText: parsed.rawText || "",
    weights,
    constraints: strategy.constraints,
  };
}

module.exports = {
  buildIntent,
  parseUserText,
  detectColor,
  KEYWORD_MAP,
  COLOR_RULES,
};
