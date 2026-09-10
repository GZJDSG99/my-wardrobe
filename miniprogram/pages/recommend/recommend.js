Page({
  data: {
    dateLabel: "今日穿搭",
    weatherTip: "天气加载中…",
    weatherHint: "打开看看",
    streak: 3,
    realRatio: "2/6",
    stampedId: 0,
    themes: [
      { id: "easy", name: "省事", on: true },
      { id: "energy", name: "元气", on: false },
      { id: "lowkey", name: "低调", on: false },
      { id: "slim", name: "显瘦", on: false },
    ],
    outfits: [
      {
        id: 1,
        title: "法式慵懒风",
        subtitle: "今日最佳穿搭",
        temp: "适温",
        reason: "正在根据实时天气生成理由…",
        items: ["奶油白针织衫", "直筒牛仔裤", "棕色乐福鞋"],
        tags: ["通勤", "约会"],
        liked: false,
        image:
          "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=1000&fit=crop&auto=format",
      },
      {
        id: 2,
        title: "极简主义",
        subtitle: "周末出行备用",
        temp: "适温",
        reason: "轻便备用方案，适合短途出门。",
        items: ["黑色圆领卫衣", "卡其色阔腿裤", "白色小白鞋"],
        tags: ["休闲", "购物"],
        liked: true,
        image:
          "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=1000&fit=crop&auto=format",
      },
    ],
    styles: [
      {
        label: "极简",
        img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=320&h=400&fit=crop&auto=format",
      },
      {
        label: "复古",
        img: "https://images.unsplash.com/photo-1475180098004-ca77a66827be?w=320&h=400&fit=crop&auto=format",
      },
      {
        label: "街头",
        img: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=320&h=400&fit=crop&auto=format",
      },
    ],
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    const app = getApp();
    this.setData({
      streak: app.globalData.streak || 3,
      realRatio: app.globalData.realRatio || "2/6",
    });
    this.syncWeather();
  },

  syncWeather() {
    const app = getApp();
    const cached = app.globalData.weather;
    const cacheAt = app.globalData.weatherAt || 0;
    const fresh = Date.now() - cacheAt < 10 * 60 * 1000;

    if (cached && fresh) {
      this.applyWeather(cached);
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
      })
      .catch(() => {
        if (cached) this.applyWeather(cached);
      });
  },

  applyWeather(weather) {
    const tempLabel = `${weather.temp}°C ${weather.condition}`;
    const outfits = this.data.outfits.map((o, idx) => {
      if (idx === 0) {
        return {
          ...o,
          temp: tempLabel,
          reason: weather.suggestion,
          subtitle: "基于实时天气",
        };
      }
      return {
        ...o,
        temp: tempLabel,
        reason: `备用方案：${weather.weatherHint}，可少一层或换更轻便单品。`,
      };
    });

    this.setData({
      dateLabel: weather.dateEyebrow,
      weatherTip: weather.weatherTip,
      weatherHint: weather.weatherHint,
      outfits,
    });
  },

  onToggleLike(e) {
    const id = e.currentTarget.dataset.id;
    const outfits = this.data.outfits.map((o) =>
      o.id === id ? { ...o, liked: !o.liked } : o
    );
    this.setData({ outfits });
  },

  onPickTheme(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      themes: this.data.themes.map((t) => ({ ...t, on: t.id === id })),
      stampedId: 0,
    });
  },

  onWear(e) {
    const id = e.currentTarget.dataset.id;
    const app = getApp();
    const outfit = this.data.outfits.find((o) => o.id === id);
    const theme = (this.data.themes.find((t) => t.on) || {}).name || "";

    if (this.data.stampedId !== id) {
      try {
        const { bumpStreak, addWear } = require("../../utils/user.js");
        app.globalData.streak = bumpStreak();
        if (outfit) {
          addWear({
            title: outfit.title,
            reason: outfit.reason,
            temp: outfit.temp,
            items: outfit.items,
            image: outfit.image,
            theme,
          });
        }
      } catch (err) {
        app.globalData.streak = (app.globalData.streak || 0) + 1;
      }
    }

    this.setData({
      stampedId: id,
      streak: app.globalData.streak,
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
});
