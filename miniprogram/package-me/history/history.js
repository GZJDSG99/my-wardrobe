const { getWears, getStreak } = require("../../utils/user.js");

Page({
  data: {
    list: [],
    streak: 0,
  },

  onShow() {
    const list = getWears().map((w) => ({
      ...w,
      dateText: formatTime(w.createdAt),
    }));
    this.setData({
      list,
      streak: getStreak(),
    });
  },

  onGoRecommend() {
    wx.switchTab({ url: "/pages/recommend/recommend" });
  },
});

function formatTime(ts) {
  const d = new Date(ts);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  return `${m}月${day}日 ${hh}:${mm}`;
}
