/**
 * Outfit 组合生成（有限枚举 + 贪心，避免爆炸）
 */

const { climateBand } = require("./enrich.js");
const { inTempRange } = require("./recall.js");

function byCat(pool, cat) {
  return pool.filter((i) => i.category === cat);
}

function needCoat(intent) {
  const band = climateBand(intent.temp);
  if (band === "hot") return intent.rainy;
  if (band === "warm") return intent.rainy;
  return true;
}

function colorCompat(a, b) {
  if (!a || !b) return true;
  if (a.color_family === b.color_family) return true;
  const lightDark =
    (a.color_family === "light" && b.color_family === "dark") ||
    (a.color_family === "dark" && b.color_family === "light");
  if (lightDark) return true;
  if (a.color_family === "denim" || b.color_family === "denim") return true;
  if (a.color_family === "mid" || b.color_family === "mid") return true;
  return false;
}

function pickTopN(list, n, scoreFn) {
  return list
    .map((item) => ({ item, s: scoreFn(item) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.item);
}

function itemSeedScore(item, intent) {
  let s = 0;
  if (inTempRange(item, intent.temp, 4)) s += 10;
  if ((item.recallReasons || []).length) s += item.recallReasons.length * 2;
  if (intent.prefer_light && item.color_family === "light") s += 6;
  if (intent.prefer_dark && item.color_family === "dark") s += 6;
  if (intent.colorFocus) {
    const bag = `${item.colorName || ""}${item.name || ""}`;
    const tokens = intent.colorFocus.tokens || [];
    if (intent.colorFocus.family && item.color_family === intent.colorFocus.family) {
      s += 14;
    }
    if (tokens.some((tk) => bag.indexOf(tk) >= 0)) s += 18;
  }
  if ((intent.body_effect || []).some((e) => (item.body_effect || []).indexOf(e) >= 0)) {
    s += 8;
  }
  s -= (item.difficulty || 1) * 1.5;
  s += Math.min(5, (item.worn || 0) > 0 ? 2 : 4);
  return s;
}

function makeDedupeKey(pieces) {
  return pieces
    .map((p) => p.id)
    .sort()
    .join("|");
}

/**
 * 生成候选 outfit 列表（未评分）
 */
function generateOutfits(pool, intent, limit) {
  const max = limit || 36;
  const tops = pickTopN(byCat(pool, "tops"), 8, (i) => itemSeedScore(i, intent));
  let bottoms = byCat(pool, "pants").concat(byCat(pool, "skirts"));
  if (intent.bottom_pref === "pants") bottoms = byCat(pool, "pants");
  if (intent.bottom_pref === "skirts") {
    const skirts = byCat(pool, "skirts");
    if (skirts.length) bottoms = skirts;
  }
  if ((intent.avoid || []).indexOf("skirts") >= 0) {
    bottoms = bottoms.filter((b) => b.category !== "skirts");
  }
  bottoms = pickTopN(bottoms, 8, (i) => itemSeedScore(i, intent));
  const shoes = pickTopN(byCat(pool, "shoes"), 6, (i) => itemSeedScore(i, intent));
  const coats = pickTopN(byCat(pool, "coats"), 5, (i) => itemSeedScore(i, intent));
  const withCoat = needCoat(intent);

  const outfits = [];
  const seen = {};

  for (let ti = 0; ti < tops.length; ti += 1) {
    for (let bi = 0; bi < bottoms.length; bi += 1) {
      const top = tops[ti];
      const bottom = bottoms[bi];
      if (!colorCompat(top, bottom)) continue;

      const shoeCandidates = shoes.length
        ? shoes.filter((s) => colorCompat(top, s) || colorCompat(bottom, s))
        : [null];
      if (!shoeCandidates.length) shoeCandidates.push(null);

      for (let si = 0; si < Math.min(shoeCandidates.length, 3); si += 1) {
        const shoe = shoeCandidates[si];
        const coatOptions = withCoat && coats.length ? [null].concat(coats.slice(0, 2)) : [null];

        for (let ci = 0; ci < coatOptions.length; ci += 1) {
          const coat = coatOptions[ci];
          if (coat && !colorCompat(top, coat) && !colorCompat(bottom, coat)) continue;

          const pieces = [top, bottom, shoe, coat].filter(Boolean);
          if (pieces.length < 2) continue;
          const key = makeDedupeKey(pieces);
          if (seen[key]) continue;
          seen[key] = true;

          outfits.push({
            dedupeKey: key,
            pieces,
            style: (top.styles && top.styles[0]) || intent.styles[0] || "minimal",
            scene: intent.scene,
          });

          if (outfits.length >= max) return outfits;
        }
      }
    }
  }

  return outfits;
}

module.exports = {
  generateOutfits,
  needCoat,
  makeDedupeKey,
  colorCompat,
};
