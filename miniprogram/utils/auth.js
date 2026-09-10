const OPENID_KEY = "mw_openid";
const LOGIN_AT_KEY = "mw_login_at";

function read(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    if (v === "" || v == null) return fallback;
    return v;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  wx.setStorageSync(key, value);
}

function getCachedOpenId() {
  return read(OPENID_KEY, "");
}

function isLoggedIn() {
  return !!getCachedOpenId();
}

/**
 * 静默登录：wx.login + 云函数换取 openid
 * 需先在开发者工具上传并部署云函数 login
 */
function ensureLogin(force) {
  const cached = getCachedOpenId();
  const loginAt = Number(read(LOGIN_AT_KEY, 0)) || 0;
  const fresh = Date.now() - loginAt < 7 * 24 * 60 * 60 * 1000;

  if (!force && cached && fresh) {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.openid = cached;
      app.globalData.isLoggedIn = true;
    }
    return Promise.resolve({ openid: cached, fromCache: true });
  }

  if (!wx.cloud) {
    return Promise.reject(new Error("云开发未初始化"));
  }

  return new Promise((resolve, reject) => {
    wx.login({
      success() {
        wx.cloud
          .callFunction({ name: "login" })
          .then((res) => {
            const result = (res && res.result) || {};
            const openid = result.openid || "";
            if (!openid) {
              reject(new Error("未获取到 openid，请确认已部署云函数 login"));
              return;
            }
            write(OPENID_KEY, openid);
            write(LOGIN_AT_KEY, Date.now());
            const app = getApp();
            if (app && app.globalData) {
              app.globalData.openid = openid;
              app.globalData.appid = result.appid || "";
              app.globalData.isLoggedIn = true;
            }
            resolve({
              openid,
              appid: result.appid || "",
              unionid: result.unionid || "",
              fromCache: false,
            });
          })
          .catch((err) => {
            const msg = (err && err.errMsg) || "";
            if (msg.indexOf("FUNCTION_NOT_FOUND") >= 0 || msg.indexOf("not found") >= 0) {
              reject(new Error("请先上传部署云函数 login"));
              return;
            }
            reject(new Error(msg || "登录失败"));
          });
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || "wx.login 失败"));
      },
    });
  });
}

function logoutLocal() {
  try {
    wx.removeStorageSync(OPENID_KEY);
    wx.removeStorageSync(LOGIN_AT_KEY);
  } catch (e) {}
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.openid = "";
    app.globalData.isLoggedIn = false;
  }
}

function maskOpenId(openid) {
  if (!openid || openid.length < 8) return "";
  return `${openid.slice(0, 4)}…${openid.slice(-4)}`;
}

module.exports = {
  ensureLogin,
  isLoggedIn,
  getCachedOpenId,
  logoutLocal,
  maskOpenId,
};
