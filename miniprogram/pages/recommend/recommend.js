const { buildOutfits } = require("../../utils/recommend.js");
const { getProfile, getStreak } = require("../../utils/user.js");
const { isLoggedIn } = require("../../utils/auth.js");
const { listClothes } = require("../../utils/clothes.js");
const { listCustomOutfits } = require("../../utils/outfit.js");

Page({
  data: {
    weatherTip: "天气加载中…",
    weatherHint: "打开看看",
    streak: 0,
    realRatio: "0",
    stampedId: "",
    loadingRec: true,
    loggedIn: false,
    empty: false,
    emptyTip: "",
    emptySub: "",
    themes: [
      { id: "easy", name: "省事", on: true },
      { id: "energy", name: "元气", on: false },
      { id: "lowkey", name: "低调", on: false },
      { id: "slim", name: "显瘦", on: false },
    ],
    outfits: [],
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    const app = getApp();
    this.setData({
      streak: getStreak() || app.globalData.streak || 0,
      loggedIn: isLoggedIn(),
    });
    this.syncWeatherAndRecommend();
  },

  currentThemeId() {
    const t = this.data.themes.find((x) => x.on);
    return (t && t.id) || "easy";
  },

  loadClothesSafe() {
    if (!isLoggedIn()) return Promise.resolve([]);
    return listClothes().catch(() => []);
  },

  loadCustomSafe() {
    if (!isLoggedIn()) return Promise.resolve([]);
    return listCustomOutfits().catch(() => []);
  },

  rebuildRecommend(weather) {
    const app = getApp();
    const profile = getProfile();
    const loggedIn = isLoggedIn();
    this.setData({ loadingRec: true, loggedIn });

    return Promise.all([this.loadClothesSafe(), this.loadCustomSafe()]).then(
      ([clothes, customs]) => {
        if (!loggedIn) {
          this.setData({
            loadingRec: false,
            outfits: [],
            empty: true,
            emptyTip: "登录后生成穿搭",
            emptySub: "登录并同步衣橱后，将按天气与主题推荐真实单品。",
            realRatio: "0",
            stampedId: "",
          });
          if (app.globalData) app.globalData.realRatio = "0";
          return;
        }

        const result = buildOutfits({
          weather: weather || app.globalData.weather || {},
          themeId: this.currentThemeId(),
          profile,
          clothes,
          count: 2,
        });

        const realRatio = result.realRatio;
        if (app.globalData) app.globalData.realRatio = realRatio;

        const systemOutfits = (result.outfits || []).map((o) => ({
          ...o,
          liked: !!o.liked,
          likeIcon: o.liked ? "♥" : "♡",
          wearLabel: "今天穿这套",
          stamped: false,
          custom: false,
        }));

        const customOutfits = (customs || []).slice(0, 5).map((o) => {
          const tempLabel =
            o.temp ||
            (weather && weather.temp != null
              ? `${weather.temp}°C ${weather.condition || ""}`
              : "");
          return {
            ...o,
            temp: tempLabel,
            liked: false,
            likeIcon: "♡",
            wearLabel: "今天穿这套",
            stamped: false,
            custom: true,
          };
        });

        const outfits = customOutfits.concat(systemOutfits);
        const empty = outfits.length === 0;

        this.setData({
          loadingRec: false,
          outfits,
          empty,
          emptyTip: empty ? result.emptyTip || "还没有可展示的搭配" : "",
          emptySub: empty
            ? result.emptySub || "先添加衣物，或自己组一套搭配。"
            : "",
          realRatio,
          stampedId: "",
        });
      }
    );
  },

  syncWeatherAndRecommend() {
    const app = getApp();
    const cached = app.globalData.weather;
    const cacheAt = app.globalData.weatherAt || 0;
    const fresh = Date.now() - cacheAt < 10 * 60 * 1000;

    if (cached && fresh) {
      this.applyWeather(cached);
      this.rebuildRecommend(cached);
      return;
    }

    const { fetchCurrentWeather, fetchWeatherByLocation } = require("../../utils/weather.js");

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
        this.applyWeather(weather);
        return this.rebuildRecommend(weather);
      })
      .catch(() => {
        if (cached) {
          this.applyWeather(cached);
          this.rebuildRecommend(cached);
        } else {
          this.rebuildRecommend({});
        }
      });
  },

  applyWeather(weather) {
    this.setData({
      weatherTip: weather.weatherTip || `${weather.temp}°C ${weather.condition || ""}`,
      weatherHint: weather.weatherHint || "打开看看",
    });
  },

  onToggleLike(e) {
    const id = e.currentTarget.dataset.id;
    const outfits = this.data.outfits.map((o) => {
      if (o.id !== id) return o;
      const liked = !o.liked;
      return { ...o, liked, likeIcon: liked ? "♥" : "♡" };
    });
    this.setData({ outfits });
  },

  onPickTheme(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      themes: this.data.themes.map((t) => ({ ...t, on: t.id === id })),
      stampedId: "",
    });
    const app = getApp();
    this.rebuildRecommend(app.globalData.weather || {});
  },

  onCustom() {
    if (!isLoggedIn()) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/recommend/custom" });
  },

  onWear(e) {
    const id = e.currentTarget.dataset.id;
    const app = getApp();
    const outfit = this.data.outfits.find((o) => o.id === id);
    const theme = (this.data.themes.find((t) => t.on) || {}).name || "";

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
            theme: outfit.custom ? "自定义" : theme,
          });
        }
        this.setData({ streak });
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

    this.setData({
      stampedId: id,
      outfits: this.data.outfits.map((o) => ({
        ...o,
        stamped: o.id === id,
        wearLabel: o.id === id ? "已采纳" : "今天穿这套",
      })),
    });
    wx.vibrateShort({ type: "light" });
    wx.showToast({ title: "已记下今天这套", icon: "none" });
  },

  onGoWeather() {
    wx.switchTab({ url: "/pages/weather/weather" });
  },

  onGoWardrobe() {
    wx.switchTab({ url: "/pages/wardrobe/wardrobe" });
  },

  onGoLogin() {
    wx.switchTab({ url: "/pages/profile/profile" });
  },
});
