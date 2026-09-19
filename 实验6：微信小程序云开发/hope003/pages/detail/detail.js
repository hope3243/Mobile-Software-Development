var common = require('../../utils/common.js')
Page({
  data: {
    article: {},
    isAdd: false,
    isDark: false
  },
  onLoad: function(options) {
    let id = parseInt(options.id)   // ← 关键：转成数字
    wx.setNavigationBarTitle({ title: '新闻详情' });
    let result = common.getNewsDetail(id)
    if (result.code == '200') {
      let originArticle = result.news
      let readCache = wx.getStorageSync("read_" + id)
      if (readCache) {
        originArticle.readNum = readCache
      } else {
        originArticle.readNum = 0
      }
      // 处理富文本：本站讯加粗 + 换行转br
      let content = originArticle.content || '';
      content = content.replace(/本站讯/g, '<span style="font-weight:bold;">本站讯</span>');
      content = content.replace(/\n/g, '<br/>');
      let theme = wx.getStorageSync('theme') || 'light';
      let textColor = theme === 'dark' ? '#ccc' : '#333';
      originArticle.richContent = '<div style="font-size:30rpx;line-height:56rpx;color:' + textColor + ';text-align:left;">' + content + '</div>';

      let favList = wx.getStorageSync("favorites") || []
      let isFav = favList.indexOf(id) !== -1   // 现在 id 是数字，能匹配上
      this.setData({
        article: originArticle,
        isAdd: isFav
      })
    }
  },
  onShow: function() {
    let theme = wx.getStorageSync('theme') || 'light'
    this.setData({ isDark: theme === 'dark' })
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#003d7a'
    })
  },
  addFavorites: function() {
    let isLogin = wx.getStorageSync('isLogin') && wx.getStorageSync('userInfo')
    if (!isLogin) {
      wx.showModal({
        title: '提示',
        content: '收藏前请先登录',
        confirmText: '去登录',
        cancelText: '暂不',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/my/my' })
          }
        }
      })
      return
    }
    let favList = wx.getStorageSync("favorites") || []
    let article = this.data.article
    if (favList.indexOf(article.id) === -1) {
      favList.push(article.id)
      wx.setStorageSync("favorites", favList)
      wx.setStorageSync(article.id, article)
    }
    this.setData({ isAdd: true })
    wx.showToast({ title: '收藏成功', icon: 'success' })
  },
  cancelFavorites: function() {
    let article = this.data.article
    let favList = wx.getStorageSync("favorites") || []
    let newFav = favList.filter(item => item !== article.id)
    wx.setStorageSync("favorites", newFav)
    wx.removeStorageSync(article.id)
    this.setData({ isAdd: false })
    wx.showToast({ title: '已取消收藏', icon: 'none' })
  }
})
