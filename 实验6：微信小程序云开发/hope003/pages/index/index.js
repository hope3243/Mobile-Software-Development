var common = require('../../utils/common.js')
Page({
  data: {
    swiperImg: [
      {src: '/images/news1.jpg', title: '2026级研究生开学典礼举行', id: 1},
      {src: '/images/news2.jpg', title: '国家自然科学基金再创佳绩', id: 2},
      {src: '/images/news3.jpg', title: '学校参加山东省教育博览会', id: 3}
    ],
    newsList:[],
    showNewsList:[],
    keyword:"",
    categories: ['全部'],
    currentCategory: '全部',
    sidebarOpen: false,
    showBackTop: false,
    isDark: false
  },

  onLoad: function(options) {
    let list = common.getNewsList();
    list = list.map(item => {
      // 从缓存读取阅读量，刷新后不归零
      let readNum = wx.getStorageSync("read_" + item.id) || 0;
      item.readNum = readNum;
      if (item.content) {
        item.summary = item.content.substring(0, 20) + '...';
      } else {
        item.summary = '';
      }
      return item;
    });


    let cats = ['全部'];
    list.forEach(item => {
      if (cats.indexOf(item.category) === -1) cats.push(item.category);
    });
    this.setData({
      newsList: list,
      showNewsList: list,
      categories: cats
    });
    wx.setNavigationBarTitle({ title: '海大新闻' });
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
  },

  openSidebar: function() {
    this.setData({ sidebarOpen: true });
  },
  closeSidebar: function() {
    this.setData({ sidebarOpen: false });
  },

  switchCategory: function(e) {
    let cat = e.currentTarget.dataset.category;
    this.setData({ currentCategory: cat, keyword: '', sidebarOpen: false });
    this.filterNews();
  },

  onSearchInput(e){
    let keyword = e.detail.value.trim();
    this.setData({ keyword: keyword });
    this.filterNews();
  },

  filterNews: function() {
    let list = this.data.newsList;
    if (this.data.currentCategory !== '全部') {
      list = list.filter(item => item.category === this.data.currentCategory);
    }
    if (this.data.keyword) {
      list = list.filter(item => item.title.indexOf(this.data.keyword) !== -1);
    }
    this.setData({ showNewsList: list });
  },

  goToDetail: function(e) {
    let id = e.currentTarget.dataset.id;
    let index = this.data.newsList.findIndex(x=>x.id == id);
    if(index !== -1){
      let num = this.data.newsList[index].readNum || 0;
      num = num + 1;
      this.data.newsList[index].readNum = num;
      wx.setStorageSync("read_" + id, num);
      this.setData({ showNewsList: this.data.newsList });
    }
    wx.navigateTo({
      url: '../detail/detail?id=' + id
    })
  },

  onPageScroll: function(e) {
    if (e.scrollTop > 300 && !this.data.showBackTop) {
      this.setData({ showBackTop: true });
    } else if (e.scrollTop <= 300 && this.data.showBackTop) {
      this.setData({ showBackTop: false });
    }
  },

  backToTop: function() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  }
})
