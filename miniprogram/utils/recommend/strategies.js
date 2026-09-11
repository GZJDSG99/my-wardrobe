/**
 * 推荐策略配置（可调权重，不改核心引擎）
 * 权重和为 100，对应文档多维评分
 */

const BASE_WEIGHTS = {
  weather: 25,
  scene: 20,
  style: 15,
  preference: 15,
  color: 10,
  completeness: 5,
  novelty: 5,
  difficulty: 5,
};

const STRATEGIES = {
  easy: {
    id: "easy",
    name: "省事",
    intentDefaults: {
      scene: "daily",
      styles: ["simple", "minimal"],
      operation_cost: "low",
      color_complexity: "low",
      prefer_light: true,
      item_count_max: 3,
    },
    weights: {
      ...BASE_WEIGHTS,
      weather: 22,
      difficulty: 18,
      completeness: 8,
      novelty: 2,
      style: 12,
      preference: 13,
      color: 10,
      scene: 15,
    },
    constraints: {
      max_items: 4,
      max_colors: 3,
      temperature_tolerance: 4,
      max_difficulty: 2,
    },
  },
  energy: {
    id: "energy",
    name: "元气",
    intentDefaults: {
      scene: "daily",
      styles: ["energetic", "casual", "sweet"],
      operation_cost: "medium",
      color_complexity: "medium",
      prefer_light: true,
      item_count_max: 4,
    },
    weights: {
      ...BASE_WEIGHTS,
      style: 28,
      color: 20,
      weather: 18,
      scene: 12,
      preference: 10,
      novelty: 7,
      completeness: 3,
      difficulty: 2,
    },
    constraints: {
      max_items: 4,
      max_colors: 4,
      temperature_tolerance: 4,
      max_difficulty: 3,
    },
  },
  lowkey: {
    id: "lowkey",
    name: "低调",
    intentDefaults: {
      scene: "commute",
      styles: ["minimal", "lowkey", "smart"],
      operation_cost: "low",
      color_complexity: "low",
      prefer_dark: true,
      item_count_max: 4,
    },
    weights: {
      ...BASE_WEIGHTS,
      style: 22,
      color: 18,
      scene: 18,
      weather: 20,
      preference: 12,
      difficulty: 5,
      novelty: 3,
      completeness: 2,
    },
    constraints: {
      max_items: 4,
      max_colors: 3,
      temperature_tolerance: 3,
      max_difficulty: 2,
    },
  },
  slim: {
    id: "slim",
    name: "显瘦",
    intentDefaults: {
      scene: "daily",
      styles: ["slim", "minimal", "commute"],
      operation_cost: "medium",
      color_complexity: "low",
      body_effect: ["slim", "vertical"],
      prefer_dark: true,
      item_count_max: 4,
    },
    weights: {
      ...BASE_WEIGHTS,
      style: 30,
      preference: 12,
      color: 15,
      weather: 18,
      scene: 12,
      difficulty: 5,
      novelty: 4,
      completeness: 4,
    },
    constraints: {
      max_items: 4,
      max_colors: 3,
      temperature_tolerance: 3,
      max_difficulty: 3,
    },
  },
};

const THEME_ALIAS = {
  easy: "easy",
  energy: "energy",
  energetic: "energy",
  lowkey: "lowkey",
  slim: "slim",
};

function getStrategy(id) {
  const key = THEME_ALIAS[id] || id || "easy";
  return STRATEGIES[key] || STRATEGIES.easy;
}

module.exports = {
  BASE_WEIGHTS,
  STRATEGIES,
  getStrategy,
};
