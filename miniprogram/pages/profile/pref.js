const {
  getProfile,
  saveProfileAndSync,
  STYLE_OPTIONS,
  SCENE_OPTIONS,
} = require("../../utils/user.js");

Page({
  data: {
    nickName: "",
    avatarUrl: "",
    styles: [],
    scenes: [],
    styleOptions: [],
    sceneOptions: [],
    saving: false,
  },

  onLoad() {
    const profile = getProfile();
    this.setData({
      nickName: profile.nickName || "",
      avatarUrl: profile.avatarUrl || "",
      styles: profile.styles || [],
      scenes: profile.scenes || [],
      styleOptions: STYLE_OPTIONS.map((s) => ({
        id: s,
        on: (profile.styles || []).indexOf(s) >= 0,
      })),
      sceneOptions: SCENE_OPTIONS.map((s) => ({
        id: s,
        on: (profile.scenes || []).indexOf(s) >= 0,
      })),
    });
  },

  onChooseAvatar(e) {
    const url = e.detail.avatarUrl;
    if (url) this.setData({ avatarUrl: url });
  },

  onNickInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  onToggleStyle(e) {
    const id = e.currentTarget.dataset.id;
    const styleOptions = this.data.styleOptions.map((s) =>
      s.id === id ? { ...s, on: !s.on } : s
    );
    this.setData({
      styleOptions,
      styles: styleOptions.filter((s) => s.on).map((s) => s.id),
    });
  },

  onToggleScene(e) {
    const id = e.currentTarget.dataset.id;
    const sceneOptions = this.data.sceneOptions.map((s) =>
      s.id === id ? { ...s, on: !s.on } : s
    );
    this.setData({
      sceneOptions,
      scenes: sceneOptions.filter((s) => s.on).map((s) => s.id),
    });
  },

  onSave() {
    if (this.data.saving) return;
    const nickName = (this.data.nickName || "").trim();
    if (!this.data.avatarUrl) {
      wx.showToast({ title: "请先选择头像", icon: "none" });
      return;
    }
    if (!nickName) {
      wx.showToast({ title: "请填写昵称", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: "保存中", mask: true });

    saveProfileAndSync({
      nickName,
      avatarUrl: this.data.avatarUrl,
      styles: this.data.styles.slice(0, 4),
      scenes: this.data.scenes.slice(0, 4),
      profileDone: true,
    })
      .then(() => {
        wx.hideLoading();
        this.setData({ saving: false });
        wx.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => wx.navigateBack(), 400);
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ saving: false });
        wx.showToast({ title: (err && err.message) || "保存失败", icon: "none" });
      });
  },
});
