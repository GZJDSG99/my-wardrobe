/**
 * 微信模糊定位
 * 需在公众平台「用户隐私保护指引」中声明并发布位置信息。
 */
const ENABLE_FUZZY_LOCATION = true;
const SCOPE = "scope.userFuzzyLocation";

function getUserLocation() {
  if (!ENABLE_FUZZY_LOCATION) {
    return Promise.reject(
      new Error(
        "定位暂未开通：请先在公众平台发布「用户隐私保护指引」中的位置信息，或使用下方城市切换"
      )
    );
  }

  return ensurePrivacy()
    .then(ensureScope)
    .then(requestFuzzyLocation);
}

function ensurePrivacy() {
  return new Promise((resolve, reject) => {
    if (typeof wx.requirePrivacyAuthorize !== "function") {
      resolve();
      return;
    }
    wx.requirePrivacyAuthorize({
      success: () => resolve(),
      fail: () => reject(new Error("需先同意隐私协议才能使用定位")),
    });
  });
}

function ensureScope() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success(settingRes) {
        if ((settingRes.authSetting || {})[SCOPE] === true) {
          resolve();
          return;
        }
        wx.authorize({
          scope: SCOPE,
          success: () => resolve(),
          fail: () => reject(new Error("需要开启定位权限")),
        });
      },
      fail: () => {
        wx.authorize({
          scope: SCOPE,
          success: () => resolve(),
          fail: () => reject(new Error("需要开启定位权限")),
        });
      },
    });
  });
}

function requestFuzzyLocation() {
  return new Promise((resolve, reject) => {
    if (typeof wx.getFuzzyLocation !== "function") {
      reject(new Error("当前基础库不支持模糊定位，请升级微信"));
      return;
    }
    wx.getFuzzyLocation({
      type: "gcj02",
      success(res) {
        if (res.latitude == null || res.longitude == null) {
          reject(new Error("未获取到坐标"));
          return;
        }
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          fuzzy: true,
        });
      },
      fail(err) {
        const msg = (err && err.errMsg) || "";
        if (msg.indexOf("not authorized") >= 0 || msg.indexOf("-80424") >= 0) {
          reject(
            new Error(
              "定位接口未在小程序后台授权，请配置用户隐私保护指引，或使用城市切换"
            )
          );
          return;
        }
        reject(new Error(msg || "定位失败"));
      },
    });
  });
}

function openLocationSetting() {
  return new Promise((resolve) => {
    wx.showModal({
      title: "需要定位权限",
      content: "请在设置中开启位置信息，或使用城市切换查看天气。",
      confirmText: "去设置",
      success(res) {
        if (res.confirm) {
          wx.openSetting({
            success(setting) {
              const auth = setting.authSetting || {};
              resolve(!!auth[SCOPE]);
            },
            fail() {
              resolve(false);
            },
          });
        } else {
          resolve(false);
        }
      },
    });
  });
}

module.exports = {
  ENABLE_FUZZY_LOCATION,
  getUserLocation,
  openLocationSetting,
};
