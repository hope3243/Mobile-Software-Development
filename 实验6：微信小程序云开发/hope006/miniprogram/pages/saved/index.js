const s = require('../../utils/store');
Page({
  data: {
    left: [],
    right: [],
    count: 0,
    loading: false,
    error: '',
    isCloud: false
  },
  onShow() {
    this.setData({
      isCloud: s.cloud()
    });
    this.load();
  },
  async load() {
    if (this.data.loading) return;
    this.setData({
      loading: true,
      error: ''
    });
    try {
      const a = await s.favoriteList();
      this.setData({
        left: a.filter((_, i) => i % 2 === 0),
        right: a.filter((_, i) => i % 2 === 1),
        count: a.length
      });
    } catch (e) {
      this.setData({
        error: '收藏加载失败，请检查云函数是否重新部署'
      });
    } finally {
      this.setData({
        loading: false
      });
      wx.stopPullDownRefresh();
    }
  },
  onPullDownRefresh() {
    this.load();
  },
  discover() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },
  likeChange() {}
});
