const {
  fetchCurrentWeather,
  fetchWeatherByLocation,
} = require("../../utils/weather.js");
const { getUserLocation, openLocationSetting } = require("../../utils/location.js");

Page({
  data: {
    loading: true,
    locating: false,
    error: "",
    city: "杭州",
    date: "",
    temp: "--",
    condition: "加载中",
    humidity: "--",
    wind: "--",
    uv: "--",
    emoji: "☁",
    suggestion: "",
    tips: [],
    details: [],
    forecast: [],
    fromLocation: false,
    cityOptions: [
      { name: "杭州", query: "Hangzhou" },
      { name: "上海", query: "Shanghai" },
      { name: "北京", query: "Beijing" },
      { name: "广州", query: "Guangzhou" },
      { name: "深圳", query: "Shenzhen" },
      { name: "成都", query: "Chengdu" },
    ],
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadWeather();
  },

  onPullDownRefresh() {
    this.loadWeather(true).finally(() => wx.stopPullDownRefresh());
  },

  loadWeather(force) {
    const app = getApp();
    const cached = app.globalData.weather;
    const cacheAt = app.globalData.weatherAt || 0;
    const fresh = Date.now() - cacheAt < 10 * 60 * 1000;

    if (!force && cached && fresh) {
      this.applyWeather(cached);
      return Promise.resolve(cached);
    }

    this.setData({ loading: true, error: "" });

    // 若用户已用定位，优先继续用坐标刷新
    if (app.globalData.useLocation && app.globalData.location) {
      const { latitude, longitude } = app.globalData.location;
      return fetchWeatherByLocation(latitude, longitude, app.globalData.city)
        .then((weather) => this.saveWeather(weather))
        .catch((err) => this.handleWeatherError(err, cached));
    }

    const query = app.globalData.cityQuery || "Hangzhou";
    return fetchCurrentWeather(query)
      .then((weather) => this.saveWeather(weather))
      .catch((err) => this.handleWeatherError(err, cached));
  },

  saveWeather(weather) {
    const app = getApp();
    app.globalData.weather = weather;
    app.globalData.weatherAt = Date.now();
    app.globalData.city = weather.city;
    this.applyWeather(weather);
    return weather;
  },

  handleWeatherError(err, cached) {
    this.setData({
      loading: false,
      locating: false,
      error: err.message || "天气加载失败",
    });
    if (!cached) {
      wx.showToast({ title: "天气加载失败", icon: "none" });
    } else {
      this.applyWeather(cached);
    }
  },

  applyWeather(weather) {
    this.setData({
      loading: false,
      locating: false,
      error: "",
      city: weather.city,
      date: weather.date,
      temp: weather.temp,
      condition: weather.condition,
      humidity: weather.humidity,
      wind: weather.wind,
      uv: weather.uv,
      emoji: weather.emoji || "☁",
      suggestion: weather.suggestion,
      tips: weather.tips,
      details: weather.details,
      forecast: weather.forecast || [],
      fromLocation: !!weather.fromLocation,
    });
  },

  onLocate() {
    if (this.data.locating) return;
    this.setData({ locating: true });

    getUserLocation()
      .then((loc) => {
        const app = getApp();
        app.globalData.useLocation = true;
        app.globalData.location = loc;
        app.globalData.weatherAt = 0;
        return fetchWeatherByLocation(loc.latitude, loc.longitude);
      })
      .then((weather) => {
        this.saveWeather(weather);
        wx.showToast({ title: `已切换到${weather.city}`, icon: "none" });
      })
      .catch((err) => {
        this.setData({ locating: false });
        const msg = err.message || "定位失败";
        if (msg.indexOf("权限") >= 0 && msg.indexOf("后台") < 0 && msg.indexOf("隐私") < 0) {
          openLocationSetting().then((ok) => {
            if (ok) this.onLocate();
          });
          return;
        }
        // 定位失败时，降级为城市选择
        wx.showActionSheet({
          itemList: this.data.cityOptions.map((c) => c.name),
          success: (res) => {
            const item = this.data.cityOptions[res.tapIndex];
            if (!item) return;
            this.onPickCity({
              currentTarget: {
                dataset: { query: item.query, name: item.name },
              },
            });
          },
          fail: () => {
            wx.showToast({ title: msg, icon: "none" });
          },
        });
      });
  },

  onPickCity(e) {
    const query = e.currentTarget.dataset.query;
    const name = e.currentTarget.dataset.name;
    if (!query) return;
    const app = getApp();
    app.globalData.useLocation = false;
    app.globalData.location = null;
    app.globalData.cityQuery = query;
    app.globalData.weatherAt = 0;
    this.setData({ loading: true });
    fetchCurrentWeather(query)
      .then((weather) => {
        this.saveWeather(weather);
        wx.showToast({ title: `已切换到${weather.city || name}`, icon: "none" });
      })
      .catch((err) => this.handleWeatherError(err, app.globalData.weather));
  },

  onResetHangzhou() {
    this.onPickCity({
      currentTarget: { dataset: { query: "Hangzhou", name: "杭州" } },
    });
  },

  onGenerate() {
    wx.switchTab({ url: "/pages/recommend/recommend" });
  },

  onRetry() {
    this.loadWeather(true);
  },
});
