const data = require('../../utils/data.js')

const STORAGE_KEY = 'sokoban_progress_v1'

/**
 * 秒 -> mm:ss
 */
function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s)
}

Page({
  data: {
    statusBarHeight: 20,
    navRightOffset: 96,
    levels: [],
    clearedCount: 0,
    totalCount: 0,
    showUnlock: false,
    unlockQuestion: '🐥的敌人是谁？',
    unlockOptions: [
      { label: '猪', correct: true },
      { label: '猫', correct: false },
      { label: '狗', correct: false }
    ]
  },

  onLoad: function () {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    // 避开右上角胶囊按钮：根据胶囊位置计算导航栏右侧留白
    let navRightOffset = 96
    try {
      const menu = wx.getMenuButtonBoundingClientRect()
      if (menu && menu.left) {
        navRightOffset = Math.max(80, (info.windowWidth || 375) - menu.left + 10)
      }
    } catch (err) {
      /* 忽略 */
    }
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      totalCount: data.levels.length,
      navRightOffset: navRightOffset
    })
  },

  onShow: function () {
    this.loadProgress()
  },

  loadProgress: function () {
    const progress = wx.getStorageSync(STORAGE_KEY) || { unlocked: 1, best: {} }
    const list = data.levels.map(function (item, index) {
      const best = (progress.best && progress.best[index]) || null
      return {
        index: index,
        name: item.name,
        image: '/images/level0' + (index + 1) + '.png',
        unlocked: index < (progress.unlocked || 1),
        bestMoves: best ? best.moves : null,
        bestTime: best ? formatTime(best.time) : null
      }
    })
    const cleared = list.filter(function (item) { return item.bestMoves !== null }).length
    this.setData({ levels: list, clearedCount: cleared })
  },

  /**
   * 点击关卡 -> 进入游戏页
   */
  chooseLevel: function (e) {
    const level = e.currentTarget.dataset.level
    const item = this.data.levels[level]
    if (!item || !item.unlocked) {
      wx.showToast({ title: '先通关前面的关卡吧', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/game/game?level=' + level
    })
  },

  /**
   * 打开破解版解锁问答
   */
  openUnlock: function () {
    this.setData({ showUnlock: true })
  },

  closeUnlock: function () {
    this.setData({ showUnlock: false })
  },

  /**
   * 回答问题：正确则一键解锁全部关卡
   */
  answerUnlock: function (e) {
    const correct = e.currentTarget.dataset.correct
    if (correct === true || correct === 'true') {
      const progress = wx.getStorageSync(STORAGE_KEY) || { unlocked: 1, best: {} }
      progress.unlocked = data.levels.length
      wx.setStorageSync(STORAGE_KEY, progress)
      this.setData({ showUnlock: false })
      this.loadProgress()
      wx.showToast({ title: '破解成功！全部关卡已解锁 🎉', icon: 'none' })
    } else {
      wx.showToast({ title: '答错啦，再想想～', icon: 'none' })
    }
  },

  noop: function () {},

  /**
   * 重置全部游戏进度
   */
  resetProgress: function () {
    const self = this
    wx.showModal({
      title: '重置进度',
      content: '确定要清空所有关卡的最佳纪录和通关进度吗？',
      confirmText: '重置',
      confirmColor: '#ef4444',
      success: function (res) {
        if (res.confirm) {
          wx.removeStorageSync(STORAGE_KEY)
          self.loadProgress()
          wx.showToast({ title: '已重置', icon: 'success' })
        }
      }
    })
  }
})
