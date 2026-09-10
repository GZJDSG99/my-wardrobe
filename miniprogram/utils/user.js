const PROFILE_KEY = "mw_profile";
const WEARS_KEY = "mw_wears";
const FAVS_KEY = "mw_favs";
const CHECKINS_KEY = "mw_checkins";
const STREAK_KEY = "mw_streak";
const USERS_COLLECTION = "users";

const DEFAULT_PROFILE = {
  nickName: "衣橱用户",
  avatarUrl: "",
  avatarFileId: "",
  styles: ["极简", "复古", "法式"],
  scenes: ["通勤", "约会"],
  cityQuery: "Hangzhou",
  cityName: "杭州",
  profileDone: false,
};

function readJson(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    if (v === "" || v == null) return fallback;
    return v;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  wx.setStorageSync(key, value);
}

function getProfile() {
  return { ...DEFAULT_PROFILE, ...readJson(PROFILE_KEY, {}) };
}

function isProfileComplete(profile) {
  const p = profile || getProfile();
  if (p.profileDone) return true;
  const nick = (p.nickName || "").trim();
  const hasAvatar = !!(p.avatarUrl || p.avatarFileId);
  return hasAvatar && nick && nick !== DEFAULT_PROFILE.nickName;
}

function applyProfileSideEffects(next) {
  const app = getApp();
  if (app && app.globalData) {
    if (next.cityQuery) app.globalData.cityQuery = next.cityQuery;
    if (next.cityName) app.globalData.city = next.cityName;
  }
}

function saveProfile(patch) {
  const next = { ...getProfile(), ...patch };
  writeJson(PROFILE_KEY, next);
  applyProfileSideEffects(next);
  return next;
}

function resolveAvatarDisplay(fileId, fallbackUrl) {
  if (!fileId || !wx.cloud) {
    return Promise.resolve(fallbackUrl || "");
  }
  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: [fileId],
      success(res) {
        const item = (res.fileList || [])[0];
        resolve((item && item.tempFileURL) || fallbackUrl || fileId);
      },
      fail() {
        resolve(fallbackUrl || fileId);
      },
    });
  });
}

/** 把头像临时路径上传到云存储 */
function uploadAvatarIfNeeded(avatarUrl) {
  if (!avatarUrl) return Promise.resolve({ avatarUrl: "", avatarFileId: "" });
  if (/^cloud:\/\//.test(avatarUrl)) {
    return resolveAvatarDisplay(avatarUrl, "").then((url) => ({
      avatarUrl: url || avatarUrl,
      avatarFileId: avatarUrl,
    }));
  }
  // 已是 https 且不是本地临时文件，直接用
  if (/^https?:\/\//.test(avatarUrl) && avatarUrl.indexOf("tmp") < 0 && avatarUrl.indexOf("wxfile") < 0) {
    return Promise.resolve({ avatarUrl, avatarFileId: "" });
  }
  if (!wx.cloud) {
    return Promise.resolve({ avatarUrl, avatarFileId: "" });
  }

  const extMatch = /\.[a-zA-Z0-9]+$/.exec(avatarUrl);
  const ext = (extMatch && extMatch[0]) || ".jpg";
  const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl,
      success(res) {
        if (!res.fileID) {
          reject(new Error("头像上传失败"));
          return;
        }
        resolveAvatarDisplay(res.fileID, avatarUrl).then((url) => {
          resolve({ avatarUrl: url || avatarUrl, avatarFileId: res.fileID });
        });
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || "头像上传失败"));
      },
    });
  });
}

function cloudUsers() {
  return wx.cloud.database().collection(USERS_COLLECTION);
}

function profilePayload(p) {
  return {
    nickName: p.nickName || "",
    avatarUrl: p.avatarUrl || "",
    avatarFileId: p.avatarFileId || "",
    styles: p.styles || [],
    scenes: p.scenes || [],
    cityQuery: p.cityQuery || "Hangzhou",
    cityName: p.cityName || "杭州",
    profileDone: !!p.profileDone,
  };
}

/** 推送到云库 users（需创建集合，权限建议仅创建者可读写） */
function pushProfileToCloud(profile) {
  if (!wx.cloud) return Promise.resolve(null);
  const p = profile || getProfile();
  const data = {
    ...profilePayload(p),
    updatedAt: wx.cloud.database().serverDate(),
  };

  return cloudUsers()
    .limit(1)
    .get()
    .then((res) => {
      const row = (res.data || [])[0];
      if (row && row._id) {
        return cloudUsers()
          .doc(row._id)
          .update({ data })
          .then(() => row._id);
      }
      return cloudUsers()
        .add({
          data: {
            ...data,
            createdAt: wx.cloud.database().serverDate(),
          },
        })
        .then((r) => r._id);
    })
    .catch(() => null);
}

/**
 * 登录后从云端拉回资料，合并到本地。
 * 云端有头像/昵称时优先用云端。
 */
function syncProfileFromCloud() {
  if (!wx.cloud) return Promise.resolve(getProfile());

  return cloudUsers()
    .limit(1)
    .get()
    .then((res) => {
      const row = (res.data || [])[0];
      if (!row) return getProfile();

      const local = getProfile();
      const merged = {
        ...local,
        nickName: row.nickName || local.nickName,
        avatarFileId: row.avatarFileId || local.avatarFileId || "",
        avatarUrl: row.avatarUrl || local.avatarUrl || "",
        styles: row.styles && row.styles.length ? row.styles : local.styles,
        scenes: row.scenes && row.scenes.length ? row.scenes : local.scenes,
        cityQuery: row.cityQuery || local.cityQuery,
        cityName: row.cityName || local.cityName,
        profileDone:
          !!row.profileDone ||
          isProfileComplete({
            nickName: row.nickName,
            avatarUrl: row.avatarUrl || row.avatarFileId,
            profileDone: row.profileDone,
          }),
      };

      const fileId = merged.avatarFileId;
      if (!fileId) {
        saveProfile(merged);
        return merged;
      }
      return resolveAvatarDisplay(fileId, merged.avatarUrl).then((url) => {
        merged.avatarUrl = url || merged.avatarUrl;
        saveProfile(merged);
        return merged;
      });
    })
    .catch(() => getProfile());
}

/** 保存资料：本地 + 可选上传头像 + 推云 */
function saveProfileAndSync(patch) {
  const base = { ...getProfile(), ...patch };
  const rawAvatar = base.avatarUrl || "";

  return uploadAvatarIfNeeded(rawAvatar)
    .then((avatar) => {
      const next = saveProfile({
        ...base,
        avatarUrl: avatar.avatarUrl || base.avatarUrl,
        avatarFileId: avatar.avatarFileId || base.avatarFileId || "",
        profileDone:
          base.profileDone ||
          isProfileComplete({
            ...base,
            avatarUrl: avatar.avatarUrl || base.avatarUrl,
          }),
      });
      return pushProfileToCloud(next).then(() => next);
    });
}

function getWears() {
  return readJson(WEARS_KEY, []);
}

function addWear(record) {
  const list = getWears();
  const item = {
    id: `w_${Date.now()}`,
    title: record.title || "今日穿搭",
    reason: record.reason || "",
    temp: record.temp || "",
    items: record.items || [],
    image: record.image || "",
    theme: record.theme || "",
    createdAt: Date.now(),
  };
  list.unshift(item);
  writeJson(WEARS_KEY, list.slice(0, 100));

  try {
    if (wx.cloud) {
      const db = wx.cloud.database();
      db.collection("wears")
        .add({
          data: {
            ...item,
            createdAt: db.serverDate(),
          },
        })
        .catch(() => {});
    }
  } catch (e) {}

  return item;
}

function getFavorites() {
  return readJson(FAVS_KEY, []);
}

function toggleFavorite(item) {
  const list = getFavorites();
  const idx = list.findIndex((f) => f.id === item.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeJson(FAVS_KEY, list);
    return { list, liked: false };
  }
  list.unshift({
    id: item.id,
    title: item.title,
    image: item.image || "",
    createdAt: Date.now(),
  });
  writeJson(FAVS_KEY, list.slice(0, 50));
  return { list, liked: true };
}

function getCheckins() {
  return readJson(CHECKINS_KEY, []);
}

function addCheckin(payload) {
  const list = getCheckins();
  const item = {
    id: `c_${Date.now()}`,
    text: payload.text || "今日打卡",
    mood: payload.mood || "日常",
    createdAt: Date.now(),
  };
  list.unshift(item);
  writeJson(CHECKINS_KEY, list.slice(0, 60));
  return item;
}

function calcHealth(clothes) {
  const count = (clothes || []).length;
  let score = 45;
  if (count >= 1) score = 58;
  if (count >= 5) score = 70;
  if (count >= 12) score = 82;
  if (count >= 25) score = 90;

  const idle = (clothes || []).filter((c) => (c.worn || 0) === 0).length;
  if (count > 0 && idle / count > 0.5) score -= 8;
  if (count > 0 && idle / count > 0.7) score -= 6;

  const streak = getStreak();
  if (streak >= 3) score += 4;
  if (streak >= 7) score += 4;

  score = Math.max(30, Math.min(98, score));

  let tip = "继续补充真实衣物，推荐会更准。";
  if (count === 0) tip = "还没有入库衣物，去拍第一件吧。";
  else if (idle >= 3) tip = `有 ${idle} 件几乎未穿，可去护理页看看断舍离建议。`;
  else if (streak >= 3) tip = `连续出门 ${streak} 天，习惯正在养成。`;
  else tip = `衣橱已有 ${count} 件，保持每日采纳穿搭吧。`;

  return { score, tip, idle, count };
}

function getStreak() {
  const app = getApp();
  if (app && app.globalData && typeof app.globalData.streak === "number") {
    return app.globalData.streak;
  }
  return Number(readJson(STREAK_KEY, 0)) || 0;
}

function setStreak(n) {
  const val = Math.max(0, Number(n) || 0);
  writeJson(STREAK_KEY, val);
  const app = getApp();
  if (app && app.globalData) app.globalData.streak = val;
  return val;
}

function bumpStreak() {
  return setStreak(getStreak() + 1);
}

/** 退出登录时清空本地身份展示（云端 users 仍保留，下次登录可拉回） */
function clearLocalIdentity() {
  return saveProfile({
    nickName: DEFAULT_PROFILE.nickName,
    avatarUrl: "",
    avatarFileId: "",
    profileDone: false,
  });
}

const STYLE_OPTIONS = ["极简", "复古", "法式", "街头", "通勤", "运动", "甜美", "暗黑"];
const SCENE_OPTIONS = ["通勤", "约会", "运动", "居家", "旅行", "正式场合"];
const CITY_OPTIONS = [
  { name: "杭州", query: "Hangzhou" },
  { name: "上海", query: "Shanghai" },
  { name: "北京", query: "Beijing" },
  { name: "广州", query: "Guangzhou" },
  { name: "深圳", query: "Shenzhen" },
  { name: "成都", query: "Chengdu" },
];

module.exports = {
  getProfile,
  saveProfile,
  saveProfileAndSync,
  syncProfileFromCloud,
  pushProfileToCloud,
  clearLocalIdentity,
  isProfileComplete,
  getWears,
  addWear,
  getFavorites,
  toggleFavorite,
  getCheckins,
  addCheckin,
  calcHealth,
  getStreak,
  setStreak,
  bumpStreak,
  STYLE_OPTIONS,
  SCENE_OPTIONS,
  CITY_OPTIONS,
};
