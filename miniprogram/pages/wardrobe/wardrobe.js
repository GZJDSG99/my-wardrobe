const {
  listClothes,
  buildCategoryStats,
} = require("../../utils/clothes.js");
const { isLoggedIn, ensureLogin } = require("../../utils/auth.js");
const { syncProfileFromCloud } = require("../../utils/user.js");

Page({
  data: {
    loading: true,
    loggedIn: false,
    logging: false,
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
    hintText: "登录后可查看与管理你的云端衣橱。",
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

  emptyCategories() {
    return [
      { id: "all", label: "全部", count: 0 },
      { id: "tops", label: "上衣", count: 0 },
      { id: "pants", label: "裤装", count: 0 },
      { id: "skirts", label: "裙装", count: 0 },
      { id: "coats", label: "外套", count: 0 },
      { id: "shoes", label: "鞋履", count: 0 },
      { id: "accessories", label: "配饰", count: 0 },
    ];
  },

  updateHint(loggedIn, loading, fromCloud) {
    let hintText = "登录后可查看与管理你的云端衣橱。";
    if (loggedIn) {
      if (loading) hintText = "同步云端衣橱…";
      else if (fromCloud) hintText = "点击单品可编辑或删除。";
      else hintText = "云端暂不可用，登录后可再试。";
    }
    this.setData({ hintText });
  },

  loadClothes() {
    const loggedIn = isLoggedIn();
    if (!loggedIn) {
      this.setData({
        loading: false,
        loggedIn: false,
        fromCloud: false,
        items: [],
        filtered: [],
        total: 0,
        categories: this.emptyCategories(),
        error: "",
        hintText: "登录后可查看与管理你的云端衣橱。",
      });
      const app = getApp();
      if (app.globalData) app.globalData.realRatio = "0";
      return Promise.resolve();
    }

    this.setData({ loading: true, error: "", loggedIn: true });
    this.updateHint(true, true, false);
    return listClothes()
      .then((items) => {
        const categories = buildCategoryStats(items);
        this.setData({
          loading: false,
          fromCloud: true,
          items,
          total: items.length,
          categories,
          hintText: "点击单品可编辑或删除。",
        });
        this.applyFilter(this.data.activeCategory);
        const app = getApp();
        app.globalData.realRatio = `${items.length}`;
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
          categories: this.emptyCategories(),
          hintText: "云端暂不可用，登录后可再试。",
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

  onLogin() {
    if (this.data.logging) return;
    this.setData({ logging: true });
    ensureLogin(true)
      .then(() => syncProfileFromCloud())
      .then(() => {
        this.setData({ logging: false, loggedIn: true });
        wx.showToast({ title: "登录成功", icon: "success" });
        return this.loadClothes();
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
    if (!isLoggedIn()) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/wardrobe/add" });
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/wardrobe/add?id=${id}` });
  },
});
