const s = require('../../utils/store');
Page({
  data: {
    name: '创作者',
    left: [],
    right: [],
    loading: false,
    error: '',
    hasMore: true
  },
  onLoad(o) {
    this.author = decodeURIComponent(o.id || 'missing');
    this.setData({
      name: decodeURIComponent(o.name || '创作者')
    });
    this.reload();
  },
  reload() {
    if (this.data.loading) return;
    this.rows = [];
    this.setData({
      left: [],
      right: [],
      error: ''
    });
    this.load();
  },
  async load() {
    if (this.data.loading) return;
    this.setData({
      loading: true
    });
    try {
      const a = await s.list({
        author: this.author,
        skip: this.rows.length
      });
      this.rows = this.rows.concat(a);
      this.setData({
        left: this.rows.filter((_, i) => i % 2 === 0),
        right: this.rows.filter((_, i) => i % 2 === 1),
        hasMore: a.length === 12
      });
    } catch (e) {
      this.setData({
        error: '作品加载失败'
      });
    } finally {
      this.setData({
        loading: false
      });
      wx.stopPullDownRefresh();
    }
  },
  onPullDownRefresh() {
    this.reload();
  },
  onReachBottom() {
    if (this.data.hasMore) this.load();
  }
});
