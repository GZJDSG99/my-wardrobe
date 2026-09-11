const {
  getProfile,
  getWears,
  getFavorites,
  calcHealth,
  getStreak,
  syncProfileFromCloud,
  isProfileComplete,
} = require("../../utils/user.js");
const {
  ensureLogin,
  isLoggedIn,
  maskOpenId,
  getCachedOpenId,
} = require("../../utils/auth.js");
const { listClothes } = require("../../utils/clothes.js");

Page({
  data: {
    name: "衣橱用户",
    styles: "完善风格偏好",
    avatar: "",
    hasAvatar: false,
    loggedIn: false,
    openidMask: "",
    logging: false,
    stats: [
      { label: "衣物", value: 0 },
      { label: "穿搭", value: 0 },
      { label: "收藏", value: 0 },
    ],
    health: 45,
    healthTip: "加载中…",
    streak: 0,
    menus: [
      {
        id: "history",
        label: "穿搭历史",
        sub: "连续出门与每日采纳记录",
        icon: "★",
        url: "/package-me/history/history",
      },
      {
        id: "care",
        label: "衣物护理",
        sub: "洗涤提醒、换季收纳、断舍离",
        icon: "♨",
        url: "/package-me/care/care",
      },
      {
        id: "inspire",
        label: "灵感打卡",
        sub: "私密打卡与周主题收藏",
        icon: "♡",
        url: "/package-me/inspire/inspire",
      },
      {
        id: "pref",
        label: "风格偏好",
        sub: "场景与主题画像",
        icon: "◎",
        url: "/package-me/pref/pref",
      },
      {
        id: "vip",
        label: "会员权益",
        sub: "识别额度与高级推荐",
        icon: "◆",
        url: "/package-me/vip/vip",
      },
      {
        id: "settings",
        label: "设置",
        sub: "城市、通知、关于",
        icon: "⚙",
        url: "/package-me/settings/settings",
      },
    ],
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.refresh();
  },

  refresh() {
    const profile = getProfile();
    const wears = getWears();
    const favs = getFavorites();
    const streak = getStreak();
    const loggedIn = isLoggedIn();

    const styleText =
      profile.styles && profile.styles.length
        ? profile.styles.join(" · ")
        : "完善风格偏好";

    this.setData({
      name: profile.nickName || "衣橱用户",
      styles: styleText,
      avatar: profile.avatarUrl || "",
      hasAvatar: !!profile.avatarUrl,
      loggedIn,
      openidMask: maskOpenId(getCachedOpenId()),
      streak,
      stats: [
        { label: "衣物", value: loggedIn ? "…" : 0 },
        { label: "穿搭", value: wears.length },
        { label: "收藏", value: favs.length },
      ],
    });

    if (!loggedIn) {
      const health = calcHealth([]);
      this.setData({
        health: health.score,
        healthTip: "登录后可同步衣橱健康度",
      });
      return;
    }

    listClothes()
      .then((clothes) => {
        const health = calcHealth(clothes);
        const app = getApp();
        this.setData({
          stats: [
            { label: "衣物", value: clothes.length },
            { label: "穿搭", value: wears.length },
            { label: "收藏", value: favs.length },
          ],
          health: health.score,
          healthTip: health.tip,
        });
        if (app.globalData) {
          app.globalData.realRatio = `${clothes.length}/6`;
        }
      })
      .catch(() => {
        const health = calcHealth([]);
        this.setData({
          stats: [
            { label: "衣物", value: 0 },
            { label: "穿搭", value: wears.length },
            { label: "收藏", value: favs.length },
          ],
          health: health.score,
          healthTip: health.tip,
        });
      });
  },

  onLogin() {
    if (this.data.logging) return;
    this.setData({ logging: true });
    ensureLogin(true)
      .then(() => syncProfileFromCloud())
      .then((profile) => {
        this.setData({ logging: false });
        this.refresh();
        wx.showToast({ title: "登录成功", icon: "success" });
        if (!isProfileComplete(profile)) {
          setTimeout(() => {
            wx.navigateTo({ url: "/package-me/pref/pref" });
          }, 400);
        }
      })
      .catch((err) => {
        this.setData({ logging: false });
        wx.showModal({
          title: "登录失败",
          content: err.message || "请确认已部署云函数 login",
          showCancel: false,
        });
      });
  },

  onEditProfile() {
    if (!isLoggedIn()) {
      this.onLogin();
      return;
    }
    wx.navigateTo({ url: "/package-me/pref/pref" });
  },

  onOpenSettings() {
    wx.navigateTo({ url: "/package-me/settings/settings" });
  },

  onMenu(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({ url });
    }
  },
});
