const store = require('../../utils/store');

Component({
  properties: {
    photo: Object
  },
  data: {
    failed: false
  },
  observers: {
    'photo.cover': function() {
      this.setData({
        failed: false
      });
    }
  },
  methods: {
    open() {
      wx.navigateTo({
        url: '/pages/detail/detail?id=' + encodeURIComponent(this.data.photo._id)
      });
    },
    author() {
      wx.navigateTo({
        url: '/pages/homepage/homepage?id=' + encodeURIComponent(this.data.photo._openid) + '&name=' +
          encodeURIComponent(this.data.photo.nickName)
      });
    },
    async like() {
      if (this.liking) return;
      this.liking = true;
      try {
        const result = await store.toggleLike(this.data.photo);
        this.setData({
          'photo.liked': result.liked,
          'photo.likeCount': result.likeCount
        });
        this.triggerEvent('likechange', {
          id: this.data.photo._id,
          liked: result.liked,
          likeCount: result.likeCount
        }, {
          bubbles: true,
          composed: true
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
    fallback() {
      this.setData({
        failed: true
      });
    }
  }
});
