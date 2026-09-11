/**
 * 为页面注入轻量进场动画（Tab 切换 / 打开子页都会重播）
 */
function withPageTransition(options) {
  const userData = options.data || {};
  const userOnShow = options.onShow;
  const userOnHide = options.onHide;
  let enterTimer = null;

  options.data = Object.assign({}, userData, {
    pageEnter: true,
  });

  options.onShow = function onShowWithEnter(opts) {
    if (enterTimer) {
      clearTimeout(enterTimer);
      enterTimer = null;
    }
    this.setData({ pageEnter: false });
    enterTimer = setTimeout(() => {
      enterTimer = null;
      if (this.setData) this.setData({ pageEnter: true });
    }, 16);
    if (typeof userOnShow === "function") userOnShow.call(this, opts);
  };

  options.onHide = function onHideWithEnter(opts) {
    if (enterTimer) {
      clearTimeout(enterTimer);
      enterTimer = null;
    }
    if (typeof userOnHide === "function") userOnHide.call(this, opts);
  };

  return options;
}

module.exports = {
  withPageTransition,
};
