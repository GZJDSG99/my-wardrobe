const {
  CATEGORIES,
  COLOR_PRESETS,
  chooseClothImage,
  compressImage,
  uploadClothImageWithCutout,
  addCloth,
  getCloth,
  updateCloth,
  deleteCloth,
} = require("../../utils/clothes.js");
const { isLoggedIn, ensureLogin } = require("../../utils/auth.js");

Page({
  data: {
    mode: "add",
    clothId: "",
    imageFileId: "",
    originalFileId: "",
    imageChanged: false,
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
    deleting: false,
    loading: false,
    isEdit: false,
    saveLabel: "保存入库",
  },

  onLoad(query) {
    const id = (query && query.id) || "";
    if (id) {
      this.setData({
        mode: "edit",
        isEdit: true,
        clothId: id,
        loading: true,
        saveLabel: "保存修改",
      });
      wx.setNavigationBarTitle({ title: "编辑单品" });
    } else {
      this.setData({
        mode: "add",
        isEdit: false,
        saveLabel: "保存入库",
      });
      wx.setNavigationBarTitle({ title: "添加单品" });
    }

    if (!isLoggedIn()) {
      wx.showModal({
        title: "请先登录",
        content: "登录后才能管理你的云端衣橱。",
        confirmText: "去登录",
        success: (res) => {
          if (!res.confirm) {
            wx.navigateBack({ delta: 1 });
            return;
          }
          ensureLogin(true)
            .then(() => {
              wx.showToast({ title: "登录成功", icon: "success" });
              if (id) this.loadCloth(id);
            })
            .catch((err) => {
              wx.showModal({
                title: "登录失败",
                content: err.message || "请确认已部署云函数 login",
                showCancel: false,
                complete: () => wx.navigateBack({ delta: 1 }),
              });
            });
        },
      });
      return;
    }

    if (id) this.loadCloth(id);
  },

  loadCloth(id) {
    getCloth(id)
      .then((cloth) => {
        const colorIndex = Math.max(
          0,
          COLOR_PRESETS.findIndex(
            (c) => c.value === cloth.color || c.name === cloth.colorName
          )
        );
        const seasonSet = {};
        (cloth.season || []).forEach((s) => {
          seasonSet[s] = true;
        });
        this.setData({
          loading: false,
          name: cloth.name || "",
          brand: cloth.brand === "未填品牌" ? "" : cloth.brand || "",
          category: cloth.category || "tops",
          colorIndex: colorIndex >= 0 ? colorIndex : 0,
          tempPath: cloth.image || "",
          imageFileId: cloth.imageFileId || "",
          originalFileId: cloth.originalFileId || "",
          imageChanged: false,
          seasons: [
            { id: "春", on: !!seasonSet["春"] },
            { id: "夏", on: !!seasonSet["夏"] },
            { id: "秋", on: !!seasonSet["秋"] },
            { id: "冬", on: !!seasonSet["冬"] },
          ],
        });
      })
      .catch((err) => {
        this.setData({ loading: false });
        wx.showModal({
          title: "加载失败",
          content: err.message || "找不到该衣物",
          showCancel: false,
          complete: () => wx.navigateBack({ delta: 1 }),
        });
      });
  },

  onChooseImage() {
    chooseClothImage()
      .then((path) => compressImage(path))
      .then((path) => {
        this.setData({ tempPath: path, imageChanged: true });
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
    if (this.data.saving || this.data.deleting) return;

    if (!isLoggedIn()) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    const name = (this.data.name || "").trim();
    const isEdit = this.data.mode === "edit";

    if (!this.data.tempPath && !this.data.imageFileId) {
      wx.showToast({ title: "请先拍照或选图", icon: "none" });
      return;
    }
    if (!name) {
      wx.showToast({ title: "请填写名称", icon: "none" });
      return;
    }

    const color = this.data.colors[this.data.colorIndex] || this.data.colors[0];
    const season = this.data.seasons.filter((s) => s.on).map((s) => s.id);
    const payloadBase = {
      name,
      category: this.data.category,
      color: color.value,
      colorName: color.name,
      brand: (this.data.brand || "").trim(),
      season,
    };

    this.setData({ saving: true });
    wx.showLoading({ title: isEdit ? "保存中" : "上传中", mask: true });

    const uploadIfNeeded = () => {
      if (isEdit && !this.data.imageChanged) {
        return Promise.resolve({
          imageFileId: this.data.imageFileId,
          originalFileId: this.data.originalFileId || this.data.imageFileId,
          cutout: undefined,
          skipped: true,
        });
      }
      return uploadClothImageWithCutout(this.data.tempPath, (title) => {
        wx.showLoading({ title: title || "处理中", mask: true });
      });
    };

    uploadIfNeeded()
      .then((img) => {
        if (isEdit) {
          const patch = { ...payloadBase };
          if (!img.skipped) {
            patch.imageFileId = img.imageFileId;
            patch.originalFileId = img.originalFileId;
            patch.cutout = !!img.cutout;
          }
          return updateCloth(this.data.clothId, patch).then(() => img);
        }
        return addCloth({
          ...payloadBase,
          imageFileId: img.imageFileId,
          originalFileId: img.originalFileId,
          cutout: !!img.cutout,
        }).then(() => img);
      })
      .then((img) => {
        wx.hideLoading();
        this.setData({ saving: false });
        let title = isEdit ? "已保存" : "已入库";
        if (img && !img.skipped && !img.cutout) {
          title = "已入库（原图）";
        }
        wx.showToast({ title, icon: "success" });
        setTimeout(() => {
          wx.navigateBack({ delta: 1 });
        }, 500);
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ saving: false });
        const msg = err.message || "保存失败";
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

  onDelete() {
    if (this.data.mode !== "edit" || this.data.deleting || this.data.saving) return;

    wx.showModal({
      title: "删除这件衣物？",
      content: "删除后无法恢复，推荐里也不会再使用它。",
      confirmColor: "#B5695A",
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ deleting: true });
        wx.showLoading({ title: "删除中", mask: true });
        deleteCloth(
          this.data.clothId,
          this.data.imageFileId,
          this.data.originalFileId
        )
          .then(() => {
            wx.hideLoading();
            this.setData({ deleting: false });
            wx.showToast({ title: "已删除", icon: "success" });
            setTimeout(() => wx.navigateBack({ delta: 1 }), 400);
          })
          .catch((err) => {
            wx.hideLoading();
            this.setData({ deleting: false });
            wx.showToast({ title: err.message || "删除失败", icon: "none" });
          });
      },
    });
  },
});
