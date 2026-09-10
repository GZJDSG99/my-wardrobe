const {
  CATEGORIES,
  COLOR_PRESETS,
  chooseClothImage,
  compressImage,
  uploadClothImage,
  addCloth,
} = require("../../utils/clothes.js");

Page({
  data: {
    tempPath: "",
    name: "",
    brand: "",
    category: "tops",
    categories: CATEGORIES,
    colors: COLOR_PRESETS,
    colorIndex: 0,
    seasons: [
      { id: "春", on: true },
      { id: "夏", on: false },
      { id: "秋", on: true },
      { id: "冬", on: false },
    ],
    saving: false,
  },

  onChooseImage() {
    chooseClothImage()
      .then((path) => compressImage(path))
      .then((path) => {
        this.setData({ tempPath: path });
      })
      .catch((err) => {
        if (err.message === "cancel") return;
        wx.showToast({ title: err.message || "选图失败", icon: "none" });
      });
  },

  onInputName(e) {
    this.setData({ name: e.detail.value });
  },

  onInputBrand(e) {
    this.setData({ brand: e.detail.value });
  },

  onPickCategory(e) {
    this.setData({ category: e.currentTarget.dataset.id });
  },

  onPickColor(e) {
    this.setData({ colorIndex: Number(e.currentTarget.dataset.index) || 0 });
  },

  onToggleSeason(e) {
    const id = e.currentTarget.dataset.id;
    const seasons = this.data.seasons.map((s) =>
      s.id === id ? { ...s, on: !s.on } : s
    );
    this.setData({ seasons });
  },

  onSave() {
    if (this.data.saving) return;

    const name = (this.data.name || "").trim();
    if (!this.data.tempPath) {
      wx.showToast({ title: "请先拍照或选图", icon: "none" });
      return;
    }
    if (!name) {
      wx.showToast({ title: "请填写名称", icon: "none" });
      return;
    }

    const color = this.data.colors[this.data.colorIndex] || this.data.colors[0];
    const season = this.data.seasons.filter((s) => s.on).map((s) => s.id);

    this.setData({ saving: true });
    wx.showLoading({ title: "上传中", mask: true });

    uploadClothImage(this.data.tempPath)
      .then((fileID) =>
        addCloth({
          name,
          category: this.data.category,
          color: color.value,
          colorName: color.name,
          brand: (this.data.brand || "").trim(),
          season,
          imageFileId: fileID,
        })
      )
      .then(() => {
        wx.hideLoading();
        this.setData({ saving: false });
        wx.showToast({ title: "已入库", icon: "success" });
        setTimeout(() => {
          wx.navigateBack({ delta: 1 });
        }, 500);
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ saving: false });
        const msg = err.message || "保存失败";
        // 常见：集合不存在
        if (msg.indexOf("COLLECTION_NOT_EXIST") >= 0 || msg.indexOf("not exist") >= 0) {
          wx.showModal({
            title: "需要创建数据库集合",
            content:
              "请在云开发控制台创建集合 clothes，权限选「仅创建者可读写」，然后重试。",
            showCancel: false,
          });
          return;
        }
        wx.showToast({ title: msg, icon: "none" });
      });
  },
});
