/** 云开发环境 */
const CLOUD_ENV = "cloud1-4g0p7z3p8c0a5b52";
const COLLECTION = "clothes";

const CATEGORIES = [
  { id: "tops", label: "上衣" },
  { id: "pants", label: "裤装" },
  { id: "skirts", label: "裙装" },
  { id: "coats", label: "外套" },
  { id: "shoes", label: "鞋履" },
  { id: "accessories", label: "配饰" },
];

const COLOR_PRESETS = [
  { name: "米白", value: "#F5E8D8" },
  { name: "黑色", value: "#2C2C2C" },
  { name: "牛仔蓝", value: "#6B8CAE" },
  { name: "粉色", value: "#E8C4C4" },
  { name: "白色", value: "#F8F8F8" },
  { name: "驼色", value: "#C4A882" },
  { name: "砖红", value: "#B5695A" },
  { name: "灰", value: "#9A9590" },
];

function getDb() {
  return wx.cloud.database();
}

function ensureCloud() {
  if (!wx.cloud) {
    return Promise.reject(new Error("请使用支持云开发的基础库"));
  }
  return Promise.resolve();
}

/** 选图：相机或相册 */
function chooseClothImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success(res) {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.tempFilePath) {
          reject(new Error("未选择图片"));
          return;
        }
        resolve(file.tempFilePath);
      },
      fail(err) {
        const msg = (err && err.errMsg) || "";
        if (msg.indexOf("cancel") >= 0) {
          reject(new Error("cancel"));
          return;
        }
        reject(new Error(msg || "选图失败"));
      },
    });
  });
}

function compressImage(filePath) {
  return new Promise((resolve) => {
    wx.compressImage({
      src: filePath,
      quality: 80,
      success(res) {
        resolve(res.tempFilePath || filePath);
      },
      fail() {
        resolve(filePath);
      },
    });
  });
}

/** 上传到云存储，返回 fileID */
function uploadClothImage(tempFilePath) {
  return ensureCloud().then(() => {
    const extMatch = /\.[a-zA-Z0-9]+$/.exec(tempFilePath);
    const ext = (extMatch && extMatch[0]) || ".jpg";
    const cloudPath = `clothes/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}${ext}`;

    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success(res) {
          if (!res.fileID) {
            reject(new Error("上传失败：无 fileID"));
            return;
          }
          resolve(res.fileID);
        },
        fail(err) {
          reject(new Error((err && err.errMsg) || "云存储上传失败"));
        },
      });
    });
  });
}

function resolveImageUrls(fileIDs) {
  const ids = (fileIDs || []).filter(Boolean);
  if (!ids.length) return Promise.resolve({});

  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: ids,
      success(res) {
        const map = {};
        (res.fileList || []).forEach((f) => {
          if (f.fileID && f.tempFileURL) map[f.fileID] = f.tempFileURL;
        });
        resolve(map);
      },
      fail() {
        resolve({});
      },
    });
  });
}

/** 新增衣物记录 */
function addCloth(payload) {
  return ensureCloud().then(() => {
    const db = getDb();
    return db
      .collection(COLLECTION)
      .add({
        data: {
          name: payload.name,
          category: payload.category,
          color: payload.color || "#F5E8D8",
          colorName: payload.colorName || "",
          brand: payload.brand || "",
          season: payload.season || [],
          imageFileId: payload.imageFileId,
          worn: 0,
          real: true,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      })
      .then((res) => res._id);
  });
}

/** 拉取当前用户衣物列表 */
function listClothes() {
  return ensureCloud().then(() => {
    const db = getDb();
    const col = db.collection(COLLECTION);

    const mapRows = (rows) => {
      const fileIDs = rows.map((r) => r.imageFileId).filter(Boolean);
      return resolveImageUrls(fileIDs).then((urlMap) =>
        rows.map((r) => ({
          id: r._id,
          name: r.name,
          category: r.category,
          color: r.color || "#F5E8D8",
          brand: r.brand || "未填品牌",
          worn: r.worn || 0,
          real: r.real !== false,
          image: urlMap[r.imageFileId] || "",
          imageFileId: r.imageFileId,
        }))
      );
    };

    return col
      .orderBy("createdAt", "desc")
      .limit(100)
      .get()
      .then((res) => mapRows(res.data || []))
      .catch(() =>
        col
          .limit(100)
          .get()
          .then((res) => mapRows(res.data || []))
      );
  });
}

function buildCategoryStats(items) {
  const counts = { all: items.length };
  CATEGORIES.forEach((c) => {
    counts[c.id] = items.filter((i) => i.category === c.id).length;
  });
  return [
    { id: "all", label: "全部", count: counts.all },
    ...CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      count: counts[c.id] || 0,
    })),
  ];
}

module.exports = {
  CLOUD_ENV,
  COLLECTION,
  CATEGORIES,
  COLOR_PRESETS,
  chooseClothImage,
  compressImage,
  uploadClothImage,
  addCloth,
  listClothes,
  buildCategoryStats,
};
