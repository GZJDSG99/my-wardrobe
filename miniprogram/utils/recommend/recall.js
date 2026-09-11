/**
 * 多路候选召回：并集后进入组合
 */

function inTempRange(item, temp, tolerance) {
  const range = item.temperature || { min: 0, max: 40 };
  const t = Number(temp);
  const tol = tolerance != null ? tolerance : 3;
  return t >= range.min - tol && t <= range.max + tol;
}

function styleHit(item, styles) {
  const bag = [].concat(item.styles || [], item.scene || []);
  return (styles || []).some((s) => bag.indexOf(s) >= 0);
}

function sceneHit(item, scenes) {
  const bag = item.scene || [];
  const cn = { commute: "通勤", daily: "日常", business: "商务", date: "约会" };
  return (scenes || []).some(
    (s) => bag.indexOf(s) >= 0 || bag.indexOf(cn[s]) >= 0
  );
}

/**
 * @returns {object[]} enriched items union
 */
function recallCandidates(pool, intent, preference) {
  const pref = preference || {};
  const tol = (intent.constraints && intent.constraints.temperature_tolerance) || 3;
  const byId = {};

  const add = (list, reason) => {
    (list || []).forEach((item) => {
      if (!byId[item.id]) {
        byId[item.id] = { ...item, recallReasons: [] };
      }
      byId[item.id].recallReasons.push(reason);
    });
  };

  // A 场景
  add(
    pool.filter((i) => sceneHit(i, intent.scenes || [intent.scene])),
    "scene"
  );
  // B 适温
  add(
    pool.filter((i) => inTempRange(i, intent.temp, tol)),
    "weather"
  );
  // C 常穿
  add(
    pool
      .slice()
      .sort((a, b) => (b.worn || 0) - (a.worn || 0))
      .slice(0, 12),
    "frequent"
  );
  // D 策略风格
  add(
    pool.filter((i) => styleHit(i, intent.styles)),
    "style"
  );
  // E 偏好色系
  const likedFamilies = Object.keys(pref.colors || {}).filter(
    (k) => (pref.colors[k] || 0) > 0.05
  );
  if (likedFamilies.length) {
    add(
      pool.filter((i) => likedFamilies.indexOf(i.color_family) >= 0),
      "pref_color"
    );
  }
  // F 新鲜（少穿）
  add(
    pool.filter((i) => (i.worn || 0) <= 1).slice(0, 16),
    "fresh"
  );
  // 兜底：全部
  if (Object.keys(byId).length < 6) {
    add(pool, "fallback");
  }

  return Object.keys(byId).map((id) => byId[id]);
}

module.exports = {
  recallCandidates,
  inTempRange,
  styleHit,
  sceneHit,
};
