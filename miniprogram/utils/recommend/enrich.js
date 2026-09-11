/**
 * 衣橱单品结构化增强（缺字段时用名称/颜色推断）
 */

const SLOT_LABEL = {
  tops: "上装",
  pants: "裤装",
  skirts: "裙装",
  coats: "外套",
  shoes: "鞋履",
  accessories: "配饰",
};

const STYLE_CN_MAP = {
  省事: "simple",
  极简: "minimal",
  复古: "vintage",
  法式: "french",
  甜美: "sweet",
  街头: "street",
  运动: "sport",
  低调: "lowkey",
  显瘦: "slim",
  通勤: "commute",
  暗黑: "dark",
};

const SCENE_CN_MAP = {
  通勤: "commute",
  约会: "date",
  日常: "daily",
  商务: "business",
  周末: "weekend",
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

function hexLuminance(hex) {
  if (!hex || typeof hex !== "string") return 0.6;
  const m = hex.replace("#", "");
  if (m.length !== 6) return 0.6;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorFamily(item) {
  const name = `${item.colorName || ""}${item.name || ""}`;
  const lum = hexLuminance(item.color);
  if (/黑|炭|深灰|深蓝|咖|棕/.test(name) || lum < 0.28) return "dark";
  if (/白|米|奶油|浅|粉|杏|裸/.test(name) || lum > 0.72) return "light";
  if (/牛仔|蓝/.test(name)) return "denim";
  return "mid";
}

function guessWeight(item) {
  if (item.weight) return item.weight;
  const name = `${item.name || ""}${item.category || ""}`;
  if (/羽绒|大衣|厚|毛衣|靴|呢/.test(name)) return "heavy";
  if (/短袖|短裤|背心|凉鞋|裙|薄|雪纺/.test(name)) return "light";
  return "mid";
}

function tempRangeForWeight(weight, category) {
  if (category === "coats") {
    if (weight === "heavy") return { min: -5, max: 15 };
    if (weight === "light") return { min: 12, max: 26 };
    return { min: 5, max: 20 };
  }
  if (weight === "heavy") return { min: -5, max: 16 };
  if (weight === "light") return { min: 18, max: 36 };
  return { min: 10, max: 26 };
}

function guessFormality(item) {
  const name = item.name || "";
  if (/西装|衬衫|西裤|乐福|皮鞋|正装/.test(name)) return 4;
  if (/拖鞋|运动|卫衣|破洞|沙滩/.test(name)) return 1;
  if (/针织|直筒|大衣|风衣/.test(name)) return 3;
  return 2;
}

function guessDifficulty(item) {
  const name = item.name || "";
  if (/碎花|亮片|印花|蕾丝|撞色/.test(name)) return 3;
  if (/白|黑|灰|米|直筒|基础|纯色/.test(name)) return 1;
  return 2;
}

function guessBodyEffect(item) {
  const name = item.name || "";
  const effects = [];
  if (/直筒|高腰|修身|显瘦|窄/.test(name)) effects.push("slim", "vertical");
  if (/宽松|oversize|廓形/.test(name)) effects.push("loose");
  return effects;
}

function mapStyleList(list) {
  const out = [];
  (list || []).forEach((s) => {
    if (!s) return;
    const mapped = STYLE_CN_MAP[s] || SCENE_CN_MAP[s];
    if (mapped) out.push(mapped);
    out.push(String(s).toLowerCase());
  });
  return Array.from(new Set(out));
}

function mapSceneList(list) {
  return mapStyleList(list);
}

function seasonCodes(season) {
  const map = { 春: "spring", 夏: "summer", 秋: "autumn", 冬: "winter" };
  return (season || []).map((s) => map[s] || s).filter(Boolean);
}

function enrichItem(raw) {
  const category = raw.category || "tops";
  const weight = guessWeight(raw);
  const color = raw.color || "#F5E8D8";
  const family = colorFamily({ ...raw, color });
  const temperature = raw.temperature || tempRangeForWeight(weight, category);
  const styles = mapStyleList(raw.styles);
  const scenes = mapSceneList(raw.scenes || raw.styles);
  const worn = raw.worn || 0;

  return {
    id: raw.id || raw._id || `x_${Math.random().toString(36).slice(2, 8)}`,
    name: raw.name || "单品",
    category,
    sub_category: raw.sub_category || "",
    color,
    colorName: raw.colorName || "",
    color_family: family,
    brand: raw.brand || "",
    season: raw.season || [],
    season_codes: seasonCodes(raw.season),
    styles,
    scene: scenes.length ? scenes : ["daily"],
    formality: raw.formality != null ? raw.formality : guessFormality(raw),
    temperature,
    body_effect: raw.body_effect || guessBodyEffect(raw),
    matching_tags: raw.matching_tags || [],
    difficulty: raw.difficulty != null ? raw.difficulty : guessDifficulty(raw),
    frequency: raw.frequency != null ? raw.frequency : Math.min(1, worn / 10),
    weight,
    rainy: !!raw.rainy,
    worn,
    image: raw.image || "",
    real: true,
    slot: SLOT_LABEL[category] || "单品",
  };
}

function enrichClothes(list) {
  return (list || []).map(enrichItem);
}

module.exports = {
  SLOT_LABEL,
  climateBand,
  enrichItem,
  enrichClothes,
  hexLuminance,
  colorFamily,
};
