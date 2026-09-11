/**
 * 硬规则过滤
 */

function passHardRules(outfit, intent) {
  const pieces = outfit.pieces || [];
  if (!pieces.length) return { ok: false, reason: "empty" };

  const top = pieces.find((p) => p.category === "tops");
  const bottom = pieces.find(
    (p) => p.category === "pants" || p.category === "skirts"
  );
  if (!top || !bottom) return { ok: false, reason: "incomplete" };

  const temp = intent.temp;
  // 过热 + 厚重
  for (let i = 0; i < pieces.length; i += 1) {
    const p = pieces[i];
    if (temp >= 28 && p.weight === "heavy") {
      return { ok: false, reason: "too_heavy_hot" };
    }
    if (temp <= 5 && p.weight === "light" && p.category === "tops") {
      // 允许但外套层应有 — 若无外套且上装轻，淘汰
      const hasCoat = pieces.some((x) => x.category === "coats");
      if (!hasCoat) return { ok: false, reason: "too_light_cold" };
    }
  }

  // 用户避免裙装
  if ((intent.avoid || []).indexOf("skirts") >= 0) {
    if (pieces.some((p) => p.category === "skirts")) {
      return { ok: false, reason: "avoid_skirt" };
    }
  }

  // 正式场景避免拖鞋感
  if (intent.scene === "business" || intent.formality === "medium_high") {
    const shoes = pieces.find((p) => p.category === "shoes");
    if (shoes && /拖鞋|人字|洞洞|运动拖鞋/.test(shoes.name || "")) {
      return { ok: false, reason: "informal_shoes" };
    }
  }

  // 省事：颜色过多
  const maxColors =
    (intent.constraints && intent.constraints.max_colors) || 4;
  const families = Array.from(
    new Set(pieces.map((p) => p.color_family).filter(Boolean))
  );
  if (intent.color_complexity === "low" && families.length > maxColors) {
    return { ok: false, reason: "too_many_colors" };
  }

  // 难度上限
  const maxDiff =
    (intent.constraints && intent.constraints.max_difficulty) || 3;
  const avgDiff =
    pieces.reduce((s, p) => s + (p.difficulty || 2), 0) / pieces.length;
  if (avgDiff > maxDiff + 0.5) {
    return { ok: false, reason: "too_hard" };
  }

  // 件数
  const maxItems =
    (intent.constraints && intent.constraints.max_items) ||
    intent.item_count_max ||
    4;
  if (pieces.length > maxItems) {
    return { ok: false, reason: "too_many_items" };
  }

  return { ok: true };
}

function filterOutfits(outfits, intent) {
  return (outfits || []).filter((o) => passHardRules(o, intent).ok);
}

module.exports = {
  passHardRules,
  filterOutfits,
};
