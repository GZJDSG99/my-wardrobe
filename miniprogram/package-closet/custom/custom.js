const { listClothes } = require("../../utils/clothes.js");
const {
  SLOT_DEFS,
  CANVAS_LAYER,
  CATEGORY_TABS,
  slotKeyForCategory,
  saveCustomOutfit,
} = require("../../utils/outfit.js");
const { buildOutfitTips } = require("../../utils/outfit-tips.js");
const { buildOutfits } = require("../../utils/recommend.js");
const { getProfile } = require("../../utils/user.js");
const { isLoggedIn, ensureLogin } = require("../../utils/auth.js");

function emptySlots() {
  return SLOT_DEFS.map((s) => ({
    key: s.key,
    label: s.label,
    required: s.required,
    categories: s.categories,
    selected: null,
  }));
}

function countByTab(clothes, tab) {
  if (!tab.categories) return (clothes || []).length;
  return (clothes || []).filter((c) => tab.categories.indexOf(c.category) >= 0)
    .length;
}

Page({
  data: {
    pageMode: "canvas", // canvas | list
    sidebarOpen: false,
    bottomTab: "wardrobe", // recommend | wardrobe | inspire
    activeCat: "all",
    title: "",
    slots: emptySlots(),
    clothes: [],
    categoryTabs: [],
    pickerList: [],
    canvasPieces: [],
    selectedCount: 0,
    maxSlots: SLOT_DEFS.length,
    tipsText: "",
    tipsTags: [],
    recommendCards: [],
    activeRecId: "",
    inspireCards: [
      {
        id: "ins_1",
        title: "通勤干净",
        desc: "浅色上装 + 深色下装",
        hint: "简约 · 利落",
      },
      {
        id: "ins_2",
        title: "周末轻松",
        desc: "针织 / 牛仔 / 小白鞋",
        hint: "休闲 · 舒适",
      },
      {
        id: "ins_3",
        title: "轻正式",
        desc: "衬衫感 + 直筒裤",
        hint: "见人 · 不过分严肃",
      },
    ],
    saving: false,
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.showModal({
        title: "请先登录",
        content: "登录后才能用衣橱单品组搭配。",
        confirmText: "去登录",
        success: (res) => {
          if (!res.confirm) {
            wx.navigateBack({ delta: 1 });
            return;
          }
          ensureLogin(true)
            .then(() => {
              wx.showToast({ title: "登录成功", icon: "success" });
              this.bootstrap();
            })
            .catch((err) => {
              wx.showModal({
                title: "登录失败",
                content: err.message || "请确认已部署云函数 login",
                showCancel: false,
                complete: () => wx.navigateBack({ delta: 1 }),
              });
            });
        },
      });
      return;
    }
    this.bootstrap();
  },

  bootstrap() {
    this.refreshTips(emptySlots());
    this.loadClothes().then(() => this.loadRecommends());
  },

  loadClothes() {
    wx.showLoading({ title: "加载衣橱", mask: true });
    return listClothes()
      .then((clothes) => {
        wx.hideLoading();
        const tabs = CATEGORY_TABS.map((t) => ({
          ...t,
          count: countByTab(clothes, t),
        }));
        this.setData({ clothes, categoryTabs: tabs, slots: emptySlots() });
        this.applyPickerFilter("all", clothes);
        this.syncCanvas(emptySlots());
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: err.message || "加载失败", icon: "none" });
      });
  },

  loadRecommends() {
    const app = getApp();
    const weather = (app && app.globalData && app.globalData.weather) || {};
    const clothes = this.data.clothes || [];
    if (!clothes.length) {
      this.setData({ recommendCards: [] });
      return;
    }
    try {
      const result = buildOutfits({
        weather,
        themeId: "easy",
        profile: getProfile(),
        clothes,
        count: 3,
        markAsSeen: false,
      });
      const recommendCards = (result.outfits || []).map((o) => ({
        id: o.id,
        title: o.title,
        itemsText: (o.items || []).join(" + "),
        pieces: o.pieces || [],
        image: o.image || "",
        tagText: (o.tags || []).join(" · "),
      }));
      this.setData({ recommendCards });
    } catch (e) {
      this.setData({ recommendCards: [] });
    }
  },

  applyPickerFilter(catId, clothesList) {
    const clothes = clothesList || this.data.clothes || [];
    const tab =
      CATEGORY_TABS.find((t) => t.id === catId) || CATEGORY_TABS[0];
    const list = !tab.categories
      ? clothes.slice()
      : clothes.filter((c) => tab.categories.indexOf(c.category) >= 0);

    const selectedIds = {};
    (this.data.slots || []).forEach((s) => {
      if (s.selected) selectedIds[s.selected.id] = true;
    });

    const pickerList = list.map((c) => ({
      ...c,
      inUse: !!selectedIds[c.id],
      slotKey: slotKeyForCategory(c.category),
    }));
    this.setData({ activeCat: catId, pickerList });
  },

  syncCanvas(slots) {
    const map = {};
    (slots || []).forEach((s) => {
      if (s.selected) map[s.key] = { ...s.selected, slotKey: s.key, slot: s.label };
    });
    const canvasPieces = CANVAS_LAYER.map((k) => map[k]).filter(Boolean);
    const selectedCount = canvasPieces.length;
    this.setData({ slots, canvasPieces, selectedCount });
    this.refreshTips(slots);
    this.applyPickerFilter(this.data.activeCat);
  },

  refreshTips(slots) {
    const pieces = [];
    (slots || []).forEach((s) => {
      if (s.selected) {
        pieces.push({
          ...s.selected,
          slot: s.label,
        });
      }
    });
    const app = getApp();
    const weather = (app && app.globalData && app.globalData.weather) || {};
    const tips = buildOutfitTips(pieces, weather);
    this.setData({ tipsText: tips.text, tipsTags: tips.tags });
  },

  onSwitchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ pageMode: mode });
  },

  onToggleSidebar() {
    this.setData({ sidebarOpen: !this.data.sidebarOpen });
  },

  onSwitchBottom(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ bottomTab: tab });
  },

  onPickCat(e) {
    const id = e.currentTarget.dataset.id;
    this.applyPickerFilter(id);
  },

  onFocusSlot(e) {
    const key = e.currentTarget.dataset.key;
    const map = {
      tops: "tops",
      bottoms: "bottoms",
      shoes: "shoes",
      coats: "coats",
      accessories: "accessories",
    };
    const catId = map[key] || "all";
    this.setData({ pageMode: "canvas", bottomTab: "wardrobe" });
    this.applyPickerFilter(catId);
  },

  onTitle(e) {
    this.setData({ title: e.detail.value });
  },

  assignItem(item) {
    if (!item || !item.id) return;
    const key = slotKeyForCategory(item.category);
    if (!key) {
      wx.showToast({ title: "暂不支持该品类", icon: "none" });
      return;
    }
    const slots = this.data.slots.map((s) => {
      if (s.key !== key) return s;
      return {
        ...s,
        selected: {
          id: item.id,
          name: item.name,
          image: item.image || "",
          color: item.color || "#F5E8D8",
          colorName: item.colorName || "",
          category: item.category,
        },
      };
    });
    this.syncCanvas(slots);
  },

  onAddCloth(e) {
    const id = e.currentTarget.dataset.id;
    const item =
      (this.data.pickerList || []).find((c) => c.id === id) ||
      (this.data.clothes || []).find((c) => c.id === id);
    this.assignItem(item);
  },

  onClearSlot(e) {
    const key = e.currentTarget.dataset.key;
    const slots = this.data.slots.map((s) =>
      s.key === key ? { ...s, selected: null } : s
    );
    this.setData({ activeRecId: "" });
    this.syncCanvas(slots);
  },

  onClearAll() {
    this.setData({ activeRecId: "" });
    this.syncCanvas(emptySlots());
  },

  onApplyRecommend(e) {
    const id = e.currentTarget.dataset.id;
    const card = (this.data.recommendCards || []).find((c) => c.id === id);
    if (!card) return;
    let slots = emptySlots();
    (card.pieces || []).forEach((p) => {
      const key = slotKeyForCategory(p.category) || p.slotKey;
      // pieces from recommend may only have slot label
      const resolved =
        key ||
        (SLOT_DEFS.find((s) => s.label === p.slot) || {}).key;
      if (!resolved) return;
      slots = slots.map((s) =>
        s.key === resolved
          ? {
              ...s,
              selected: {
                id: p.id,
                name: p.name,
                image: p.image || "",
                color: p.color || "#F5E8D8",
                category: p.category || s.categories[0],
              },
            }
          : s
      );
    });
    // recommend pieces might lack category — infer from SLOT by matching clothes
    const clothes = this.data.clothes || [];
    slots = slots.map((s) => {
      if (!s.selected) return s;
      const full = clothes.find((c) => c.id === s.selected.id);
      if (!full) return s;
      return {
        ...s,
        selected: {
          id: full.id,
          name: full.name,
          image: full.image || "",
          color: full.color || "#F5E8D8",
          colorName: full.colorName || "",
          category: full.category,
        },
      };
    });
    this.setData({ activeRecId: id, bottomTab: "recommend", pageMode: "canvas" });
    this.syncCanvas(slots);
    wx.showToast({ title: "已套用推荐", icon: "none" });
  },

  onApplyInspire(e) {
    const id = e.currentTarget.dataset.id;
    const hints = {
      ins_1: { prefer: ["tops", "bottoms"], text: "浅色上装" },
      ins_2: { prefer: ["tops", "bottoms", "shoes"], text: "休闲" },
      ins_3: { prefer: ["tops", "bottoms"], text: "衬衫" },
    };
    const hint = hints[id];
    const clothes = this.data.clothes || [];
    let slots = emptySlots();
    SLOT_DEFS.forEach((def) => {
      if (hint && hint.prefer && hint.prefer.indexOf(def.key) < 0 && def.key !== "shoes") {
        return;
      }
      const pool = clothes.filter((c) => def.categories.indexOf(c.category) >= 0);
      if (!pool.length) return;
      let pick = pool[0];
      if (hint && hint.text) {
        const hit = pool.find((c) => (c.name || "").indexOf(hint.text) >= 0);
        if (hit) pick = hit;
      }
      slots = slots.map((s) =>
        s.key === def.key
          ? {
              ...s,
              selected: {
                id: pick.id,
                name: pick.name,
                image: pick.image || "",
                color: pick.color || "#F5E8D8",
                colorName: pick.colorName || "",
                category: pick.category,
              },
            }
          : s
      );
    });
    this.setData({ bottomTab: "inspire", pageMode: "canvas", activeRecId: "" });
    this.syncCanvas(slots);
    wx.showToast({ title: "已套用灵感方向", icon: "none" });
  },

  collectPieces() {
    const pieces = [];
    (this.data.slots || []).forEach((s) => {
      if (!s.selected) return;
      pieces.push({
        id: s.selected.id,
        name: s.selected.name,
        image: s.selected.image,
        color: s.selected.color,
        category: s.selected.category,
        slot: s.label,
      });
    });
    return pieces;
  },

  persistAndLeave() {
    if (this.data.saving) return;

    const requiredOk = this.data.slots
      .filter((s) => s.required)
      .every((s) => !!s.selected);
    if (!requiredOk) {
      wx.showToast({ title: "请先选上装和下装", icon: "none" });
      return;
    }

    const pieces = this.collectPieces();
    const app = getApp();
    const weather = (app && app.globalData && app.globalData.weather) || {};
    const temp =
      weather.temp != null
        ? `${weather.temp}°C ${weather.condition || ""}`
        : "";
    const tips = buildOutfitTips(pieces, weather);

    this.setData({ saving: true });
    saveCustomOutfit({
      title: this.data.title,
      pieces,
      temp,
      reason: tips.text || "自定义搭配 · 来自你的真实衣橱",
    })
      .then(() => {
        this.setData({ saving: false });
        wx.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => wx.navigateBack({ delta: 1 }), 400);
      })
      .catch((err) => {
        this.setData({ saving: false });
        const msg = err.message || "保存失败";
        if (
          msg.indexOf("COLLECTION_NOT_EXIST") >= 0 ||
          msg.indexOf("not exist") >= 0
        ) {
          wx.showModal({
            title: "可先用本地搭配",
            content:
              "云集合 outfits 未创建时会先保存在本机。也可在云开发控制台创建集合 outfits。",
            showCancel: false,
          });
          return;
        }
        wx.showToast({ title: msg, icon: "none" });
      });
  },

  onSave() {
    this.persistAndLeave();
  },

  onDone() {
    this.persistAndLeave();
  },
});
