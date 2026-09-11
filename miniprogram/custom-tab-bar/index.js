Component({
  data: {
    selected: 0,
    hidden: false,
    list: [
      {
        pagePath: "/pages/recommend/recommend",
        text: "首页",
        icon: "/assets/tab/sparkles.png",
        iconActive: "/assets/tab/sparkles-active.png",
      },
      {
        pagePath: "/pages/wardrobe/wardrobe",
        text: "衣橱",
        icon: "/assets/tab/shirt.png",
        iconActive: "/assets/tab/shirt-active.png",
      },
      {
        pagePath: "/pages/weather/weather",
        text: "天气",
        icon: "/assets/tab/cloud-sun.png",
        iconActive: "/assets/tab/cloud-sun-active.png",
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        icon: "/assets/tab/user.png",
        iconActive: "/assets/tab/user-active.png",
      },
    ],
  },
  methods: {
    onSwitch(e) {
      const index = e.currentTarget.dataset.index;
      wx.switchTab({ url: this.data.list[index].pagePath });
    },
  },
});
