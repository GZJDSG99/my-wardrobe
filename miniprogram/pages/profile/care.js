const { listClothes } = require("../../utils/clothes.js");
const { isLoggedIn } = require("../../utils/auth.js");

Page({
  data: {
    tasks: [],
    loading: true,
  },

  onShow() {
    this.load();
  },

  load() {
    this.setData({ loading: true });

    if (!isLoggedIn()) {
      this.setData({
        loading: false,
        tasks: [
          {
            id: "login",
            due: "现在",
            title: "登录后查看护理建议",
            detail: "护理提醒基于你的云端衣橱生成。",
          },
        ],
      });
      return;
    }

    listClothes()
      .then((clothes) => {
        const tasks = [];
        const idle = clothes.filter((c) => (c.worn || 0) === 0);
        const coats = clothes.filter((c) => c.category === "coats");

        if (clothes.length === 0) {
          tasks.push({
            id: "empty",
            due: "现在",
            title: "先入库几件常穿衣物",
            detail: "有了真实单品，护理提醒才有意义。",
          });
        } else {
          tasks.push({
            id: "wash",
            due: "本周",
            title: "检查需手洗/轻柔洗涤的单品",
            detail: `当前衣橱 ${clothes.length} 件，优先护理外套与针织。`,
          });
        }

        if (coats.length) {
          tasks.push({
            id: "season",
            due: "本月",
            title: "换季收纳清单",
            detail: `有 ${coats.length} 件外套，可按季节收纳防尘。`,
          });
        }

        if (idle.length) {
          tasks.push({
            id: "declutter",
            due: "看看",
            title: "可考虑断舍离",
            detail: `${idle
              .slice(0, 3)
              .map((c) => c.name)
              .join("、")}${idle.length > 3 ? " 等" : ""} 穿着次数为 0。`,
          });
        } else if (clothes.length) {
          tasks.push({
            id: "ok",
            due: "不错",
            title: "暂无明显闲置",
            detail: "继续保持穿着记录，健康度会更准。",
          });
        }

        this.setData({ tasks, loading: false });
      })
      .catch(() => {
        this.setData({
          loading: false,
          tasks: [
            {
              id: "fallback",
              due: "提示",
              title: "暂时无法读取衣橱",
              detail: "请确认云开发集合 clothes 已创建。",
            },
          ],
        });
      });
  },

  onGoWardrobe() {
    wx.switchTab({ url: "/pages/wardrobe/wardrobe" });
  },
});
