const {
  buildOutfits,
  applyOutfitFeedback,
} = require("../../utils/recommend.js");
const { getProfile, getStreak, getWears } = require("../../utils/user.js");
const { isLoggedIn } = require("../../utils/auth.js");
const { listClothes } = require("../../utils/clothes.js");
const {
  listCustomOutfits,
  saveCustomOutfit,
  slotKeyForCategory,
} = require("../../utils/outfit.js");

const MONTHS = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const MOODS = [
  {
    id: "gentle",
    label: "温柔",
    emoji: "🌸",
    themeId: "easy",
    hint: "温柔柔和",
    phrase: "今天的你，柔软如晨光",
  },
  {
    id: "quiet",
    label: "职业",
    emoji: "💼",
    themeId: "lowkey",
    hint: "干练通勤",
    phrase: "今天的你，干练又从容",
  },
  {
    id: "energetic",
    label: "元气",
    emoji: "☀️",
    themeId: "energy",
    hint: "元气活泼",
    phrase: "今天什么都挡不住你",
  },
  {
    id: "lazy",
    label: "慵懒",
    emoji: "🍵",
    themeId: "easy",
    hint: "慵懒松弛",
    phrase: "偶尔松弛，也是一种美",
  },
  {
    id: "cool",
    label: "清冷",
    emoji: "❄️",
    themeId: "lowkey",
    hint: "清冷极简",
    phrase: "不疾不徐，自有风骨",
  },
  {
    id: "relaxed",
    label: "松弛",
    emoji: "🌿",
    themeId: "easy",
    hint: "松弛日常",
    phrase: "随意就好，你本就很美",
  },
  {
    id: "sweet",
    label: "甜感",
    emoji: "🎀",
    themeId: "energy",
    hint: "甜感可爱",
    phrase: "甜甜的，今天也很可爱",
  },
];

const PERSONAS = [
  { id: "senior", label: "韩系学姐" },
  { id: "artsy", label: "清冷艺术生" },
  { id: "office", label: "温柔通勤" },
  { id: "salt", label: "盐系休闲" },
  { id: "jpsweet", label: "日系甜妹" },
  { id: "vibe", label: "松弛氛围感" },
];

const SCENES = [
  { id: "class", label: "上课", emoji: "📚" },
  { id: "date", label: "约会", emoji: "🌷" },
  { id: "work", label: "通勤", emoji: "💼" },
  { id: "travel", label: "旅行", emoji: "✈️" },
];

const SCENE_TIPS = {
  date: "选柔和浅色系更显温柔，避免过于休闲的单品。",
  travel: "轻便实用优先，叠穿增加造型灵活度。",
  work: "舒适不失精致，上衣可搭配一件有型的外套。",
  class: "轻松百搭为主，oversize 单品增加学院感。",
};

const CAL_EVENTS_KEY = "mw_cal_events";

const MOOD_PETAL = {
  温柔: "#FFB8C0",
  职业: "#DDD0FF",
  元气: "#FFE4B0",
  慵懒: "#B8F0D0",
  清冷: "#B8D8F0",
  松弛: "#D8E8C8",
  甜感: "#FFD0D8",
  自定义: "#C4A882",
  日常: "#E8D0B8",
  省事: "#E8D0B8",
  低调: "#DDD0FF",
  显瘦: "#B8D8F0",
};

const EVENT_PRESETS = [
  { type: "date", label: "约会", emoji: "🌷", dot: "#E0909A", bg: "#FEF0F2", text: "#B05868" },
  { type: "travel", label: "旅行", emoji: "✈️", dot: "#8898D0", bg: "#EEF0FE", text: "#5868A8" },
  { type: "out", label: "出游", emoji: "🗺", dot: "#72B888", bg: "#EEF8F2", text: "#407858" },
  { type: "class", label: "上课", emoji: "📚", dot: "#C8B050", bg: "#FDF6E8", text: "#907830" },
  { type: "other", label: "活动", emoji: "🎵", dot: "#A080C0", bg: "#F4EEFC", text: "#6850A0" },
];

const EVENT_LEGEND = EVENT_PRESETS.map((e) => ({
  type: e.type,
  label: e.label,
  dot: e.dot,
}));

const PETAL_BURST_COLORS = [
  "#FFB8C0",
  "#FFD0D8",
  "#F0C0E8",
  "#DDD0FF",
  "#FFE4B0",
  "#B8F0D0",
  "#FFD8B0",
];

function readCalEvents() {
  try {
    return wx.getStorageSync(CAL_EVENTS_KEY) || {};
  } catch (e) {
    return {};
  }
}

function writeCalEvents(map) {
  try {
    wx.setStorageSync(CAL_EVENTS_KEY, map || {});
  } catch (e) {}
}

function petalOf(mood) {
  return MOOD_PETAL[mood] || "#FFB8C0";
}

function decorateEvents(list) {
  return (list || []).map((ev) => {
    const preset = EVENT_PRESETS.find((p) => p.type === ev.type) || EVENT_PRESETS[4];
    return {
      ...ev,
      emoji: preset.emoji,
      bg: preset.bg,
      text: preset.text,
      dot: preset.dot,
    };
  });
}

const CAT_LABELS = {
  tops: "上衣",
  pants: "裤装",
  skirts: "裙装",
  coats: "外套",
  shoes: "鞋履",
  accessories: "配饰",
};

const COLOR_HARMONY = {
  米白: ["浅灰", "卡其", "浅蓝", "黑色", "灰", "白色", "驼色"],
  白色: ["浅灰", "灰", "黑色", "浅蓝", "米白"],
  浅灰: ["米白", "黑色", "浅蓝", "灰", "白色"],
  灰: ["米白", "黑色", "浅蓝", "白色"],
  卡其: ["米白", "浅灰", "驼色", "白色"],
  驼色: ["米白", "卡其", "白色", "黑色"],
  浅蓝: ["米白", "浅灰", "白色", "牛仔蓝"],
  牛仔蓝: ["米白", "白色", "浅蓝", "黑色"],
  黑色: ["米白", "浅灰", "灰", "白色"],
  粉色: ["米白", "白色", "灰"],
  砖红: ["米白", "驼色", "黑色"],
};

function catLabelOf(cat) {
  return CAT_LABELS[cat] || cat || "衣物";
}

function decorateIdleItem(c) {
  const worn = c.worn || 0;
  return {
    id: c.id,
    name: c.name || "未命名",
    image: c.image || "",
    category: c.category,
    catLabel: catLabelOf(c.category),
    color: c.color || "#F5E8D8",
    colorName: c.colorName || "",
    worn,
    idle: true,
    superIdle: worn <= 1,
  };
}

function filterIdleClothes(clothes) {
  return (clothes || [])
    .filter((c) => !!c.idle)
    .sort((a, b) => (a.worn || 0) - (b.worn || 0))
    .map(decorateIdleItem);
}

function colorHarmonyScore(a, b) {
  if (!a || !b) return 72;
  if (a.colorName && b.colorName && a.colorName === b.colorName) return 92;
  if (a.color && b.color && a.color === b.color) return 90;
  const list = COLOR_HARMONY[a.colorName] || [];
  if (b.colorName && list.indexOf(b.colorName) >= 0) return 85;
  return 72;
}

function harmonyMeta(score) {
  if (score >= 90) return { label: "极简高级", color: "#C4A882" };
  if (score >= 80) return { label: "温柔和谐", color: "#8AB888" };
  return { label: "创意搭配", color: "#C08898" };
}

function pairTip(a, b) {
  if (!a || !b) return "💡 试着和衣橱里其他单品组合看看";
  if (a.category === "tops" || a.catLabel === "上衣") {
    if (a.colorName && a.colorName === b.colorName) {
      return "💡 同色系叠穿，气质高级而统一";
    }
    return "💡 上浅下深更显层次感与修长比例";
  }
  return "💡 下装简约，上衣加一件有型外套更完整";
}

function scorePair(anchor, other) {
  if (!anchor || !other) return 1;
  if (anchor.colorName && other.colorName && anchor.colorName === other.colorName) {
    return 3;
  }
  if (anchor.color && other.color && anchor.color === other.color) return 3;
  const list = COLOR_HARMONY[anchor.colorName] || [];
  if (other.colorName && list.indexOf(other.colorName) >= 0) return 2;
  return 1;
}

function generateIdleOutfits(anchor, wardrobe) {
  const results = [];
  const bottoms = (wardrobe || []).filter(
    (w) =>
      w.id !== anchor.id &&
      (w.category === "pants" || w.category === "skirts")
  );
  const tops = (wardrobe || []).filter(
    (w) => w.id !== anchor.id && w.category === "tops"
  );
  const coats = (wardrobe || []).filter(
    (w) => w.id !== anchor.id && w.category === "coats"
  );

  if (anchor.category === "tops") {
    bottoms
      .slice()
      .sort((a, b) => scorePair(anchor, b) - scorePair(anchor, a))
      .forEach((bot) => results.push([anchor, bot]));
  } else if (anchor.category === "pants" || anchor.category === "skirts") {
    tops
      .slice()
      .sort((a, b) => scorePair(anchor, b) - scorePair(anchor, a))
      .forEach((top) => results.push([top, anchor]));
  } else if (anchor.category === "coats") {
    tops.slice(0, 4).forEach((top) => {
      const bot = bottoms[0];
      if (bot) results.push([top, bot, anchor]);
      else results.push([top, anchor]);
    });
  } else {
    tops.slice(0, 2).forEach((top) => results.push([anchor, top]));
    bottoms.slice(0, 2).forEach((bot) => results.push([anchor, bot]));
  }

  const others = (wardrobe || []).filter((w) => w.id !== anchor.id);
  let safety = 0;
  while (results.length < 3 && safety++ < 30 && others.length) {
    const r = others[Math.floor(Math.random() * others.length)];
    if (!r) break;
    if (results.some((combo) => combo.some((c) => c.id === r.id))) continue;
    const partner =
      coats.find((c) => c.id !== r.id) ||
      tops.find((c) => c.id !== r.id) ||
      bottoms.find((c) => c.id !== r.id) ||
      r;
    results.push([anchor, partner].filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i));
  }

  return results.slice(0, 5).map((combo, idx) => {
    const pieces = combo.map((p) => decorateIdleItem(p));
    const score =
      pieces.length >= 2 ? colorHarmonyScore(pieces[0], pieces[1]) : 72;
    const meta = harmonyMeta(score);
    return {
      id: `idle-o-${idx}`,
      pieces,
      score,
      scoreLabel: meta.label,
      scoreColor: meta.color,
      tip: pairTip(pieces[0], pieces[1]),
    };
  });
}

function buildIdleStack(items, activeIdx) {
  const stack = [];
  (items || []).forEach((item, i) => {
    const offset = i - activeIdx;
    if (offset < 0 || offset > 2) return;
    const rot = offset % 2 === 0 ? offset * 1.3 : -offset * 0.9;
    const scale = 1 - offset * 0.055;
    const opacity = offset === 0 ? 1 : Math.max(0.28, 0.76 - offset * 0.22);
    stack.push({
      ...item,
      offset,
      front: offset === 0,
      zIndex: 10 - offset,
      cardStyle: `transform: translateY(${offset * 18}px) scale(${scale}) rotate(${rot}deg); opacity: ${opacity}; z-index: ${10 - offset};`,
    });
  });
  return stack;
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function dateKey(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function formatDateLabel(d) {
  const week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return `${d.getFullYear()} · ${pad2(d.getMonth() + 1)} · ${pad2(d.getDate())}  ${week}`;
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return { text: "早安，今天也很好看", emoji: "🌸" };
  if (hour >= 11 && hour < 17) return { text: "午后好，今天的你很美", emoji: "✨" };
  if (hour >= 17 && hour < 21) return { text: "傍晚好，记录穿搭了吗", emoji: "🌙" };
  return { text: "晚安，明天的你更好看", emoji: "💫" };
}

function decorateOutfit(o, weather) {
  const pieces = o.pieces || [];
  const tags = o.tags || [];
  const colors = [];
  pieces.forEach((p) => {
    if (p.color && colors.indexOf(p.color) < 0) colors.push(p.color);
  });
  const temp =
    o.temp ||
    (weather && weather.temp != null
      ? `${weather.temp}°C ${weather.condition || ""}`
      : "");
  return {
    ...o,
    temp,
    liked: !!o.liked,
    likeIcon: o.liked ? "♥" : "♡",
    wearLabel: o.wearLabel || "今天穿这套",
    stamped: !!o.stamped,
    tagText: tags.length ? tags.join(" · ") : o.subtitle || "日常",
    itemsText: (o.items && o.items.length
      ? o.items
      : pieces.map((p) => p.name)
    ).join(" + "),
    colors: colors.slice(0, 5),
  };
}

function buildCalCells(year, month, logsMap, eventsMap) {
  const days = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1).getDay();
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const cells = [];
  for (let i = 0; i < first; i++) {
    cells.push({ id: `e${i}`, empty: true });
  }
  for (let d = 1; d <= days; d++) {
    const key = dateKey(year, month, d);
    const log = logsMap[key];
    const evts = decorateEvents(eventsMap[key] || []).slice(0, 3);
    cells.push({
      id: key,
      empty: false,
      day: d,
      key,
      hasLog: !!log,
      thumb: (log && log.image) || "",
      petal: log ? petalOf(log.mood) : "",
      isToday: key === todayKey,
      events: evts,
      hasEvents: evts.length > 0,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ id: `t${cells.length}`, empty: true });
  }
  return cells;
}

function wearsToLogsMap(wears) {
  const map = {};
  (wears || []).forEach((w) => {
    const t = w.createdAt ? new Date(w.createdAt) : null;
    if (!t || Number.isNaN(t.getTime())) return;
    const key = dateKey(t.getFullYear(), t.getMonth(), t.getDate());
    if (!map[key]) {
      map[key] = {
        title: w.title || "今日穿搭",
        desc: (w.items || []).join(" + ") || w.reason || w.title || "",
        mood: w.theme || "日常",
        image: w.image || "",
        temp: w.temp || "",
      };
    }
  });
  return map;
}

function buildWearStats(clothes) {
  const list = (clothes || [])
    .slice()
    .sort((a, b) => (b.worn || 0) - (a.worn || 0))
    .slice(0, 6)
    .map((c) => {
      const count = c.worn || 0;
      let tag = "";
      if (c.idle) tag = "闲置";
      else if (count >= 8) tag = "高频单品";
      return {
        id: c.id,
        name: c.name,
        count,
        tag,
        tagClass: tag === "闲置" ? "tag-idle" : tag ? "tag-hot" : "",
      };
    });
  return list;
}

Page({
  data: {
    dateLabel: "",
    greetText: "",
    greetEmoji: "",
    weatherTip: "",
    streak: 0,
    realRatio: "0",
    stampedId: "",
    loadingRec: false,
    loggedIn: false,
    empty: false,
    emptyTip: "",
    emptySub: "",
    moods: MOODS.map((m, i) => ({ ...m, on: i === 2 })),
    personas: PERSONAS.map((p) => ({ ...p, on: false })),
    scenes: SCENES.map((s) => ({ ...s, on: false })),
    filterHint: "依据心情 · 人设 · 场景，智能推荐",
    allSelected: false,
    moodPhrase: "今天什么都挡不住你",
    moodLabel: "元气",
    moodEmoji: "☀️",
    personaLabel: "",
    sceneLabel: "",
    sceneEmoji: "",
    sceneTip: "",
    heroOutfit: null,
    showLucky: false,
    outfits: [],
    detailShow: false,
    detail: null,
    excludeSeen: false,
    weekdays: WEEKDAYS,
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    calMonthLabel: "",
    calCells: [],
    calLogCount: 0,
    selectedDate: "",
    selectedLog: null,
    selectedEvents: [],
    eventLegend: EVENT_LEGEND,
    eventPresets: EVENT_PRESETS,
    showAddEvent: false,
    calPetals: [],
    wearStats: [],
    idleCount: 0,
    showIdleBrowser: false,
    idleActiveIdx: 0,
    idleTotal: 0,
    idleCounterText: "",
    idleStack: [],
    idleDots: [],
    idleMatchShow: false,
    idleMatchLoading: false,
    idleOutfits: [],
    idleOutfitIdx: 0,
    idleCurrentOutfit: null,
    idleSelectedId: "",
  },

  onLoad() {
    const now = new Date();
    const greet = timeGreeting();
    const y = now.getFullYear();
    const m = now.getMonth();
    this._logsMap = {};
    this._eventsMap = readCalEvents();
    this._petalSeq = 0;
    this.setData({
      dateLabel: formatDateLabel(now),
      greetText: greet.text,
      greetEmoji: greet.emoji,
      calYear: y,
      calMonth: m,
      calMonthLabel: `${y} · ${MONTHS[m]}`,
    });
    this.refreshCalendar(y, m);
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0,
        hidden:
          !!this.data.detailShow ||
          !!this.data.showAddEvent ||
          !!this.data.showIdleBrowser,
      });
    }
    const app = getApp();
    this.setData({
      streak: getStreak() || app.globalData.streak || 0,
      loggedIn: isLoggedIn(),
    });
    this.updateFilterHint();
    this.syncWeatherAndRecommend(false);
    this.refreshDiaryModules();
  },

  onHide() {
    const patch = {};
    if (this.data.detailShow) {
      patch.detailShow = false;
      patch.detail = null;
    }
    if (this.data.showIdleBrowser) {
      patch.showIdleBrowser = false;
      patch.idleMatchShow = false;
      patch.idleMatchLoading = false;
      patch.idleOutfits = [];
      patch.idleCurrentOutfit = null;
    }
    if (Object.keys(patch).length) this.setData(patch);
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false });
    }
  },

  noop() {},

  currentMood() {
    return this.data.moods.find((m) => m.on) || MOODS[0];
  },

  currentPersona() {
    return this.data.personas.find((p) => p.on) || null;
  },

  currentScene() {
    return this.data.scenes.find((s) => s.on) || null;
  },

  buildUserText() {
    const parts = [];
    const mood = this.currentMood();
    const persona = this.currentPersona();
    const scene = this.currentScene();
    if (mood) parts.push(mood.hint || mood.label);
    if (persona) parts.push(persona.label);
    if (scene) parts.push(`${scene.label}场合`);
    return parts.join(" ");
  },

  updateFilterHint() {
    const mood = this.currentMood();
    const persona = this.currentPersona();
    const scene = this.currentScene();
    const allSelected = !!(mood && persona && scene);
    let filterHint = "依据心情 · 人设 · 场景，智能推荐";
    if (allSelected) {
      filterHint = `${mood.emoji} ${mood.label} × ${persona.label} × ${scene.emoji} ${scene.label}`;
    } else if (mood && (persona || scene)) {
      filterHint = `已选 ${mood.label} · 继续完善人设和场景获得完美方案`;
    } else if (mood) {
      filterHint = `已选 ${mood.emoji} ${mood.label} · 点「今天帮我搭」生成方案`;
    }
    this.setData({
      filterHint,
      allSelected,
      moodPhrase: (mood && mood.phrase) || "今天的你，柔软如晨光",
      moodLabel: (mood && mood.label) || "",
      moodEmoji: (mood && mood.emoji) || "",
      personaLabel: (persona && persona.label) || "",
      sceneLabel: (scene && scene.label) || "",
      sceneEmoji: (scene && scene.emoji) || "",
      sceneTip:
        allSelected && scene
          ? SCENE_TIPS[scene.id] || "随性自在，以低饱和色系为主。"
          : "",
    });
  },

  onPickMood(e) {
    const id = e.currentTarget.dataset.id;
    const moods = this.data.moods.map((m) => ({
      ...m,
      on: m.id === id ? !m.on : false,
    }));
    if (!moods.some((m) => m.on)) {
      moods[0].on = true;
    }
    this.setData({ moods });
    this.updateFilterHint();
  },

  onPickPersona(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      personas: this.data.personas.map((p) => ({
        ...p,
        on: p.id === id ? !p.on : false,
      })),
    });
    this.updateFilterHint();
  },

  onPickScene(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      scenes: this.data.scenes.map((s) => ({
        ...s,
        on: s.id === id ? !s.on : false,
      })),
    });
    this.updateFilterHint();
  },

  loadClothesSafe() {
    if (!isLoggedIn()) return Promise.resolve([]);
    return listClothes().catch(() => []);
  },

  loadCustomSafe() {
    if (!isLoggedIn()) return Promise.resolve([]);
    return listCustomOutfits().catch(() => []);
  },

  rebuildRecommend(weather, opts) {
    const app = getApp();
    const profile = getProfile();
    const loggedIn = isLoggedIn();
    const options = opts || {};
    const mood = this.currentMood();
    const userText = options.forceText || this.buildUserText();

    this.setData({ loadingRec: true, loggedIn, showLucky: true });

    return Promise.all([this.loadClothesSafe(), this.loadCustomSafe()]).then(
      ([clothes, customs]) => {
        if (!loggedIn) {
          this.setData({
            loadingRec: false,
            outfits: [],
            heroOutfit: null,
            empty: true,
            emptyTip: "登录后生成穿搭",
            emptySub: "登录并同步衣橱后，就能按今天天气给你推荐。",
            realRatio: "0",
            stampedId: "",
            wearStats: [],
            idleCount: 0,
            showIdleBrowser: false,
          });
          if (app.globalData) app.globalData.realRatio = "0";
          return;
        }

        this._clothesCache = clothes || [];
        const idleItems = filterIdleClothes(clothes);
        this._idleItems = idleItems;

        const result = buildOutfits({
          weather: weather || app.globalData.weather || {},
          themeId: (mood && mood.themeId) || "easy",
          userText,
          profile,
          clothes,
          count: 3,
          excludeSeen: !!options.excludeSeen || !!this.data.excludeSeen,
          markAsSeen: true,
        });

        const realRatio = result.realRatio;
        if (app.globalData) app.globalData.realRatio = realRatio;

        const systemOutfits = (result.outfits || []).map((o) =>
          decorateOutfit(
            {
              ...o,
              wearLabel: "今天穿这套",
              stamped: false,
              custom: false,
            },
            weather
          )
        );

        const customOutfits = (customs || []).slice(0, 1).map((o) =>
          decorateOutfit(
            {
              ...o,
              wearLabel: "今天穿这套",
              stamped: false,
              custom: true,
              tags: o.tags || ["自定义"],
              reason: o.reason || "你自己组的搭配，随时可再穿。",
            },
            weather
          )
        );

        const outfits = customOutfits.concat(systemOutfits).slice(0, 3);
        const empty = outfits.length === 0;
        const wearStats = buildWearStats(clothes);
        const idleCount = idleItems.length;
        const heroOutfit = empty ? null : outfits[0];

        this.setData({
          loadingRec: false,
          outfits,
          heroOutfit,
          empty,
          emptyTip: empty ? result.emptyTip || "还没有可展示的搭配" : "",
          emptySub: empty
            ? result.emptySub || "先添加衣物，或自己组一套搭配。"
            : "",
          realRatio,
          stampedId: "",
          excludeSeen: false,
          wearStats,
          idleCount,
        });
        this.updateFilterHint();
      }
    );
  },

  syncWeatherAndRecommend(autoBuild) {
    const app = getApp();
    const cached = app.globalData.weather;
    const cacheAt = app.globalData.weatherAt || 0;
    const fresh = Date.now() - cacheAt < 10 * 60 * 1000;
    const shouldBuild = autoBuild !== false && this.data.showLucky;

    const afterWeather = (weather) => {
      this.applyWeather(weather);
      if (shouldBuild || this.data.showLucky) {
        return this.rebuildRecommend(weather);
      }
      return null;
    };

    if (cached && fresh) {
      afterWeather(cached);
      return;
    }

    const {
      fetchCurrentWeather,
      fetchWeatherByLocation,
    } = require("../../utils/weather.js");

    const loader =
      app.globalData.useLocation && app.globalData.location
        ? fetchWeatherByLocation(
            app.globalData.location.latitude,
            app.globalData.location.longitude,
            app.globalData.city
          )
        : fetchCurrentWeather(app.globalData.cityQuery || "Hangzhou");

    loader
      .then((weather) => {
        app.globalData.weather = weather;
        app.globalData.weatherAt = Date.now();
        app.globalData.city = weather.city;
        return afterWeather(weather);
      })
      .catch(() => {
        if (cached) afterWeather(cached);
        else if (shouldBuild) this.rebuildRecommend({});
        else this.applyWeather({});
      });
  },

  applyWeather(weather) {
    const tip =
      weather.weatherTip ||
      `${weather.temp != null ? weather.temp + "°C" : ""}${
        weather.condition ? " · " + weather.condition : ""
      }`.trim();
    this.setData({ weatherTip: tip || "查看天气" });
  },

  onLuckyTap() {
    const app = getApp();
    this.setData({ excludeSeen: false });
    wx.showLoading({ title: "搭配中", mask: true });
    this.rebuildRecommend(app.globalData.weather || {})
      .then(() => wx.hideLoading())
      .catch(() => wx.hideLoading());
  },

  onRefreshBatch() {
    const app = getApp();
    this.setData({ excludeSeen: true });
    wx.showLoading({ title: "换一批", mask: true });
    this.rebuildRecommend(app.globalData.weather || {}, { excludeSeen: true })
      .then(() => wx.hideLoading())
      .catch(() => wx.hideLoading());
  },

  onToggleLike(e) {
    const id = e.currentTarget.dataset.id;
    const outfits = this.data.outfits.map((o) => {
      if (o.id !== id) return o;
      const liked = !o.liked;
      if (liked) {
        try {
          applyOutfitFeedback(o, "like");
        } catch (err) {}
      }
      return { ...o, liked, likeIcon: liked ? "♥" : "♡" };
    });
    const detail =
      this.data.detail && this.data.detail.id === id
        ? {
            ...this.data.detail,
            liked: !this.data.detail.liked,
            likeIcon: !this.data.detail.liked ? "♥" : "♡",
          }
        : this.data.detail;
    const heroOutfit =
      this.data.heroOutfit && this.data.heroOutfit.id === id
        ? outfits.find((o) => o.id === id) || this.data.heroOutfit
        : this.data.heroOutfit;
    this.setData({ outfits, detail, heroOutfit });
  },

  onOpenDetail(e) {
    const id = e.currentTarget.dataset.id;
    const detail = this.data.outfits.find((o) => o.id === id);
    if (!detail) return;
    this.setData({ detailShow: true, detail });
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ hidden: true });
    }
  },

  onCloseDetail() {
    this.setData({ detailShow: false, detail: null });
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false });
    }
  },

  onCustom() {
    if (!isLoggedIn()) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/package-closet/custom/custom" });
  },

  onWear(e) {
    const id = e.currentTarget.dataset.id;
    const app = getApp();
    const outfit = this.data.outfits.find((o) => o.id === id);
    const mood = this.currentMood();

    if (this.data.stampedId !== id) {
      try {
        const { bumpStreak, addWear } = require("../../utils/user.js");
        const streak = bumpStreak();
        app.globalData.streak = streak;
        if (outfit) {
          addWear({
            title: outfit.title,
            reason: outfit.reason,
            temp: outfit.temp,
            items: outfit.items,
            image: outfit.image,
            theme: outfit.custom ? "自定义" : (mood && mood.label) || "",
          });
          try {
            applyOutfitFeedback(outfit, "wear");
          } catch (e3) {}
        }
        this.setData({ streak });
        this.refreshDiaryModules();
      } catch (err) {
        const streak = (app.globalData.streak || 0) + 1;
        app.globalData.streak = streak;
        try {
          const { setStreak } = require("../../utils/user.js");
          setStreak(streak);
        } catch (e2) {}
        this.setData({ streak });
      }
    }

    const outfits = this.data.outfits.map((o) => ({
      ...o,
      stamped: o.id === id,
      wearLabel: o.id === id ? "已采纳" : "今天穿这套",
    }));
    const detail =
      this.data.detail && this.data.detail.id === id
        ? { ...this.data.detail, wearLabel: "已采纳", stamped: true }
        : this.data.detail;

    const heroOutfit =
      this.data.heroOutfit && this.data.heroOutfit.id === id
        ? outfits.find((o) => o.id === id) || this.data.heroOutfit
        : this.data.heroOutfit;
    this.setData({ stampedId: id, outfits, detail, heroOutfit });
    wx.vibrateShort({ type: "light" });
    wx.showToast({ title: "已记下今天这套", icon: "none" });
  },

  onGoWardrobe() {
    wx.switchTab({ url: "/pages/wardrobe/wardrobe" });
  },

  setTabBarHidden(hidden) {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ hidden: !!hidden });
    }
  },

  syncIdleFromClothes(clothes) {
    const idleItems = filterIdleClothes(clothes);
    this._clothesCache = clothes || [];
    this._idleItems = idleItems;
    return idleItems;
  },

  refreshIdleStack(activeIdx) {
    const items = this._idleItems || [];
    const idx = Math.max(0, Math.min(activeIdx || 0, Math.max(0, items.length - 1)));
    const idleDots = items.map((_, i) => ({
      id: `d${i}`,
      on: i === idx,
      wide: i === idx,
    }));
    this.setData({
      idleActiveIdx: idx,
      idleTotal: items.length,
      idleCounterText: `${idx + 1} · ${items.length}`,
      idleStack: buildIdleStack(items, idx),
      idleDots,
      idleCount: items.length,
    });
  },

  onOpenIdle() {
    const openWith = (clothes) => {
      const idleItems = this.syncIdleFromClothes(clothes);
      if (!idleItems.length) {
        wx.showToast({ title: "暂无闲置衣物", icon: "none" });
        return;
      }
      this.setData({
        showIdleBrowser: true,
        idleMatchShow: false,
        idleMatchLoading: false,
        idleOutfits: [],
        idleOutfitIdx: 0,
        idleCurrentOutfit: null,
        idleSelectedId: "",
      });
      this.refreshIdleStack(0);
      this.setTabBarHidden(true);
    };

    if (this._clothesCache && this._clothesCache.length) {
      openWith(this._clothesCache);
      return;
    }
    wx.showLoading({ title: "加载中", mask: true });
    this.loadClothesSafe()
      .then((clothes) => {
        wx.hideLoading();
        openWith(clothes);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: "加载失败", icon: "none" });
      });
  },

  onCloseIdle() {
    const keepHidden = this.data.detailShow || this.data.showAddEvent;
    this.setData({
      showIdleBrowser: false,
      idleMatchShow: false,
      idleMatchLoading: false,
      idleOutfits: [],
      idleCurrentOutfit: null,
      idleSelectedId: "",
    });
    if (!keepHidden) this.setTabBarHidden(false);
  },

  onIdlePrev() {
    if (this.data.idleActiveIdx <= 0) return;
    this.refreshIdleStack(this.data.idleActiveIdx - 1);
  },

  onIdleNext() {
    if (this.data.idleActiveIdx >= this.data.idleTotal - 1) return;
    this.refreshIdleStack(this.data.idleActiveIdx + 1);
  },

  onIdleDotTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    this.refreshIdleStack(idx);
  },

  onIdleMatch() {
    const items = this._idleItems || [];
    const item = items[this.data.idleActiveIdx];
    if (!item) return;
    const raw =
      (this._clothesCache || []).find((c) => c.id === item.id) || item;
    this.setData({
      idleMatchShow: true,
      idleMatchLoading: true,
      idleSelectedId: item.id,
      idleOutfits: [],
      idleOutfitIdx: 0,
      idleCurrentOutfit: null,
    });
    setTimeout(() => {
      const outfits = generateIdleOutfits(raw, this._clothesCache || []);
      this.setData({
        idleMatchLoading: false,
        idleOutfits: outfits,
        idleOutfitIdx: 0,
        idleCurrentOutfit: outfits[0] || null,
      });
    }, 700);
  },

  onIdleMatchBack() {
    this.setData({
      idleMatchShow: false,
      idleMatchLoading: false,
      idleOutfits: [],
      idleOutfitIdx: 0,
      idleCurrentOutfit: null,
      idleSelectedId: "",
    });
  },

  onIdleOutfitPrev() {
    const idx = this.data.idleOutfitIdx;
    if (idx <= 0) return;
    const next = idx - 1;
    this.setData({
      idleOutfitIdx: next,
      idleCurrentOutfit: this.data.idleOutfits[next] || null,
    });
  },

  onIdleOutfitNext() {
    const idx = this.data.idleOutfitIdx;
    if (idx >= this.data.idleOutfits.length - 1) return;
    const next = idx + 1;
    this.setData({
      idleOutfitIdx: next,
      idleCurrentOutfit: this.data.idleOutfits[next] || null,
    });
  },

  onIdleOutfitDot(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    this.setData({
      idleOutfitIdx: idx,
      idleCurrentOutfit: this.data.idleOutfits[idx] || null,
    });
  },

  onIdleRegenerate() {
    const items = this._idleItems || [];
    const item = items[this.data.idleActiveIdx];
    if (!item) return;
    const raw =
      (this._clothesCache || []).find((c) => c.id === item.id) || item;
    this.setData({
      idleMatchLoading: true,
      idleOutfits: [],
      idleCurrentOutfit: null,
    });
    setTimeout(() => {
      const outfits = generateIdleOutfits(raw, this._clothesCache || []);
      this.setData({
        idleMatchLoading: false,
        idleOutfits: outfits,
        idleOutfitIdx: 0,
        idleCurrentOutfit: outfits[0] || null,
      });
    }, 600);
  },

  onIdleSaveOutfit() {
    const outfit = this.data.idleCurrentOutfit;
    if (!outfit || !outfit.pieces || outfit.pieces.length < 2) {
      wx.showToast({ title: "搭配不完整", icon: "none" });
      return;
    }
    const pieces = outfit.pieces.map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image || "",
      color: p.color || "#F5E8D8",
      slot: slotKeyForCategory(p.category) || "",
    }));
    wx.showLoading({ title: "保存中", mask: true });
    saveCustomOutfit({
      title: `闲置焕新 · ${pieces[0].name}`,
      reason: outfit.tip || "为闲置单品生成的一套搭配。",
      pieces,
    })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: "已保存到我的搭配", icon: "none" });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({
          title: (err && err.message) || "保存失败",
          icon: "none",
        });
      });
  },

  onGoLogin() {
    wx.switchTab({ url: "/pages/profile/profile" });
  },

  onGoWeather() {
    wx.switchTab({ url: "/pages/weather/weather" });
  },

  refreshDiaryModules() {
    try {
      const wears = getWears();
      this._logsMap = wearsToLogsMap(wears);
    } catch (e) {
      this._logsMap = {};
    }
    this._eventsMap = readCalEvents();
    this.refreshCalendar();
    this.loadClothesSafe().then((clothes) => {
      const idleItems = this.syncIdleFromClothes(clothes);
      this.setData({
        wearStats: buildWearStats(clothes),
        idleCount: idleItems.length,
      });
    });
  },

  refreshCalendar(year, month) {
    const y = year != null ? year : this.data.calYear;
    const m = month != null ? month : this.data.calMonth;
    const map = this._logsMap || {};
    const eventsMap = this._eventsMap || {};
    const prefix = `${y}-${pad2(m + 1)}`;
    const calLogCount = Object.keys(map).filter((k) => k.indexOf(prefix) === 0)
      .length;
    const selectedDate = this.data.selectedDate;
    const patch = {
      calYear: y,
      calMonth: m,
      calMonthLabel: `${y} · ${MONTHS[m]}`,
      calCells: buildCalCells(y, m, map, eventsMap),
      calLogCount,
    };
    if (selectedDate) {
      patch.selectedLog = map[selectedDate] || null;
      patch.selectedEvents = decorateEvents(eventsMap[selectedDate] || []);
    }
    this.setData(patch);
  },

  spawnCalPetals(pageX, pageY) {
    const query = wx.createSelectorQuery().in(this);
    query.select(".cal-wrap").boundingClientRect();
    query.exec((res) => {
      const wrap = res && res[0];
      if (!wrap) return;
      const cx = pageX - wrap.left;
      const cy = pageY - wrap.top;
      const batch = [];
      for (let i = 0; i < 9; i++) {
        this._petalSeq = (this._petalSeq || 0) + 1;
        const phase = Math.random();
        batch.push({
          id: `p${this._petalSeq}`,
          left: cx + (Math.random() - 0.5) * 30,
          top: cy - 4,
          color: PETAL_BURST_COLORS[Math.floor(Math.random() * PETAL_BURST_COLORS.length)],
          size: 10 + Math.random() * 14,
          dx: (Math.random() - 0.5) * 72,
          rot: Math.random() * 360,
          dur: 0.85 + phase * 0.3,
        });
      }
      const next = (this.data.calPetals || []).concat(batch);
      this.setData({ calPetals: next });
      setTimeout(() => {
        const ids = {};
        batch.forEach((p) => {
          ids[p.id] = true;
        });
        this.setData({
          calPetals: (this.data.calPetals || []).filter((p) => !ids[p.id]),
        });
      }, 1400);
    });
  },

  onPrevMonth() {
    let y = this.data.calYear;
    let m = this.data.calMonth - 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    this.setData({
      calYear: y,
      calMonth: m,
      selectedDate: "",
      selectedLog: null,
      selectedEvents: [],
    });
    this.refreshCalendar(y, m);
  },

  onNextMonth() {
    let y = this.data.calYear;
    let m = this.data.calMonth + 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    this.setData({
      calYear: y,
      calMonth: m,
      selectedDate: "",
      selectedLog: null,
      selectedEvents: [],
    });
    this.refreshCalendar(y, m);
  },

  onSelectDate(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const detail = e.detail || {};
    if (detail.x != null && detail.y != null) {
      this.spawnCalPetals(detail.x, detail.y);
    }
    if (this.data.selectedDate === key) {
      this.setData({
        selectedDate: "",
        selectedLog: null,
        selectedEvents: [],
      });
      return;
    }
    const log = (this._logsMap && this._logsMap[key]) || null;
    const selectedEvents = decorateEvents(
      (this._eventsMap && this._eventsMap[key]) || []
    );
    this.setData({ selectedDate: key, selectedLog: log, selectedEvents });
  },

  onOpenAddEvent() {
    if (!this.data.selectedDate) {
      wx.showToast({ title: "先选一个日期", icon: "none" });
      return;
    }
    this.setData({ showAddEvent: true });
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ hidden: true });
    }
  },

  onCloseAddEvent() {
    this.setData({ showAddEvent: false });
    if (!this.data.detailShow && typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false });
    }
  },

  onAddEvent(e) {
    const type = e.currentTarget.dataset.type;
    const label = e.currentTarget.dataset.label;
    const key = this.data.selectedDate;
    if (!key || !type) return;
    const map = Object.assign({}, this._eventsMap || {});
    const list = (map[key] || []).slice();
    list.push({ type, label });
    map[key] = list;
    this._eventsMap = map;
    writeCalEvents(map);
    this.setData({
      showAddEvent: false,
      selectedEvents: decorateEvents(list),
    });
    this.refreshCalendar();
    if (!this.data.detailShow && typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false });
    }
    wx.showToast({ title: "已添加提醒", icon: "none" });
  },
});
