const {
  listClothes,
  buildCategoryStats,
} = require("../../utils/clothes.js");

Page({
  data: {
    loading: true,
    fromCloud: false,
    total: 0,
    activeCategory: "all",
    categories: [
      { id: "all", label: "全部", count: 0 },
      { id: "tops", label: "上衣", count: 0 },
      { id: "pants", label: "裤装", count: 0 },
      { id: "skirts", label: "裙装", count: 0 },
      { id: "coats", label: "外套", count: 0 },
      { id: "shoes", label: "鞋履", count: 0 },
      { id: "accessories", label: "配饰", count: 0 },
    ],
    items: [],
    filtered: [],
    error: "",
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadClothes();
  },

  onPullDownRefresh() {
    this.loadClothes().finally(() => wx.stopPullDownRefresh());
  },

  loadClothes() {
    this.setData({ loading: true, error: "" });
    return listClothes()
      .then((items) => {
        const categories = buildCategoryStats(items);
        this.setData({
          loading: false,
          fromCloud: true,
          items,
          total: items.length,
          categories,
        });
        this.applyFilter(this.data.activeCategory);
        const app = getApp();
        app.globalData.realRatio = `${items.length}/6`;
      })
      .catch((err) => {
        const msg = err.message || "加载失败";
        this.setData({
          loading: false,
          fromCloud: false,
          error: msg,
          items: [],
          total: 0,
          filtered: [],
        });
        if (msg.indexOf("COLLECTION_NOT_EXIST") >= 0 || msg.indexOf("not exist") >= 0) {
          wx.showModal({
            title: "请先创建集合 clothes",
            content:
              "云开发控制台 → 数据库 → 添加集合命名为 clothes，权限选「仅创建者可读写」。",
            showCancel: false,
          });
        }
      });
  },

  applyFilter(id) {
    const filtered =
      id === "all"
        ? this.data.items
        : this.data.items.filter((i) => i.category === id);
    this.setData({ activeCategory: id, filtered });
  },

  onCategory(e) {
    this.applyFilter(e.currentTarget.dataset.id);
  },

  onAdd() {
    wx.navigateTo({ url: "/pages/wardrobe/add" });
  },
});
