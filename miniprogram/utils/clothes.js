/** 云开发环境 */
const CLOUD_ENV = "cloud1-4g0p7z3p8c0a5b52";
const COLLECTION = "clothes";
const LIST_CACHE_TTL = 60 * 1000;

let listCache = null; // { at, items }

function invalidateListCache() {
  listCache = null;
}

function quotaError(err) {
  const msg = (err && (err.errMsg || err.message)) || "";
  if (
    msg.indexOf("OutOfReadRequestQuota") >= 0 ||
    msg.indexOf("Read overrun") >= 0 ||
    msg.indexOf("-501015") >= 0
  ) {
    return new Error("云数据库今日读取次数已用完，请明天再试或升级云开发配额");
  }
  return err instanceof Error ? err : new Error(msg || "请求失败");
}

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

/** 调用云函数抠图；失败时回退原图 */
function cutoutClothImage(originalFileId) {
  return ensureCloud().then(
    () =>
      new Promise((resolve) => {
        wx.cloud.callFunction({
          name: "cutout",
          data: { fileID: originalFileId },
          success(res) {
            const result = (res && res.result) || {};
            if (result.ok && result.cutoutFileId) {
              resolve({
                imageFileId: result.cutoutFileId,
                originalFileId: originalFileId,
                cutout: true,
              });
              return;
            }
            resolve({
              imageFileId: originalFileId,
              originalFileId: originalFileId,
              cutout: false,
              cutoutError: result.message || "抠图失败",
            });
          },
          fail(err) {
            resolve({
              imageFileId: originalFileId,
              originalFileId: originalFileId,
              cutout: false,
              cutoutError: (err && err.errMsg) || "抠图云函数调用失败",
            });
          },
        });
      })
  );
}

/** 上传原图并抠图：展示图优先用抠图结果 */
function uploadClothImageWithCutout(tempFilePath, onProgress) {
  const tip = typeof onProgress === "function" ? onProgress : () => {};
  tip("上传中");
  return uploadClothImage(tempFilePath).then((originalFileId) => {
    tip("抠图中");
    return cutoutClothImage(originalFileId);
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

function mapClothRow(r, urlMap) {
  const fileId = r.imageFileId || "";
  return {
    id: r._id,
    name: r.name,
    category: r.category,
    color: r.color || "#F5E8D8",
    colorName: r.colorName || "",
    brand: r.brand || "未填品牌",
    season: r.season || [],
    worn: r.worn || 0,
    idle: !!r.idle,
    real: r.real !== false,
    image: urlMap[fileId] || "",
    imageFileId: fileId,
    originalFileId: r.originalFileId || "",
    cutout: !!r.cutout,
  };
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
          originalFileId: payload.originalFileId || payload.imageFileId || "",
          cutout: !!payload.cutout,
          worn: 0,
          idle: false,
          real: true,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      })
      .then((res) => {
        invalidateListCache();
        return res._id;
      });
  });
}

/** 按 id 读取单件 */
function getCloth(id) {
  if (!id) return Promise.reject(new Error("缺少衣物 id"));
  return ensureCloud().then(() =>
    getDb()
      .collection(COLLECTION)
      .doc(id)
      .get()
      .then((res) => {
        const r = res.data;
        if (!r) return Promise.reject(new Error("衣物不存在"));
        const fileId = r.imageFileId || "";
        return resolveImageUrls(fileId ? [fileId] : []).then((urlMap) => {
          const mapped = mapClothRow({ ...r, _id: r._id || id }, urlMap);
          mapped.brand = r.brand || "";
          return mapped;
        });
      })
  );
}

/** 更新衣物 */
function updateCloth(id, payload) {
  if (!id) return Promise.reject(new Error("缺少衣物 id"));
  return ensureCloud().then(() => {
    const db = getDb();
    const data = {
      name: payload.name,
      category: payload.category,
      color: payload.color || "#F5E8D8",
      colorName: payload.colorName || "",
      brand: payload.brand || "",
      season: payload.season || [],
      updatedAt: db.serverDate(),
    };
    if (payload.imageFileId) data.imageFileId = payload.imageFileId;
    if (payload.originalFileId) data.originalFileId = payload.originalFileId;
    if (typeof payload.cutout === "boolean") data.cutout = payload.cutout;
    if (typeof payload.idle === "boolean") data.idle = payload.idle;
    return db
      .collection(COLLECTION)
      .doc(id)
      .update({ data })
      .then((res) => {
        invalidateListCache();
        return res;
      });
  });
}

/** 手动标记 / 取消闲置 */
function setClothIdle(id, idle) {
  if (!id) return Promise.reject(new Error("缺少衣物 id"));
  return ensureCloud().then(() => {
    const db = getDb();
    return db
      .collection(COLLECTION)
      .doc(id)
      .update({
        data: {
          idle: !!idle,
          updatedAt: db.serverDate(),
        },
      })
      .then((res) => {
        invalidateListCache();
        return res;
      });
  });
}

function deleteCloudFiles(fileList) {
  const ids = (fileList || []).filter(Boolean);
  if (!ids.length || !wx.cloud.deleteFile) return Promise.resolve(null);
  const unique = Array.from(new Set(ids));
  return new Promise((resolve) => {
    wx.cloud.deleteFile({
      fileList: unique,
      complete() {
        resolve(null);
      },
    });
  });
}

/** 删除衣物（并尝试删云存储图） */
function deleteCloth(id, imageFileId, originalFileId) {
  if (!id) return Promise.reject(new Error("缺少衣物 id"));
  return ensureCloud().then(() =>
    getDb()
      .collection(COLLECTION)
      .doc(id)
      .remove()
      .then(() => {
        invalidateListCache();
        return deleteCloudFiles([imageFileId, originalFileId]);
      })
  );
}

/** 拉取当前用户衣物列表（短时缓存，避免重复读耗尽配额） */
function listClothes(force) {
  if (
    !force &&
    listCache &&
    Date.now() - listCache.at < LIST_CACHE_TTL &&
    Array.isArray(listCache.items)
  ) {
    return Promise.resolve(listCache.items.slice());
  }

  return ensureCloud().then(() => {
    const db = getDb();
    const col = db.collection(COLLECTION);

    const mapRows = (rows) => {
      const fileIDs = rows.map((r) => r.imageFileId).filter(Boolean);
      return resolveImageUrls(fileIDs).then((urlMap) =>
        rows.map((r) => mapClothRow(r, urlMap))
      );
    };

    return col
      .orderBy("createdAt", "desc")
      .limit(100)
      .get()
      .then((res) => mapRows(res.data || []))
      .catch((err) => {
        const q = quotaError(err);
        if (q.message.indexOf("读取次数已用完") >= 0) return Promise.reject(q);
        return col
          .limit(100)
          .get()
          .then((res) => mapRows(res.data || []))
          .catch((err2) => Promise.reject(quotaError(err2)));
      })
      .then((items) => {
        listCache = { at: Date.now(), items: items || [] };
        return items.slice();
      });
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
  uploadClothImageWithCutout,
  cutoutClothImage,
  addCloth,
  getCloth,
  updateCloth,
  setClothIdle,
  deleteCloth,
  listClothes,
  invalidateListCache,
  buildCategoryStats,
};
