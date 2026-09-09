const s = require('../../utils/store');
Page({
  data: {
    profile: {
      nickName: '拾光旅人'
    },
    rows: [],
    left: [],
    right: [],
    editing: false,
    nameInput: '',
    publishedCount: 0,
    savedCount: 0,
    loading: false,
    error: '',
    hasMore: false
  },
  onShow() {
    this.setData({
      profile: s.read('profile', {
        nickName: '拾光旅人'
      }),
      savedCount: s.favorites().length,
      isCloud: s.cloud()
    });
    this.refreshStats();
    this.reload();
  },
  async refreshStats() {
    try {
      const stats = await s.stats();
      this.setData({
        publishedCount: stats.published,
        savedCount: stats.saved
      });
    } catch (e) {
      this.setData({
        savedCount: s.favorites().length
      });
    }
  },
  async reload() {
    this.setData({
      rows: [],
      left: [],
      right: [],
      error: ''
    });
    this.author = '';
    await this.load();
  },
  async load() {
    if (this.data.loading) return;
    this.setData({
      loading: true
    });
    try {
      this.author = this.author || await s.identity();
      const a = await s.list({
        author: this.author,
        skip: this.data.rows.length
      });
      const rows = this.data.rows.concat(a);
      this.setData({
        rows,
        left: rows.filter((_, i) => i % 2 === 0),
        right: rows.filter((_, i) => i % 2 === 1),
        hasMore: a.length === 12,
        publishedCount: Math.max(this.data.publishedCount, rows.length)
      });
    } catch (e) {
      this.setData({
        error: '个人作品加载失败，请检查云环境'
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
  },
  edit() {
    this.setData({
      editing: !this.data.editing,
      nameInput: this.data.profile.nickName
    });
  },
  nameInput(e) {
    this.setData({
      nameInput: e.detail.value
    });
  },
  saveProfile() {
    const name = this.data.nameInput.trim();
    if (!name) return wx.showToast({
      title: '请填写昵称',
      icon: 'none'
    });
    const p = Object.assign({}, this.data.profile, {
      nickName: name.slice(0, 20)
    });
    s.write('profile', p);
    this.setData({
      profile: p,
      editing: false
    });
    wx.showToast({
      title: '已保存'
    });
  },
  async avatar(e) {
    try {
      let avatarUrl;
      if (s.cloud()) {
        const f = await wx.cloud.uploadFile({
          cloudPath: 'avatars/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg',
          filePath: e.detail.avatarUrl
        });
        avatarUrl = f.fileID;
      } else {
        const f = await wx.saveFile({
          tempFilePath: e.detail.avatarUrl
        });
        avatarUrl = f.savedFilePath;
      }
      const p = Object.assign({}, this.data.profile, {
        avatarUrl
      });
      s.write('profile', p);
      this.setData({
        profile: p
      });
    } catch (e) {
      wx.showToast({
        title: '头像保存失败',
        icon: 'none'
      });
    }
  },
  add() {
    wx.navigateTo({
      url: '/pages/add/add'
    });
  }
});
