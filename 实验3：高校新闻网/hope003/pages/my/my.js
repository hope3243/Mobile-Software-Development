var common = require('../../utils/common.js')
Page({
  data: {
    isLogin: false,
    showLoginForm: false,
    src: '/images/index.png',
    nickName: '未登录',
    userInfo: {
      avatarUrl: '/images/index.png',
      nickName: ''
    },
    newsList: [],
    num: 0,
    isDark: false
  },
  onLoad: function() {
    wx.setNavigationBarTitle({ title: '我的' });
    if (wx.getStorageSync('isLogin') && wx.getStorageSync('userInfo')) {
      let ui = wx.getStorageSync('userInfo') || {};
      this.setData({
        isLogin: true,
        src: ui.avatarUrl || '/images/index.png',
        nickName: ui.nickName || '未登录'
      });
      this.getMyFavorites();
    }
  },
  onShow: function() {
    let theme = wx.getStorageSync('theme') || 'light';
    this.setData({ isDark: theme === 'dark' });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#003d7a'
    });
    wx.setTabBarStyle({
      color: theme === 'dark' ? '#888888' : '#333333',
      selectedColor: theme === 'dark' ? '#6ab0ff' : '#003d7a',
      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
      borderStyle: theme === 'dark' ? 'black' : 'white'
    });
    if (this.data.isLogin) {
      this.getMyFavorites()
    }
  },
  toggleTheme: function() {
    let newTheme = this.data.isDark ? 'light' : 'dark';
    wx.setStorageSync('theme', newTheme);
    this.setData({ isDark: newTheme === 'dark' });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: newTheme === 'dark' ? '#1a1a1a' : '#003d7a'
    });
    wx.setTabBarStyle({
      color: newTheme === 'dark' ? '#888888' : '#333333',
      selectedColor: newTheme === 'dark' ? '#6ab0ff' : '#003d7a',
      backgroundColor: newTheme === 'dark' ? '#1a1a1a' : '#ffffff',
      borderStyle: newTheme === 'dark' ? 'black' : 'white'
    });
  },
  showLogin: function() {
    this.setData({ showLoginForm: true });
  },
  hideLogin: function() {
    this.setData({ showLoginForm: false });
  },
  onChooseAvatar: function(e) {
    this.setData({
      'userInfo.avatarUrl': e.detail.avatarUrl
    });
  },
  onInputChange: function(e) {
    this.setData({
      'userInfo.nickName': e.detail.value
    });
  },
  confirmLogin: function() {
    let ui = this.data.userInfo;
    if (!ui.nickName || !ui.nickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    this.doLogin(ui.avatarUrl || '/images/index.png', ui.nickName.trim());
  },
  doLogin: function(avatarUrl, nickName) {
    this.setData({
      isLogin: true,
      showLoginForm: false,
      src: avatarUrl,
      nickName: nickName
    });
    wx.setStorageSync('isLogin', true);
    wx.setStorageSync('userInfo', { avatarUrl: avatarUrl, nickName: nickName });
    wx.showToast({ title: '登录成功', icon: 'success' });
    this.getMyFavorites();
  },
  logout: function() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('isLogin');
          wx.removeStorageSync('userInfo');
          this.setData({
            isLogin: false,
            showLoginForm: false,
            src: '/images/index.png',
            nickName: '未登录',
            newsList: [],
            num: 0
          });
        }
      }
    })
  },
  getMyFavorites: function() {
    let favList = wx.getStorageSync("favorites") || [];
    let myList = [];
    let allNews = common.getNewsList();
    for(let i=0;i<favList.length;i++){
      let newsId = favList[i];
      let cacheNews = wx.getStorageSync(newsId);
      if(cacheNews){
        let readNum = wx.getStorageSync("read_" + newsId) || 0;
        cacheNews.readNum = readNum;
        if (cacheNews.content) {
          cacheNews.summary = cacheNews.content.substring(0, 20) + '...';
        } else {
          cacheNews.summary = '';
        }
        myList.push(cacheNews);
      }else{
        let one = allNews.find(n=>n.id === newsId);
        if(one){
          if (one.content) {
            one.summary = one.content.substring(0, 20) + '...';
          }
          myList.push(one);
        }
      }
    }
    let num = myList.length;
    this.setData({
      newsList: myList,
      num: num
    })
  },
  goToDetail: function(e) {
    let id = e.currentTarget.dataset.id;
    let readNum = wx.getStorageSync("read_" + id) || 0;
    readNum = readNum + 1;
    wx.setStorageSync("read_" + id, readNum);
    let idx = this.data.newsList.findIndex(x => x.id == id);
    if (idx !== -1) {
      this.data.newsList[idx].readNum = readNum;
      this.setData({ newsList: this.data.newsList });
    }
    let cacheNews = wx.getStorageSync(id);
    if (cacheNews) {
      cacheNews.readNum = readNum;
      wx.setStorageSync(id, cacheNews);
    }
    wx.navigateTo({
      url: '../detail/detail?id=' + id
    })
  }
})
