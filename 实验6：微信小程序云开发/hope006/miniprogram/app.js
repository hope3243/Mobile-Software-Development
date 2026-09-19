const config = require('./config');
App({
  globalData: {
    cloudEnabled: false
  },
  onLaunch() {
    this.globalData.cloudEnabled = !!(config.env && wx.cloud);
    if (this.globalData.cloudEnabled) wx.cloud.init({
      env: config.env,
      traceUser: true
    });
  }
});
