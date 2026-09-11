/**
 * 去重 + 多样性排序 → Top N
 */

function overlapCount(a, b) {
  const setB = {};
  (b.pieces || []).forEach((p) => {
    setB[p.id] = true;
  });
  return (a.pieces || []).filter((p) => setB[p.id]).length;
}

function diversityBonus(candidate, selected) {
  if (!selected.length) return 100;
  let minOverlap = Infinity;
  selected.forEach((s) => {
    minOverlap = Math.min(minOverlap, overlapCount(candidate, s));
  });
  // 重叠越少越好
  if (minOverlap <= 0) return 100;
  if (minOverlap === 1) return 70;
  if (minOverlap === 2) return 40;
  return 10;
}

/**
 * 最终分 = 匹配分 × 0.8 + 多样性 × 0.2
 * 且强制与已选至少有 1～2 件核心单品差异
 */
function diversifySelect(scored, count, excludeKeys) {
  const exclude = {};
  (excludeKeys || []).forEach((k) => {
    exclude[k] = true;
  });

  const pool = scored
    .filter((o) => !exclude[o.dedupeKey])
    .slice()
    .sort((a, b) => b.score - a.score);

  const selected = [];
  const used = {};

  while (selected.length < count && pool.length) {
    let best = null;
    let bestFinal = -Infinity;
    let bestIdx = -1;

    for (let i = 0; i < pool.length; i += 1) {
      const c = pool[i];
      if (used[c.dedupeKey]) continue;

      // 与已选重叠过多则跳过（至少 1 件核心差异：允许最多 pieces-1 重叠）
      let tooSimilar = false;
      for (let j = 0; j < selected.length; j += 1) {
        const ov = overlapCount(c, selected[j]);
        const core = Math.min(
          (c.pieces || []).length,
          (selected[j].pieces || []).length
        );
        if (core >= 2 && ov >= core - 0) {
          // 完全相同已在 exclude；若只差 0 件 → 跳过
          tooSimilar = true;
          break;
        }
        // 至少 1～2 个核心单品不同：重叠 <= core-1 即可；要求重叠 <= core-2 更严
        if (core >= 3 && ov > core - 2) {
          tooSimilar = true;
          break;
        }
      }
      if (tooSimilar) continue;

      const div = diversityBonus(c, selected);
      const finalScore = c.score * 0.8 + div * 0.2;
      if (finalScore > bestFinal) {
        bestFinal = finalScore;
        best = { ...c, finalScore: Math.round(finalScore * 10) / 10 };
        bestIdx = i;
      }
    }

    if (!best) {
      // 放宽：取剩余最高分
      const rest = pool.find((c) => !used[c.dedupeKey]);
      if (!rest) break;
      selected.push(rest);
      used[rest.dedupeKey] = true;
      continue;
    }

    selected.push(best);
    used[best.dedupeKey] = true;
    pool.splice(bestIdx, 1);
  }

  return selected;
}

module.exports = {
  diversifySelect,
  overlapCount,
};
