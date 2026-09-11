const {
  getProfile,
  saveProfile,
  syncProfileFromCloud,
  pushProfileToCloud,
  CITY_OPTIONS,
} = require("../../utils/user.js");
const {
  ensureLogin,
  isLoggedIn,
  maskOpenId,
  getCachedOpenId,
  logoutLocal,
} = require("../../utils/auth.js");

Page({
  data: {
    cities: CITY_OPTIONS,
    cityQuery: "Hangzhou",
    cityName: "杭州",
    loggedIn: false,
    openidMask: "",
    logging: false,
  },

  onShow() {
    const profile = getProfile();
    this.setData({
      cityQuery: profile.cityQuery || "Hangzhou",
      cityName: profile.cityName || "杭州",
      loggedIn: isLoggedIn(),
      openidMask: maskOpenId(getCachedOpenId()),
    });
  },

  onLogin() {
    if (this.data.logging) return;
    this.setData({ logging: true });
    ensureLogin(true)
      .then(() => syncProfileFromCloud())
      .then(() => {
        this.setData({
          logging: false,
          loggedIn: true,
          openidMask: maskOpenId(getCachedOpenId()),
        });
        wx.showToast({ title: "登录成功", icon: "success" });
      })
      .catch((err) => {
        this.setData({ logging: false });
        wx.showModal({
          title: "登录失败",
          content: err.message || "请先部署云函数 login",
          showCancel: false,
        });
      });
  },

  onLogout() {
    wx.showModal({
      title: "退出登录？",
      content: "仅清除本地登录态，云端衣物仍保留在你的微信账号下。",
      success: (res) => {
        if (!res.confirm) return;
        logoutLocal();
        this.setData({ loggedIn: false, openidMask: "" });
        wx.showToast({ title: "已退出", icon: "none" });
      },
    });
  },

  onPickCity(e) {
    const query = e.currentTarget.dataset.query;
    const name = e.currentTarget.dataset.name;
    saveProfile({ cityQuery: query, cityName: name });
    if (isLoggedIn()) pushProfileToCloud(getProfile());
    const app = getApp();
    app.globalData.cityQuery = query;
    app.globalData.city = name;
    app.globalData.useLocation = false;
    app.globalData.location = null;
    app.globalData.weatherAt = 0;
    this.setData({ cityQuery: query, cityName: name });
    wx.showToast({ title: `默认城市：${name}`, icon: "none" });
  },

  onOpenPrivacy() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({
        fail: () => wx.showToast({ title: "暂无法打开隐私协议", icon: "none" }),
      });
    } else {
      wx.showToast({ title: "请在小程序设置中查看隐私", icon: "none" });
    }
  },

  onClearCache() {
    wx.showModal({
      title: "清除本地缓存？",
      content: "不会删除云端衣物，但会清空本地穿搭历史、打卡与偏好。登录态会保留。",
      success: (res) => {
        if (!res.confirm) return;
        try {
          wx.removeStorageSync("mw_wears");
          wx.removeStorageSync("mw_favs");
          wx.removeStorageSync("mw_checkins");
          wx.removeStorageSync("mw_profile");
          wx.removeStorageSync("mw_streak");
        } catch (e) {}
        const app = getApp();
        app.globalData.streak = 0;
        app.globalData.weatherAt = 0;
        wx.showToast({ title: "已清除", icon: "success" });
        this.onShow();
      },
    });
  },

  onAbout() {
    wx.showModal({
      title: "Dresia",
      content:
        "Open Your Closet. Discover Your Style.\n打开衣橱，发现更多风格\n\n今日穿搭操作系统 · 天气 Open-Meteo · 数据云开发",
      showCancel: false,
    });
  },
});
