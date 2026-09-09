const store = require('../../utils/store');
Page({
  data: {
    categories: ['全部', '自然', '城市', '旅行', '日常', '人像'],
    category: '全部',
    keyword: '',
    left: [],
    right: [],
    loading: false,
    hasMore: true,
    error: '',
    isCloud: false
  },
  onLoad() {
    this.rows = [];
    this.version = 0;
    this.setData({
      isCloud: store.cloud()
    });
  },
  onShow() {
    this.reload();
  },
  onUnload() {
    clearTimeout(this.timer);
  },
  async reload() {
    const version = ++this.version;
    this.rows = [];
    this.setData({
      left: [],
      right: [],
      hasMore: true,
      loading: true,
      error: ''
    });
    await this.fetch(version, 0);
  },
  async fetch(version, skip) {
    try {
      const rows = await store.list({
        skip,
        category: this.data.category,
        keyword: this.data.keyword.trim()
      });
      if (version !== this.version) return;
      this.rows = this.rows.concat(rows);
      this.setData({
        left: this.rows.filter((_, i) => i % 2 === 0),
        right: this.rows.filter((_, i) => i % 2 === 1),
        hasMore: rows.length === 12,
        error: ''
      });
    } catch (e) {
      if (version === this.version) this.setData({
        error: '暂时无法加载，请检查云函数与数据库配置'
      });
    } finally {
      if (version === this.version) this.setData({
        loading: false
      });
      wx.stopPullDownRefresh();
    }
  },
  onPullDownRefresh() {
    this.reload();
  },
  onReachBottom() {
    if (!this.data.loading && this.data.hasMore) {
      this.setData({
        loading: true
      });
      this.fetch(this.version, this.rows.length);
    }
  },
  filter(e) {
    this.setData({
      category: e.currentTarget.dataset.value
    });
    this.reload();
  },
  searchInput(e) {
    this.setData({
      keyword: e.detail.value
    });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.reload(), 350);
  },
  search() {
    clearTimeout(this.timer);
    this.reload();
  },
  clearSearch() {
    clearTimeout(this.timer);
    this.setData({
      keyword: ''
    });
    this.reload();
  },
  topic() {
    this.setData({
      category: '自然',
      keyword: ''
    });
    this.reload();
  },
  add() {
    wx.navigateTo({
      url: '/pages/add/add'
    });
  },
  onShareAppMessage() {
    return {
      title: '拾光｜把平凡的日子，拍成喜欢的样子',
      path: '/pages/index/index'
    };
  }
});
