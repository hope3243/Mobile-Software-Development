const s = require('../../utils/store');
Page({
  data: {
    title: '',
    description: '',
    images: [],
    category: '自然',
    categories: ['自然', '城市', '旅行', '日常', '人像'],
    location: '',
    busy: false,
    progress: 0,
    error: '',
    isCloud: false
  },
  onLoad() {
    this.setData({
      isCloud: s.cloud()
    });
    const draft = s.read('draft', null);
    if (draft) {
      this.setData({
        title: draft.title || '',
        description: draft.description || '',
        category: draft.category || '自然',
        location: draft.location || ''
      });
      wx.showToast({
        title: '已恢复文字草稿，请重新选图',
        icon: 'none'
      });
    }
    this.requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  },
  input(e) {
    if (!this.data.busy) this.setData({
      [e.currentTarget.dataset.field]: e.detail.value
    });
  },
  category(e) {
    if (!this.data.busy) this.setData({
      category: e.currentTarget.dataset.value
    });
  },
  async choose() {
    if (this.data.busy || this.data.images.length >= 9) return;
    try {
      let paths = [];
      if (wx.chooseMedia) {
        const r = await wx.chooseMedia({
          count: 9 - this.data.images.length,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed']
        });
        if (r.tempFiles.some(f => f.size > 10 * 1024 * 1024)) throw Error('图片超过 10 MB，请压缩后重试');
        paths = r.tempFiles.map(f => f.tempFilePath);
      } else {
        const r = await wx.chooseImage({
          count: 9 - this.data.images.length,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera']
        });
        if (r.tempFiles.some(f => f.size > 10 * 1024 * 1024)) throw Error('图片超过 10 MB，请压缩后重试');
        paths = r.tempFilePaths;
      }
      this.setData({
        images: this.data.images.concat(paths),
        error: ''
      });
    } catch (e) {
      if (!/cancel/.test(e.errMsg || '')) wx.showToast({
        title: e.message || '无法选图，请检查相册权限',
        icon: 'none'
      });
    }
  },
  history() {
    if (!this.data.busy) wx.switchTab({
      url: '/pages/profile/index'
    });
  },
  removeImage(e) {
    if (this.data.busy) return;
    this.setData({
      images: this.data.images.filter((_, i) => i !== e.currentTarget.dataset.index)
    });
  },
  preview(e) {
    wx.previewImage({
      current: this.data.images[e.currentTarget.dataset.index],
      urls: this.data.images
    });
  },
  saveDraft() {
    if (this.data.busy) return;
    s.write('draft', {
      title: this.data.title,
      description: this.data.description,
      category: this.data.category,
      location: this.data.location
    });
    wx.showToast({
      title: '文字草稿已保存',
      icon: 'none'
    });
  },
  async publish() {
    if (this.data.busy) return;
    if (!this.data.images.length) return wx.showToast({
      title: '先添加一张照片吧',
      icon: 'none'
    });
    if (!this.data.title.trim()) return wx.showToast({
      title: '请为作品填写标题',
      icon: 'none'
    });
    this.setData({
      busy: true,
      progress: 0,
      error: ''
    });
    try {
      const id = await s.publish(Object.assign({}, this.data, {
        requestId: this.requestId
      }), progress => this.setData({
        progress
      }));
      s.write('draft', null);
      wx.showToast({
        title: this.data.isCloud ? '发布成功' : '已保存到本机',
        icon: 'success'
      });
      wx.redirectTo({
        url: '/pages/detail/detail?id=' + encodeURIComponent(id)
      });
    } catch (e) {
      this.setData({
        error: '发布未完成：' + (e.message || '请检查网络和云环境配置') + '。照片仍保留在当前页面，可重试。'
      });
    } finally {
      this.setData({
        busy: false
      });
    }
  }
});
