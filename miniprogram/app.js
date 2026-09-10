App({
  onLaunch() {
    this.initCloud();
    this.hydrateUser();
    this.loadFonts();
    this.silentLogin();
  },

  initCloud() {
    if (!wx.cloud) {
      console.warn("当前基础库不支持云开发");
      return;
    }
    wx.cloud.init({
      env: "cloud1-4g0p7z3p8c0a5b52",
      traceUser: true,
    });
  },

  hydrateUser() {
    try {
      const { getProfile, getStreak } = require("./utils/user.js");
      const { getCachedOpenId, isLoggedIn } = require("./utils/auth.js");
      const profile = getProfile();
      this.globalData.streak = getStreak();
      this.globalData.openid = getCachedOpenId();
      this.globalData.isLoggedIn = isLoggedIn();
      if (profile.cityQuery) this.globalData.cityQuery = profile.cityQuery;
      if (profile.cityName) this.globalData.city = profile.cityName;
    } catch (e) {}
  },

  silentLogin() {
    try {
      const { ensureLogin, isLoggedIn } = require("./utils/auth.js");
      // 仅刷新已有登录态；未登录需用户主动点登录，衣橱才可见
      if (!isLoggedIn()) return;
      ensureLogin(false)
        .then(() => {
          const { syncProfileFromCloud } = require("./utils/user.js");
          return syncProfileFromCloud();
        })
        .catch((err) => {
          console.warn("静默登录失败", err && err.message);
        });
    } catch (e) {}
  },

  loadFonts() {
    if (!wx.loadFontFace) return;
    const fonts = [
      {
        family: "Playfair Display",
        source:
          'url("https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@5.2.5/latin-600-normal.woff2")',
      },
      {
        family: "DM Sans",
        source:
          'url("https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@5.2.5/latin-400-normal.woff2")',
      },
    ];
    fonts.forEach((f) => {
      wx.loadFontFace({
        family: f.family,
        source: f.source,
        global: true,
        fail() {},
      });
    });
  },

  globalData: {
    designSource:
      "https://www.figma.com/make/OWWTwv81fZtOwkokyXg0ZY/",
    cloudEnv: "cloud1-4g0p7z3p8c0a5b52",
    openid: "",
    appid: "",
    isLoggedIn: false,
    city: "杭州",
    cityQuery: "Hangzhou",
    useLocation: false,
    location: null,
    weather: null,
    weatherAt: 0,
    streak: 0,
    realRatio: "2/6",
  },
});
