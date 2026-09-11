/**
 * 本地推荐偏好权重（反馈闭环）
 */

const PREF_KEY = "mw_rec_pref";

const DEFAULT_PREF = {
  colors: {},
  categories: {},
  styles: {},
  seenOutfitKeys: [],
};

function readPref() {
  try {
    const v = wx.getStorageSync(PREF_KEY);
    if (!v || typeof v !== "object") return { ...DEFAULT_PREF };
    return {
      colors: v.colors || {},
      categories: v.categories || {},
      styles: v.styles || {},
      seenOutfitKeys: v.seenOutfitKeys || [],
    };
  } catch (e) {
    return { ...DEFAULT_PREF };
  }
}

function writePref(pref) {
  try {
    wx.setStorageSync(PREF_KEY, pref);
  } catch (e) {}
  return pref;
}

function bumpMap(map, key, delta) {
  if (!key) return;
  const next = { ...map };
  const cur = Number(next[key] || 0);
  next[key] = Math.max(-1, Math.min(1, cur + delta));
  return next;
}

function applyOutfitFeedback(outfit, kind) {
  const pref = readPref();
  const delta =
    kind === "like" || kind === "wear" ? 0.08 : kind === "dislike" ? -0.08 : 0.04;
  let colors = { ...pref.colors };
  let categories = { ...pref.categories };
  let styles = { ...pref.styles };

  (outfit.pieces || []).forEach((p) => {
    colors = bumpMap(colors, p.color_family || p.colorFamily, delta);
    categories = bumpMap(categories, p.category, delta);
  });
  (outfit.tags || []).forEach((t) => {
    styles = bumpMap(styles, t, delta * 0.5);
  });

  const key = outfit.dedupeKey || outfit.id;
  let seen = pref.seenOutfitKeys.slice();
  if (key && seen.indexOf(key) < 0) {
    seen.push(key);
    if (seen.length > 40) seen = seen.slice(-40);
  }

  return writePref({ colors, categories, styles, seenOutfitKeys: seen });
}

function markSeen(keys) {
  const pref = readPref();
  let seen = pref.seenOutfitKeys.slice();
  (keys || []).forEach((k) => {
    if (k && seen.indexOf(k) < 0) seen.push(k);
  });
  if (seen.length > 40) seen = seen.slice(-40);
  return writePref({ ...pref, seenOutfitKeys: seen });
}

function clearSeen() {
  const pref = readPref();
  return writePref({ ...pref, seenOutfitKeys: [] });
}

module.exports = {
  readPref,
  applyOutfitFeedback,
  markSeen,
  clearSeen,
};
