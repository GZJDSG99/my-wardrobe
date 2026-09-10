Component({
  data: {
    selected: 0,
    list: [
      { pagePath: "/pages/recommend/recommend", text: "推荐", icon: "✦" },
      { pagePath: "/pages/wardrobe/wardrobe", text: "衣物", icon: "▣" },
      { pagePath: "/pages/weather/weather", text: "天气", icon: "☁" },
      { pagePath: "/pages/profile/profile", text: "我的", icon: "☺" },
    ],
  },
  methods: {
    onSwitch(e) {
      const index = e.currentTarget.dataset.index;
      wx.switchTab({ url: this.data.list[index].pagePath });
    },
  },
});
