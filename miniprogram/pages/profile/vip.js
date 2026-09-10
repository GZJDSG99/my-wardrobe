Page({
  data: {
    plans: [
      {
        name: "免费版",
        price: "¥0",
        features: ["每日主推荐", "理由条", "基础城市天气", "衣物手填入库"],
      },
      {
        name: "会员",
        price: "即将开通",
        features: ["更高识别额度", "一日多场景方案", "更多换套次数", "护理提醒加深"],
      },
    ],
  },

  onNotify() {
    wx.showToast({ title: "会员支付二期再开，先用免费主路径", icon: "none" });
  },
});
