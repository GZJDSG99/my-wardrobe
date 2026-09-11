Page({
  data: {
    phase: "in",
    leaving: false,
  },

  onLoad() {
    this._entered = false;
    setTimeout(() => {
      if (!this._entered) this.setData({ phase: "idle" });
    }, 1150);
  },

  onEnter() {
    if (this._entered) return;
    this._entered = true;
    this.setData({ phase: "out", leaving: true });
    setTimeout(() => {
      wx.switchTab({ url: "/pages/recommend/recommend" });
    }, 660);
  },
});
