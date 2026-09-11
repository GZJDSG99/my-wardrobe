const {
  getCheckins,
  addCheckin,
  getFavorites,
  toggleFavorite,
} = require("../../utils/user.js");

Page({
  data: {
    weekTheme: "层次感周",
    text: "",
    moods: [
      { id: "日常", on: true },
      { id: "正式", on: false },
      { id: "轻松", on: false },
      { id: "约会", on: false },
    ],
    checkins: [],
    favs: [],
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const checkins = getCheckins().map((c) => ({
      ...c,
      dateText: formatTime(c.createdAt),
    }));
    const favs = getFavorites();
    this.setData({ checkins, favs });
  },

  onInput(e) {
    this.setData({ text: e.detail.value });
  },

  onMood(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      moods: this.data.moods.map((m) => ({ ...m, on: m.id === id })),
    });
  },

  onSubmit() {
    const text = (this.data.text || "").trim();
    if (!text) {
      wx.showToast({ title: "写一句今日感受吧", icon: "none" });
      return;
    }
    const mood = (this.data.moods.find((m) => m.on) || {}).id || "日常";
    addCheckin({ text, mood });
    this.setData({ text: "" });
    this.refresh();
    wx.showToast({ title: "已打卡", icon: "success" });
  },

  onSaveTheme() {
    const res = toggleFavorite({
      id: "week_theme",
      title: this.data.weekTheme,
      image: "",
    });
    this.setData({ favs: res.list });
    wx.showToast({
      title: res.liked ? "已收藏周主题" : "已取消收藏",
      icon: "none",
    });
  },

  onGoRecommend() {
    wx.switchTab({ url: "/pages/recommend/recommend" });
  },
});

function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}
