/**
 * 自定义搭配 · 规则小贴士（不接 LLM）
 */

function buildOutfitTips(pieces, weather) {
  const list = pieces || [];
  if (!list.length) {
    return {
      text: "先从上装、下装开始选，画布会实时预览你的搭配。",
      tags: ["自由组合"],
    };
  }

  const cats = list.map((p) => p.category);
  const names = list.map((p) => `${p.name || ""}${p.colorName || ""}`).join("");
  const tags = [];
  const bits = [];

  const hasCoat = cats.indexOf("coats") >= 0;
  const hasShoe = cats.indexOf("shoes") >= 0;
  const hasAcc = cats.indexOf("accessories") >= 0;
  const light = /白|米|浅|奶油|粉/.test(names);
  const dark = /黑|深|灰|炭/.test(names);
  const formal = /衬衫|西裤|乐福|大衣|西装/.test(names);
  const casual = /卫衣|牛仔|运动|休闲/.test(names);

  if (formal) {
    tags.push("通勤");
    bits.push("单品偏利落，适合通勤或见人的场合");
  } else if (casual) {
    tags.push("休闲");
    bits.push("整体更放松，周末出门会很舒服");
  } else {
    tags.push("日常");
    bits.push("基础好搭，日常出门可以直接穿");
  }

  if (light) tags.push("简约");
  if (dark) tags.push("显瘦");
  if (hasCoat) bits.push("有外套层，气温波动也更稳");
  if (hasShoe && hasAcc) bits.push("鞋履和配饰齐了，完整度不错");
  else if (!hasShoe) bits.push("再选双鞋，出门更完整");

  const temp = weather && weather.temp != null ? Number(weather.temp) : null;
  if (temp != null && !Number.isNaN(temp)) {
    tags.push(`${Math.round(temp)}°C`);
    if (temp >= 26 && hasCoat) bits.push("今天偏热，外套可以当空调房备用");
    if (temp <= 12 && !hasCoat) bits.push("今天偏凉，考虑加一件外套");
  }

  if (weather && weather.condition) {
    const c = weather.condition;
    if (/雨/.test(c)) {
      tags.push("防雨");
      bits.push("有雨的话留意鞋履和外套材质");
    }
  }

  const uniq = [];
  tags.forEach((t) => {
    if (uniq.indexOf(t) < 0) uniq.push(t);
  });

  return {
    text: bits.slice(0, 2).join("。") + "。",
    tags: uniq.slice(0, 4),
  };
}

module.exports = {
  buildOutfitTips,
};
