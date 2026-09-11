const {
  listClothes,
  buildCategoryStats,
  CATEGORIES,
  deleteCloth,
  setClothIdle,
} = require("../../utils/clothes.js");
const { isLoggedIn, ensureLogin } = require("../../utils/auth.js");
const { syncProfileFromCloud } = require("../../utils/user.js");

const CAT_LABEL = {};
CATEGORIES.forEach((c) => {
  CAT_LABEL[c.id] = c.label;
});

function decorateStack(list) {
  return (list || []).map((item, i) => {
    const tilt = ((i % 5) - 2) * 2.2;
    const lift = (i % 3) * 6;
    return {
      ...item,
      categoryLabel: CAT_LABEL[item.category] || item.category,
      tilt,
      lift,
      z: 10 + i,
      stackStyle: `transform: rotate(${tilt}deg) translateY(${lift}rpx); z-index: ${10 + i};`,
    };
  });
}

function buildShelves(items) {
  const all = items || [];
  return [
    {
      id: "accessories",
      label: "饰品",
      layer: "顶层",
      thin: true,
      items: decorateStack(all.filter((i) => i.category === "accessories")),
    },
    {
      id: "tops",
      label: "上衣",
      layer: "第一层",
      items: decorateStack(
        all.filter((i) => i.category === "tops" || i.category === "coats")
      ),
    },
    {
      id: "bottoms",
      label: "裤装",
      layer: "中间层",
      items: decorateStack(
        all.filter((i) => i.category === "pants" || i.category === "skirts")
      ),
    },
    {
      id: "shoes",
      label: "鞋履",
      layer: "底层",
      items: decorateStack(all.filter((i) => i.category === "shoes")),
    },
  ];
}

Page({
  data: {
    loading: true,
    loggedIn: false,
    logging: false,
    fromCloud: false,
    total: 0,
    items: [],
    shelves: [],
    error: "",
    hintText: "登录后可查看与管理你的云端衣橱。",
    previewShow: false,
    preview: null,
    previewDeleting: false,
    previewIdleBusy: false,
    pageStyle: "",
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1, hidden: !!this.data.previewShow });
    }
    this.loadClothes();
  },

  onHide() {
    if (this.data.previewShow) {
      this.setTabBarHidden(false);
      this.setData({
        previewShow: false,
        preview: null,
        pageStyle: "",
      });
    }
  },

  onPullDownRefresh() {
    if (this.data.previewShow) {
      wx.stopPullDownRefresh();
      return;
    }
    this.loadClothes().finally(() => wx.stopPullDownRefresh());
  },

  loadClothes() {
    const loggedIn = isLoggedIn();
    if (!loggedIn) {
      this.setData({
        loading: false,
        loggedIn: false,
        fromCloud: false,
        items: [],
        shelves: buildShelves([]),
        total: 0,
        error: "",
        hintText: "登录后可查看与管理你的云端衣橱。",
        previewShow: false,
        preview: null,
        pageStyle: "",
      });
      const app = getApp();
      if (app.globalData) app.globalData.realRatio = "0";
      return Promise.resolve();
    }

    this.setData({ loading: true, error: "", loggedIn: true, hintText: "同步云端衣橱…" });
    return listClothes()
      .then((items) => {
        buildCategoryStats(items);
        this.setData({
          loading: false,
          fromCloud: true,
          items,
          total: items.length,
          shelves: buildShelves(items),
          hintText: "左右滑动浏览 · 点击卡片预览",
        });
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
          shelves: buildShelves([]),
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

  onAdd() {
    if (!isLoggedIn()) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/package-closet/add/add" });
  },

  setTabBarHidden(hidden) {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ hidden: !!hidden });
    }
  },

  onPreview(e) {
    const id = e.currentTarget.dataset.id;
    const item = (this.data.items || []).find((x) => x.id === id);
    if (!item) return;
    this.setTabBarHidden(true);
    this.setData({
      previewShow: true,
      pageStyle: "overflow: hidden;",
      preview: {
        ...item,
        categoryLabel: CAT_LABEL[item.category] || item.category,
        brandText: item.brand === "未填品牌" ? "" : item.brand || "",
        idle: !!item.idle,
        idleLabel: item.idle ? "取消闲置" : "闲置",
      },
    });
  },

  onClosePreview() {
    this.setTabBarHidden(false);
    this.setData({ previewShow: false, preview: null, pageStyle: "" });
  },

  onEditPreview() {
    const id = this.data.preview && this.data.preview.id;
    if (!id) return;
    this.setTabBarHidden(false);
    this.setData({ previewShow: false, pageStyle: "" });
    wx.navigateTo({ url: `/package-closet/add/add?id=${id}` });
  },

  onToggleIdlePreview() {
    const preview = this.data.preview;
    if (!preview || !preview.id || this.data.previewIdleBusy) return;
    const nextIdle = !preview.idle;
    this.setData({ previewIdleBusy: true });
    setClothIdle(preview.id, nextIdle)
      .then(() => {
        const items = (this.data.items || []).map((x) =>
          x.id === preview.id ? { ...x, idle: nextIdle } : x
        );
        this.setData({
          previewIdleBusy: false,
          items,
          shelves: buildShelves(items),
          preview: {
            ...preview,
            idle: nextIdle,
            idleLabel: nextIdle ? "取消闲置" : "闲置",
          },
        });
        wx.showToast({
          title: nextIdle ? "已标为闲置" : "已取消闲置",
          icon: "none",
        });
      })
      .catch((err) => {
        this.setData({ previewIdleBusy: false });
        wx.showToast({ title: err.message || "操作失败", icon: "none" });
      });
  },

  onDeletePreview() {
    const preview = this.data.preview;
    if (!preview || !preview.id || this.data.previewDeleting) return;

    wx.showModal({
      title: "删除这件衣物？",
      content: "删除后无法恢复，推荐里也不会再使用它。",
      confirmColor: "#B5695A",
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ previewDeleting: true });
        wx.showLoading({ title: "删除中", mask: true });
        deleteCloth(
          preview.id,
          preview.imageFileId || "",
          preview.originalFileId || ""
        )
          .then(() => {
            wx.hideLoading();
            this.setData({
              previewDeleting: false,
              previewShow: false,
              preview: null,
              pageStyle: "",
            });
            this.setTabBarHidden(false);
            wx.showToast({ title: "已删除", icon: "success" });
            return this.loadClothes();
          })
          .catch((err) => {
            wx.hideLoading();
            this.setData({ previewDeleting: false });
            wx.showToast({ title: err.message || "删除失败", icon: "none" });
          });
      },
    });
  },

  noop() {},
});
