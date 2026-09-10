const { listClothes } = require("../../utils/clothes.js");
const { SLOT_DEFS, saveCustomOutfit } = require("../../utils/outfit.js");
const { isLoggedIn, ensureLogin } = require("../../utils/auth.js");

function emptySlots() {
  return SLOT_DEFS.map((s) => ({
    key: s.key,
    label: s.label,
    required: s.required,
    categories: s.categories,
    options: [],
    selected: null,
  }));
}

Page({
  data: {
    title: "",
    slots: emptySlots(),
    previewPieces: [],
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
              this.loadClothes();
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
    this.loadClothes();
  },

  loadClothes() {
    wx.showLoading({ title: "加载衣橱", mask: true });
    listClothes()
      .then((clothes) => {
        wx.hideLoading();
        const slots = SLOT_DEFS.map((s) => ({
          key: s.key,
          label: s.label,
          required: s.required,
          categories: s.categories,
          selected: null,
          options: clothes.filter((c) => s.categories.indexOf(c.category) >= 0),
        }));
        this.setData({ slots, previewPieces: [] });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: err.message || "加载失败", icon: "none" });
      });
  },

  onTitle(e) {
    this.setData({ title: e.detail.value });
  },

  refreshPreview(slots) {
    const previewPieces = [];
    slots.forEach((s) => {
      if (!s.selected) return;
      previewPieces.push({
        id: s.selected.id,
        name: s.selected.name,
        image: s.selected.image || "",
        color: s.selected.color || "#F5E8D8",
        slot: s.label,
        category: s.selected.category,
      });
    });
    this.setData({ slots, previewPieces });
  },

  onPick(e) {
    const key = e.currentTarget.dataset.key;
    const id = e.currentTarget.dataset.id;
    const slots = this.data.slots.map((s) => {
      if (s.key !== key) return s;
      const opt = (s.options || []).find((o) => o.id === id);
      if (!opt) return s;
      return {
        ...s,
        selected: {
          id: opt.id,
          name: opt.name,
          image: opt.image || "",
          color: opt.color || "#F5E8D8",
          category: opt.category,
        },
      };
    });
    this.refreshPreview(slots);
  },

  onClearSlot(e) {
    const key = e.currentTarget.dataset.key;
    const slots = this.data.slots.map((s) =>
      s.key === key ? { ...s, selected: null } : s
    );
    this.refreshPreview(slots);
  },

  onSave() {
    if (this.data.saving) return;

    const requiredOk = this.data.slots
      .filter((s) => s.required)
      .every((s) => !!s.selected);
    if (!requiredOk) {
      wx.showToast({ title: "请先选上装和下装", icon: "none" });
      return;
    }

    const pieces = this.data.previewPieces.map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      color: p.color,
      category: p.category,
      slot: p.slot,
    }));

    const app = getApp();
    const weather = (app && app.globalData && app.globalData.weather) || {};
    const temp =
      weather.temp != null
        ? `${weather.temp}°C ${weather.condition || ""}`
        : "";

    this.setData({ saving: true });
    saveCustomOutfit({
      title: this.data.title,
      pieces,
      temp,
      reason: "自定义搭配 · 来自你的真实衣橱",
    })
      .then(() => {
        this.setData({ saving: false });
        wx.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => wx.navigateBack({ delta: 1 }), 400);
      })
      .catch((err) => {
        this.setData({ saving: false });
        const msg = err.message || "保存失败";
        if (msg.indexOf("COLLECTION_NOT_EXIST") >= 0 || msg.indexOf("not exist") >= 0) {
          wx.showModal({
            title: "可先用本地搭配",
            content:
              "云集合 outfits 未创建时会先保存在本机。也可在云开发控制台创建集合 outfits（仅创建者可读写）。",
            showCancel: false,
          });
          return;
        }
        wx.showToast({ title: msg, icon: "none" });
      });
  },
});
