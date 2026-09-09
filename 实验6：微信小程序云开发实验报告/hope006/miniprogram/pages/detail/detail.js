const s = require('../../utils/store');
Page({
  data: {
    photo: null,
    loading: true,
    error: '',
    current: 0,
    mine: false,
    downloading: false,
    deleting: false,
    shareable: false,
    imageFailed: false,
    commentText: '',
    commentFocused: false,
    commenting: false
  },
  onLoad(o) {
    this.id = o.id;
    this.load();
  },
  async load() {
    this.setData({
      loading: true,
      error: ''
    });
    try {
      const p = await s.detail(this.id || '');
      let mine = false;
      try {
        mine = p._openid === await s.identity();
      } catch (e) {}
      this.setData({
        photo: p,
        mine,
        initial: p.nickName.slice(0, 1),
        shareable: !p._id.startsWith('local-')
      });
      if (p._id.startsWith('local-')) wx.hideShareMenu();
    } catch (e) {
      this.setData({
        error: e.message || '作品暂时无法加载'
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
  slide(e) {
    this.setData({
      current: e.detail.current
    });
  },
  imageError() {
    this.setData({
      imageFailed: true
    });
  },
  preview() {
    wx.previewImage({
      current: this.data.photo.images[this.data.current],
      urls: this.data.photo.images,
      fail() {
        wx.showToast({
          title: '原图暂时无法打开',
          icon: 'none'
        });
      }
    });
  },
  async like() {
    if (this.liking) return;
    this.liking = true;
    try {
      const result = await s.toggleLike(this.data.photo);
      this.setData({
        'photo.liked': result.liked,
        'photo.likeCount': result.likeCount
      });
    } catch (e) {
      wx.showToast({
        title: '点赞失败，请稍后重试',
        icon: 'none'
      });
    } finally {
      this.liking = false;
    }
  },
  async save() {
    if (this.saving) return;
    this.saving = true;
    try {
      const result = await s.toggleFavorite(this.data.photo);
      this.setData({
        'photo.saved': result.saved,
        'photo.favoriteCount': result.favoriteCount
      });
      wx.showToast({
        title: result.saved ? '已收藏' : '已取消收藏',
        icon: 'none'
      });
    } catch (e) {
      wx.showToast({
        title: '收藏失败，请稍后重试',
        icon: 'none'
      });
    } finally {
      this.saving = false;
    }
  },
  focusComment() {
    this.setData({
      commentFocused: true
    });
    wx.pageScrollTo({
      selector: '#comments',
      duration: 300
    });
  },
  commentInput(e) {
    this.setData({
      commentText: e.detail.value
    });
  },
  async sendComment() {
    const content = this.data.commentText.trim();
    if (!content || this.data.commenting) return;
    this.setData({
      commenting: true
    });
    try {
      const result = await s.addComment(this.data.photo, content);
      const comment = Object.assign({}, result.comment, {
        time: '刚刚'
      });
      this.setData({
        'photo.comments': this.data.photo.comments.concat(comment),
        'photo.commentCount': result.commentCount,
        commentText: '',
        commentFocused: false
      });
    } catch (e) {
      wx.showToast({
        title: e.message || '评论发送失败',
        icon: 'none'
      });
    } finally {
      this.setData({
        commenting: false
      });
    }
  },
  async removeComment(e) {
    const id = e.currentTarget.dataset.id;
    const result = await wx.showModal({
      title: '删除这条评论？',
      confirmText: '删除',
      confirmColor: '#aa6050'
    });
    if (!result.confirm) return;
    try {
      const response = await s.removeComment(this.data.photo, id);
      this.setData({
        'photo.comments': this.data.photo.comments.filter(item => item._id !== id),
        'photo.commentCount': response.commentCount
      });
    } catch (error) {
      wx.showToast({
        title: '评论删除失败',
        icon: 'none'
      });
    }
  },
  author() {
    const p = this.data.photo;
    wx.navigateTo({
      url: '/pages/homepage/homepage?id=' + encodeURIComponent(p._openid) + '&name=' +
        encodeURIComponent(p.nickName)
    });
  },
  async download() {
    if (this.data.downloading) return;
    this.setData({
      downloading: true
    });
    try {
      let p = this.data.photo.images[this.data.current];
      if (p.startsWith('cloud://')) p = (await wx.cloud.downloadFile({
        fileID: p
      })).tempFilePath;
      else if (/^https?:/.test(p)) {
        const r = await wx.downloadFile({
          url: p
        });
        if (r.statusCode !== 200) throw Error('下载失败');
        p = r.tempFilePath;
      }
      await wx.saveImageToPhotosAlbum({
        filePath: p
      });
      wx.showToast({
        title: '已保存到相册'
      });
    } catch (e) {
      if (/auth deny|auth denied|authorize|permission/.test(e.errMsg || '')) {
        const r = await wx.showModal({
          title: '需要相册权限',
          content: '允许保存图片后，才能将作品存入手机相册。',
          confirmText: '去设置'
        });
        if (r.confirm) wx.openSetting();
      } else wx.showToast({
        title: '保存失败，请检查网络或在真机重试',
        icon: 'none'
      });
    } finally {
      this.setData({
        downloading: false
      });
    }
  },
  async remove() {
    if (this.data.deleting) return;
    const r = await wx.showModal({
      title: '删除这件作品？',
      content: '删除后将无法恢复，请确认是否继续。',
      confirmText: '删除',
      confirmColor: '#aa6050'
    });
    if (!r.confirm) return;
    this.setData({
      deleting: true
    });
    try {
      await s.remove(this.data.photo);
      wx.showToast({
        title: '已删除'
      });
      wx.switchTab({
        url: '/pages/profile/index'
      });
    } catch (e) {
      wx.showToast({
        title: '删除失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({
        deleting: false
      });
    }
  },
  localShare() {
    wx.showModal({
      title: '这是一件本地作品',
      content: '本地图片无法生成好友可访问的作品链接。连接云环境并重新发布后即可分享，也可以保存图片后自行发送。',
      showCancel: false
    });
  },
  home() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },
  onShareAppMessage() {
    const p = this.data.photo;
    return p && !p._id.startsWith('local-') ? {
      title: p.title + '｜拾光',
      path: '/pages/detail/detail?id=' + encodeURIComponent(p._id),
      imageUrl: p.cover
    } : {
      title: '拾光｜记录生活的光',
      path: '/pages/index/index'
    };
  }
});
