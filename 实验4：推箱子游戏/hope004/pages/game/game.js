/**
 * 推箱子游戏 - 游戏页（hope004.1 增强版）
 *
 * 特性：
 *  - 新版 Canvas 2D 接口 + DPR 高清适配，老师提供的图标绘制（失败时回退矢量）
 *  - 连续动画循环：目标点角色呼吸、主角移动时跳跃/拉伸并“看向”移动方向
 *  - 每关开场剧情气泡、通关后主角祝贺 + 数字滚动动画
 *  - 步数/推箱/计时、撤销、手势滑动、最佳纪录、关卡解锁、选关面板、彩带庆祝
 */
const data = require('../../utils/data.js')

const STORAGE_KEY = 'sokoban_progress_v1'
const ROWS = 8
const COLS = 8

/**
 * 秒 -> mm:ss
 */
function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s)
}

/**
 * 圆角矩形路径
 */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * 五角星路径
 */
function starPath(ctx, cx, cy, outer, inner) {
  ctx.beginPath()
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const px = cx + r * Math.cos(a)
    const py = cy + r * Math.sin(a)
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/**
 * easeInOutCubic
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * easeOutBack（带一点回弹，用于星星/气泡弹出）
 */
function easeOutBack(t) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

Page({
  data: {
    statusBarHeight: 20,
    navRightOffset: 96,
    canvasSize: 320,
    level: 1,                 // 第几关（1 开始）
    levelName: '',
    moves: 0,
    pushes: 0,
    timeStr: '00:00',
    bestMoves: null,
    bestTime: null,
    totalLevels: data.levels.length,
    // 剧情
    showStory: false,
    storyText: '',
    // 过关弹层
    showWin: false,
    isNewRecord: false,
    isLastLevel: false,
    winLine: '',
    soundOn: true,
    winStats: { moves: 0, pushes: 0, time: '00:00' },
    confetti: [],
    // 选关弹层
    showLevelPicker: false,
    pickerLevels: []
  },

  /* ==================== 生命周期 ==================== */

  onLoad: function (options) {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const levelIdx = parseInt(options.level, 10)
    this.levelIdx = Math.min(Math.max(isNaN(levelIdx) ? 0 : levelIdx, 0), data.levels.length - 1)

    const winWidth = info.windowWidth || 375
    const winHeight = info.windowHeight || 667
    // 根据屏幕尺寸自适应画布大小，避免小屏被裁切
    const canvasSize = Math.max(300, Math.min(winWidth - 48, winHeight - 460, 372))

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
      navRightOffset: navRightOffset,
      canvasSize: canvasSize,
      level: this.levelIdx + 1,
      levelName: data.levels[this.levelIdx].name,
      storyText: data.levels[this.levelIdx].story || '把箱子推到金色圈圈里，救出小猪吧！',
      showStory: true
    })
    this.loadProgress()
    this.initAudio()
  },

  onReady: function () {
    this.initCanvas()
  },

  onShow: function () {
    if (this.bgmStarted && this.soundOn && this.bgm) {
      this.bgm.play()
    }
  },

  onHide: function () {
    this.pauseBgm()
  },

  onUnload: function () {
    this.stopTimer()
    this.stopRenderLoop()
    if (this.statsTimer) {
      clearInterval(this.statsTimer)
      this.statsTimer = null
    }
    this.destroyAudio()
  },

  /* ==================== 进度存取 ==================== */

  getProgress: function () {
    const p = wx.getStorageSync(STORAGE_KEY) || { unlocked: 1, best: {} }
    if (p.sound === undefined) p.sound = true
    return p
  },

  loadProgress: function () {
    const progress = this.getProgress()
    const best = (progress.best && progress.best[this.levelIdx]) || null
    this.progress = progress
    this.soundOn = progress.sound !== false
    this.setData({
      bestMoves: best ? best.moves : null,
      bestTime: best ? formatTime(best.time) : null,
      soundOn: progress.sound !== false
    })
  },

  /* ==================== 画布初始化 ==================== */

  initCanvas: function () {
    const self = this
    const query = wx.createSelectorQuery()
    query.select('#gameCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const dpr = info.pixelRatio || 2
      canvas.width = res[0].width * dpr
      canvas.height = res[0].height * dpr
      ctx.scale(dpr, dpr)

      self.canvas = canvas
      self.ctx = ctx
      self.cw = res[0].width
      self.ch = res[0].height
      self.cell = Math.floor(Math.min(self.cw, self.ch) / ROWS)
      self.offsetX = Math.floor((self.cw - self.cell * COLS) / 2)
      self.offsetY = Math.floor((self.ch - self.cell * ROWS) / 2)

      self.imgReady = false
      self.imgs = {}
      self.initMap()
      self.loadIcons()
      self.startRenderLoop()
    })
  },

  /* ==================== 地图初始化 ==================== */

  initMap: function () {
    const grid = data.levels[this.levelIdx].map
    this.map = []
    this.box = []
    for (let i = 0; i < ROWS; i++) {
      this.map[i] = []
      this.box[i] = []
      for (let j = 0; j < COLS; j++) {
        const v = grid[i][j]
        if (v === 1 || v === 2 || v === 3) {
          this.map[i][j] = v
          this.box[i][j] = 0
        } else if (v === 4) {
          this.map[i][j] = 2
          this.box[i][j] = 4
        } else if (v === 5) {
          this.map[i][j] = 2
          this.box[i][j] = 0
          this.player = { r: i, c: j }
        } else {
          this.map[i][j] = 0
          this.box[i][j] = 0
        }
      }
    }
    this.dir = 1
    this.moves = 0
    this.pushes = 0
    this.history = []
    this.anim = null
    this.animating = false
    this.won = false
    this.facing = 1
    this.flipAnim = null
    this.fx = []
    this.bubbles = []
    this.boxArrived = {}
    this._last = 0
    this.stopTimer()
    this.timerStarted = false
    this.setData({
      moves: 0,
      pushes: 0,
      timeStr: '00:00',
      showWin: false,
      showLevelPicker: false
    })
    this.loadProgress()
  },

  /* ==================== 移动逻辑 ==================== */

  tryMove: function (dr, dc) {
    if (this.animating || this.won || !this.map || !this.player) return
    const r = this.player.r + dr
    const c = this.player.c + dc
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return

    // 撞墙
    if (this.map[r][c] === 1) {
      this.playSfx('bump')
      this.vibrate('light')
      return
    }

    let boxMove = null
    // 前方是箱子
    if (this.box[r][c] === 4) {
      const br = r + dr
      const bc = c + dc
      if (br < 0 || br >= ROWS || bc < 0 || bc >= COLS) return
      if (this.map[br][bc] === 1 || this.box[br][bc] === 4) {
        this.vibrate('light')
        return
      }
      boxMove = { fr: r, fc: c, tr: br, tc: bc }
    }

    // 记录历史（用于撤销）
    this.history.push({
      r: this.player.r,
      c: this.player.c,
      boxes: this.cloneBoxes(),
      moves: this.moves,
      pushes: this.pushes
    })

    const from = { r: this.player.r, c: this.player.c }

    if (boxMove) {
      this.box[boxMove.fr][boxMove.fc] = 0
      this.box[boxMove.tr][boxMove.tc] = 4
      this.pushes += 1
      // 推箱画面反馈：尘土粒子 + 冲击波纹
      this.spawnPushFx(boxMove, dr, dc)
    }
    this.player.r = r
    this.player.c = c
    this.dir = dr === -1 ? 0 : dr === 1 ? 1 : dc === -1 ? 2 : 3
    // 左右移动时更新面向：向左=镜像朝左，向右=正常朝右，并做平滑翻转动画
    if (dc !== 0) {
      const wantFacing = dc === -1 ? -1 : 1
      if (wantFacing !== this.facing) {
        if (this.noRaf) {
          this.facing = wantFacing
        } else {
          this.flipAnim = { t0: Date.now(), dur: 180, from: this.facing, to: wantFacing }
          this.facing = wantFacing
        }
      }
    }
    this.moves += 1

    if (!this.timerStarted) this.startTimer()
    this.setData({ moves: this.moves, pushes: this.pushes })
    this.playSfx(boxMove ? 'push' : 'move')
    this.vibrate()

    // 没有 rAF 时直接更新（不做过渡动画）
    if (this.noRaf) {
      this.draw()
      this.checkWin()
      return
    }

    this.anim = {
      t0: Date.now(),
      dur: 160,
      from: from,
      to: { r: r, c: c },
      boxMoves: boxMove ? [boxMove] : [],
      dir: this.dir
    }
    this.animating = true
  },

  /* ==================== 渲染循环 ==================== */

  startRenderLoop: function () {
    const self = this
    if (!this.canvas || !this.canvas.requestAnimationFrame) {
      this.noRaf = true
      this.draw()
      return
    }
    this.looping = true
    const loop = function () {
      if (!self.looping || !self.ctx) return
      self.tick()
      self.rafId = self.canvas.requestAnimationFrame(loop)
    }
    this.rafId = this.canvas.requestAnimationFrame(loop)
  },

  stopRenderLoop: function () {
    this.looping = false
    if (this.canvas && this.rafId) {
      this.canvas.cancelAnimationFrame(this.rafId)
    }
  },

  tick: function () {
    const now = Date.now()
    const a = this.anim

    // 处理移动动画状态
    if (a && this.player) {
      const t = Math.min(1, (now - a.t0) / a.dur)
      const e = easeInOutCubic(t)
      this.animPos = {
        row: a.from.r + (a.to.r - a.from.r) * e,
        col: a.from.c + (a.to.c - a.from.c) * e,
        progress: t,
        dir: a.dir,
        boxMoves: a.boxMoves
      }
      if (t >= 1) {
        this.anim = null
        this.animating = false
        this.animPos = null
        this.checkWin()
      }
    } else {
      this.animPos = null
    }

    // 推箱过程中持续冒烟（常驻动效）
    if (this.animPos && this.animPos.boxMoves.length && !this.noRaf) {
      this.emitPushTrail(this.animPos.boxMoves[0], this.animPos.progress)
    }

    // 更新箱子到达目标点的状态（星星弹出 + 目标角色语气泡）
    this.updateBoxArrivals(now)

    this.renderScene(now)
  },

  /**
   * 绘制整帧画面（支持移动动画与待机动画）
   */
  renderScene: function (now) {
    if (!this.ctx) return
    const ctx = this.ctx
    // 计算帧间隔并更新特效（尘土/波纹）
    const dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0.016
    this._last = now
    this.updateFx(dt)

    ctx.clearRect(0, 0, this.cw, this.ch)

    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        if (this.map[i][j] !== 0) this.drawTile(i, j, now)
      }
    }

    // 箱子（移动中的箱子取插值位置）
    const moving = {}
    if (this.animPos && this.animPos.boxMoves.length) {
      this.animPos.boxMoves.forEach(function (m) {
        moving[m.tr + ',' + m.tc] = m
      })
    }
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        if (this.box[i][j] !== 4) continue
        const m = moving[i + ',' + j]
        if (m) {
          const row = m.fr + (m.tr - m.fr) * this.animPos.progress
          const col = m.fc + (m.tc - m.fc) * this.animPos.progress
          this.drawBox(row, col, this.isOnTarget(m.tr, m.tc), this.animPos.progress, this.animPos.dir, now)
        } else {
          this.drawBox(i, j, this.isOnTarget(i, j), undefined, undefined, now)
        }
      }
    }

    // 玩家
    if (this.player) {
      if (this.animPos) {
        this.drawPlayer(this.animPos.row, this.animPos.col, this.animPos.dir, this.animPos.progress, now)
      } else {
        this.drawPlayer(this.player.r, this.player.c, this.dir, -1, now)
      }
    }

    // 特效（尘土/波纹）绘制在最上层
    this.drawFx()

    // 目标角色语气泡
    this.drawBubbles(now)
  },

  draw: function () {
    this.renderScene(Date.now())
  },

  /* ==================== 绘制单元 ==================== */

  drawTile: function (i, j, now) {
    const v = this.map[i][j]
    if (v === 0) return
    if (v === 1) {
      if (this.imgReady && this.imgs.stone) this.drawImg(this.imgs.stone, i, j)
      else this.drawWall(i, j)
      return
    }
    if (this.imgReady && this.imgs.ice) this.drawImg(this.imgs.ice, i, j)
    else this.drawFloor(i, j)

    if (v === 3) {
      if (this.imgReady && this.imgs.pig) {
        // 目标点角色原地“呼吸”脉动
        const c = this.cell
        const cx = this.offsetX + j * c + c / 2
        const cy = this.offsetY + i * c + c / 2
        const pulse = 1 + Math.sin(now / 380 + i * 0.9 + j * 0.9) * 0.05
        const ctx = this.ctx
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(pulse, pulse)
        ctx.drawImage(this.imgs.pig, -c / 2, -c / 2, c, c)
        ctx.restore()
      } else {
        this.drawTarget(i, j)
      }
    }
  },

  drawImg: function (img, row, col) {
    const c = this.cell
    this.ctx.drawImage(img, this.offsetX + col * c, this.offsetY + row * c, c, c)
  },

  /**
   * 当前面向系数：1=正常，-1=镜像朝左；翻转动画期间返回平滑插值
   */
  getFacing: function (now) {
    if (this.flipAnim) {
      const t = Math.min(1, (now - this.flipAnim.t0) / this.flipAnim.dur)
      const e = easeInOutCubic(t)
      const f = this.flipAnim.from + (this.flipAnim.to - this.flipAnim.from) * e
      if (t >= 1) this.flipAnim = null
      return f
    }
    return this.facing
  },

  /**
   * 推箱子时的画面反馈：尘土粒子 + 冲击波纹
   */
  spawnPushFx: function (boxMove, dr, dc) {
    if (this.noRaf || !this.cell) return
    const c = this.cell
    const bx = this.offsetX + (boxMove.fc + 0.5) * c
    const by = this.offsetY + (boxMove.fr + 0.5) * c
    for (let k = 0; k < 11; k++) {
      this.fx.push({
        type: 'dust',
        x: bx + (Math.random() - 0.5) * c * 0.6,
        y: by + (Math.random() - 0.5) * c * 0.6,
        vx: -dc * (20 + Math.random() * 60) + (Math.random() - 0.5) * 40,
        vy: -dr * (20 + Math.random() * 60) + (Math.random() - 0.5) * 40 - 20,
        life: 1,
        decay: 0.022 + Math.random() * 0.02,
        size: c * (0.07 + Math.random() * 0.09),
        color: 'rgba(160, 128, 92, '
      })
    }
    this.fx.push({
      type: 'ring',
      x: bx,
      y: by,
      life: 1,
      decay: 0.07,
      radius: c * 0.18,
      maxR: c * 0.62
    })
  },

  /**
   * 推箱过程中持续冒烟（每帧从箱子当前位置飘出少量尘土）
   */
  emitPushTrail: function (boxMove, progress) {
    const c = this.cell
    const row = boxMove.fr + (boxMove.tr - boxMove.fr) * progress
    const col = boxMove.fc + (boxMove.tc - boxMove.fc) * progress
    const bx = this.offsetX + (col + 0.5) * c
    const by = this.offsetY + (row + 0.5) * c
    const dr = boxMove.tr > boxMove.fr ? 1 : boxMove.tr < boxMove.fr ? -1 : 0
    const dc = boxMove.tc > boxMove.fc ? 1 : boxMove.tc < boxMove.fc ? -1 : 0
    this.fx.push({
      type: 'dust',
      x: bx + (Math.random() - 0.5) * c * 0.4,
      y: by + (Math.random() - 0.5) * c * 0.4,
      vx: -dc * (30 + Math.random() * 40) + (Math.random() - 0.5) * 20,
      vy: -dr * (30 + Math.random() * 40) + (Math.random() - 0.5) * 20 - 20,
      life: 1,
      decay: 0.05 + Math.random() * 0.03,
      size: c * (0.05 + Math.random() * 0.07),
      color: 'rgba(170, 138, 100, '
    })
  },

  /**
   * 更新每个箱子的“到达目标点”时间，用于星星弹出与目标角色语气泡
   */
  updateBoxArrivals: function (now) {
    if (!this.box) return
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        if (this.box[i][j] !== 4) continue
        const key = i + ',' + j
        if (this.isOnTarget(i, j)) {
          if (this.boxArrived[key] === undefined) {
            this.boxArrived[key] = now
            this.spawnPigBubble(i, j)
          }
        } else if (this.boxArrived[key] !== undefined) {
          delete this.boxArrived[key]
        }
      }
    }
  },

  /**
   * 目标点星星的缩放：刚到达时回弹弹出，之后持续呼吸
   */
  getStarScale: function (row, col, now) {
    const key = Math.round(row) + ',' + Math.round(col)
    const arrivedAt = this.boxArrived[key]
    if (typeof arrivedAt !== 'number') return 1
    const t = Math.min(1, (now - arrivedAt) / 420)
    const pop = easeOutBack(t)
    const breathe = 1 + 0.12 * Math.sin(now / 280)
    return Math.max(0, pop) * breathe
  },

  /**
   * 目标点角色被箱子压住时的语气词气泡
   */
  spawnPigBubble: function (r, c) {
    const list = ['呃啊！', '哎哟！', '轻点轻点！', '被压扁啦～', '救命呀！']
    const text = list[Math.floor(Math.random() * list.length)]
    this.bubbles.push({ r: r, c: c, text: text, t0: Date.now(), dur: 1400 })
    this.playSfx('bubble')
    if (this.bubbles.length > 3) this.bubbles.shift()
  },

  /**
   * 在画布上绘制目标角色语气泡（弹出 + 淡出）
   */
  drawBubbles: function (now) {
    if (!this.bubbles.length) return
    const ctx = this.ctx
    const c = this.cell
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]
      const age = now - b.t0
      if (age >= b.dur) {
        this.bubbles.splice(i, 1)
        continue
      }
      const fadeIn = Math.min(1, age / 120)
      const fadeOut = Math.min(1, (b.dur - age) / 250)
      const alpha = Math.min(fadeIn, fadeOut)
      const pop = easeOutBack(Math.min(1, age / 250))
      const cx = this.offsetX + (b.c + 0.5) * c
      const cy = this.offsetY + b.r * c
      const fontSize = Math.round(c * 0.3)
      ctx.font = 'bold ' + fontSize + 'px sans-serif'
      const textW = ctx.measureText(b.text).width
      const bw = textW + fontSize * 0.9
      const bh = fontSize * 1.5
      const bx = cx - bw / 2
      const by = cy - bh - c * 0.22
      ctx.save()
      ctx.globalAlpha = Math.max(0, alpha)
      ctx.translate(cx, by + bh / 2)
      ctx.scale(pop, pop)
      // 气泡主体
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = 'rgba(122, 74, 34, 0.55)'
      ctx.lineWidth = 2
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 10)
      ctx.fill()
      ctx.stroke()
      // 小尾巴
      ctx.beginPath()
      ctx.moveTo(-7, bh / 2 - 2)
      ctx.lineTo(0, bh / 2 + 12)
      ctx.lineTo(7, bh / 2 - 2)
      ctx.closePath()
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = 'rgba(122, 74, 34, 0.55)'
      ctx.lineWidth = 2
      ctx.stroke()
      // 文字
      ctx.fillStyle = '#7a4a22'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(b.text, 0, 0)
      ctx.restore()
    }
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
  },

  updateFx: function (dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]
      f.life -= f.decay
      if (f.type === 'dust') {
        f.x += f.vx * dt
        f.y += f.vy * dt
      }
      if (f.life <= 0) this.fx.splice(i, 1)
    }
  },

  drawFx: function () {
    if (!this.fx.length) return
    const ctx = this.ctx
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i]
      if (f.type === 'dust') {
        ctx.fillStyle = f.color + Math.max(0, f.life) + ')'
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.size * f.life, 0, Math.PI * 2)
        ctx.fill()
      } else if (f.type === 'ring') {
        const r = f.radius + (f.maxR - f.radius) * (1 - f.life)
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + Math.max(0, f.life) * 0.6 + ')'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  },

  /**
   * 预加载老师提供的游戏图标（ice/stone/pig/box/bird）
   */
  loadIcons: function () {
    const self = this
    const list = [
      { name: 'ice', path: '/images/icons/ice.png' },
      { name: 'stone', path: '/images/icons/stone.png' },
      { name: 'pig', path: '/images/icons/pig.png' },
      { name: 'box', path: '/images/icons/box.png' },
      { name: 'bird', path: '/images/icons/bird.png' }
    ]
    let done = 0
    const finish = function () {
      done++
      if (done >= list.length) {
        self.imgReady = true
        if (self.noRaf) self.draw()
      }
    }
    list.forEach(function (item) {
      const img = self.canvas.createImage()
      img.onload = function () {
        self.imgs[item.name] = img
        finish()
      }
      img.onerror = function () {
        finish()
      }
      img.src = item.path
    })
  },

  drawFloor: function (i, j) {
    const ctx = this.ctx
    const c = this.cell
    const x = this.offsetX + j * c
    const y = this.offsetY + i * c
    ctx.fillStyle = (i + j) % 2 === 0 ? '#f8f1e3' : '#efe5cf'
    roundRect(ctx, x + 1, y + 1, c - 2, c - 2, 7)
    ctx.fill()
  },

  drawWall: function (i, j) {
    const ctx = this.ctx
    const c = this.cell
    const x = this.offsetX + j * c
    const y = this.offsetY + i * c
    const g = ctx.createLinearGradient(x, y, x, y + c)
    g.addColorStop(0, '#aebbd8')
    g.addColorStop(0.55, '#8b99ba')
    g.addColorStop(1, '#6d7ca0')
    ctx.fillStyle = g
    roundRect(ctx, x + 1, y + 1, c - 2, c - 2, 7)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    roundRect(ctx, x + 3, y + 3, c - 6, (c - 6) * 0.32, 5)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.14)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 4, y + c / 2)
    ctx.lineTo(x + c - 4, y + c / 2)
    ctx.moveTo(x + c / 2, y + 4)
    ctx.lineTo(x + c / 2, y + c / 2)
    ctx.stroke()
  },

  drawTarget: function (i, j) {
    const ctx = this.ctx
    const c = this.cell
    const x = this.offsetX + j * c
    const y = this.offsetY + i * c
    const cx = x + c / 2
    const cy = y + c / 2
    ctx.strokeStyle = '#e39a1d'
    ctx.lineWidth = Math.max(2, c * 0.08)
    ctx.beginPath()
    ctx.arc(cx, cy, c * 0.3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#f5b83d'
    ctx.beginPath()
    ctx.arc(cx, cy, c * 0.1, 0, Math.PI * 2)
    ctx.fill()
  },

  isOnTarget: function (r, c) {
    return this.map[r][c] === 3
  },

  drawBox: function (row, col, onTarget, pushProgress, pushDir, now) {
    const ctx = this.ctx
    const c = this.cell
    if (this.imgReady && this.imgs.box) {
      // 目标点上的星星：弹出动画 + 持续呼吸
      const starScale = this.getStarScale(row, col, now)
      const drawStar = function (sx, sy) {
        ctx.save()
        ctx.translate(sx, sy)
        ctx.scale(starScale, starScale)
        ctx.fillStyle = '#fbbf24'
        starPath(ctx, 0, 0, 6, 2.6)
        ctx.fill()
        ctx.restore()
      }
      // 推箱挤压反馈：推动瞬间沿推动方向压缩、垂直方向鼓起，随后回弹
      let squash = 0
      let horizontal = true
      if (typeof pushProgress === 'number') {
        squash = Math.exp(-pushProgress * 5) * 0.16
        horizontal = pushDir === 2 || pushDir === 3
      }
      if (squash > 0.01) {
        const cx = this.offsetX + col * c + c / 2
        const cy = this.offsetY + row * c + c / 2
        const sx = horizontal ? 1 - squash : 1 + squash
        const sy = horizontal ? 1 + squash : 1 - squash
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(sx, sy)
        ctx.drawImage(this.imgs.box, -c / 2, -c / 2, c, c)
        if (onTarget) drawStar(c / 2 - 8, -c / 2 + 8)
        ctx.restore()
      } else {
        this.drawImg(this.imgs.box, row, col)
        if (onTarget) {
          const x = this.offsetX + col * c
          const y = this.offsetY + row * c
          drawStar(x + c - 8, y + 8)
        }
      }
      return
    }
    const x = this.offsetX + col * c
    const y = this.offsetY + row * c
    const pad = c * 0.09
    const bx = x + pad
    const by = y + pad
    const bw = c - pad * 2

    const light = onTarget ? '#a8d188' : '#e6af78'
    const base = onTarget ? '#7fb05f' : '#cf9153'
    const dark = onTarget ? '#56803c' : '#8a5a2b'

    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    roundRect(ctx, bx + 1.5, by + 2.5, bw, bw, 7)
    ctx.fill()
    const g = ctx.createLinearGradient(bx, by, bx, by + bw)
    g.addColorStop(0, light)
    g.addColorStop(1, base)
    ctx.fillStyle = g
    roundRect(ctx, bx, by, bw, bw, 7)
    ctx.fill()
    ctx.strokeStyle = dark
    ctx.lineWidth = 2
    roundRect(ctx, bx, by, bw, bw, 7)
    ctx.stroke()
    ctx.strokeStyle = dark
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(bx, by + bw / 3)
    ctx.lineTo(bx + bw, by + bw / 3)
    ctx.moveTo(bx, by + (bw * 2) / 3)
    ctx.lineTo(bx + bw, by + (bw * 2) / 3)
    ctx.moveTo(bx + bw / 2, by)
    ctx.lineTo(bx + bw / 2, by + bw)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.arc(bx + bw / 2, by + bw / 2, 1.6, 0, Math.PI * 2)
    ctx.fill()
    if (onTarget) {
      ctx.fillStyle = '#fbbf24'
      starPath(ctx, bx + bw - 7, by + 7, 6, 2.6)
      ctx.fill()
    }
  },

  /**
   * 绘制主角（带方向动作：移动时跳跃拉伸 + 眼睛看向移动方向）
   * progress: -1 表示未在移动（待机）
   */
  drawPlayer: function (row, col, dir, progress, now) {
    const ctx = this.ctx
    const c = this.cell
    if (this.imgReady && this.imgs.bird) {
      const x = this.offsetX + col * c
      const y = this.offsetY + row * c
      const cx = x + c / 2
      const cy = y + c / 2
      const moving = progress >= 0
      let lift = 0
      let stretch = 1
      let breathe = 1
      if (moving) {
        // 跳跃：起跳拉伸、腾空、落地
        const s = Math.sin(progress * Math.PI)
        lift = s * c * 0.12
        stretch = 1 + s * 0.1
      } else {
        // 待机：轻微呼吸起伏
        breathe = 1 + Math.sin(now / 500) * 0.025
      }
      // 面向系数：1=正常，-1=镜像朝左；翻转动画期间平滑过渡
      const flipX = this.getFacing(now)
      ctx.save()
      ctx.translate(cx, cy - lift)
      ctx.scale(flipX * (2 - stretch) * breathe, stretch * breathe)
      ctx.drawImage(this.imgs.bird, -c / 2, -c / 2, c, c)
      // 叠加“会转动的眼睛”（在缩放上下文中绘制，眼睛贴着脸一起动）
      this.drawBirdEyes(c, dir, flipX)
      ctx.restore()
      return
    }

    // 矢量兜底
    const x = this.offsetX + col * c
    const y = this.offsetY + row * c
    const cx = x + c / 2
    const cy = y + c / 2 + c * 0.04
    const r = c * 0.34

    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.save()
    ctx.translate(cx, y + c * 0.92)
    ctx.scale(c * 0.28, c * 0.1)
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r)
    g.addColorStop(0, '#ff8a80')
    g.addColorStop(1, '#ef5350')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ef5350'
    ctx.beginPath()
    ctx.arc(cx - r * 0.72, cy - r * 0.82, r * 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + r * 0.72, cy - r * 0.82, r * 0.3, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(cx, cy + r * 0.32, r * 0.48, 0, Math.PI * 2)
    ctx.fill()

    let ox = 0
    let oy = 0
    if (dir === 0) oy = -r * 0.12
    else if (dir === 1) oy = r * 0.12
    else if (dir === 2) ox = -r * 0.14
    else if (dir === 3) ox = r * 0.14

    const ex = r * 0.32
    const eyeY = cy - r * 0.12 + oy
    const eyeR = r * 0.17
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx - ex + ox, eyeY, eyeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + ex + ox, eyeY, eyeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#263238'
    ctx.beginPath()
    ctx.arc(cx - ex + ox * 1.5, eyeY + oy * 0.3, eyeR * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + ex + ox * 1.5, eyeY + oy * 0.3, eyeR * 0.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(255,138,101,0.5)'
    ctx.beginPath()
    ctx.arc(cx - ex * 1.55, cy + r * 0.2, r * 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + ex * 1.55, cy + r * 0.2, r * 0.1, 0, Math.PI * 2)
    ctx.fill()
  },

  /**
   * 在主角脸上叠加一对会转动的眼睛
   * 注意：需在 ctx.translate/scale 之后、restore 之前调用，使用局部坐标（原点=格子中心），
   * 这样跳跃/缩放时眼睛始终贴在主角脸上。
   * 可调参数（相对格子边长 c 的倍数）：
   *   LX/RX 左右眼水平位置（右为正）、EY 垂直位置（向下为正）、
   *   ER 眼白半径、PR 瞳孔半径、OX/OY 瞳孔随方向偏移量。
   */
  drawBirdEyes: function (c, dir, flipX) {
    const ctx = this.ctx
    const LX = 0.11
    const RX = 0.26
    const EY = 0.09
    const ER = 0.06
    const PR = 0.032
    const OX = 0.025
    const OY = 0.02

    let ox = 0
    let oy = 0
    if (dir === 0) oy = -OY * c
    else if (dir === 1) oy = OY * c
    else if (dir === 2) ox = -OX * c
    else if (dir === 3) ox = OX * c
    // 主角朝左（镜像）时水平瞳孔偏移取反，保证屏幕上仍指向移动方向
    if (flipX < 0) ox = -ox

    const eyeY = EY * c
    const drawOne = function (ex) {
      const x = ex * c
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.beginPath()
      ctx.arc(x, eyeY, ER * c, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#263238'
      ctx.beginPath()
      ctx.arc(x + ox, eyeY + oy, PR * c, 0, Math.PI * 2)
      ctx.fill()
    }
    drawOne(LX)
    drawOne(RX)
  },

  /* ==================== 游戏控制 ==================== */

  up: function () { this.tryMove(-1, 0) },
  down: function () { this.tryMove(1, 0) },
  left: function () { this.tryMove(0, -1) },
  right: function () { this.tryMove(0, 1) },

  undo: function () {
    if (this.animating || this.won || !this.history.length) {
      wx.showToast({ title: '没有可撤销的步骤', icon: 'none' })
      return
    }
    const h = this.history.pop()
    this.player.r = h.r
    this.player.c = h.c
    this.box = h.boxes
    this.moves = h.moves
    this.pushes = h.pushes
    this.setData({ moves: this.moves, pushes: this.pushes })
    this.draw()
    this.vibrate('light')
  },

  restart: function () {
    if (this.animating) return
    this.initMap()
    this.draw()
  },

  restartFromWin: function () {
    this.restart()
  },

  closeStory: function () {
    this.setData({ showStory: false })
    this.startBgm()
    this.playSfx('click')
  },

  checkWin: function () {
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        if (this.box[i][j] === 4 && this.map[i][j] !== 3) return
      }
    }
    this.onWin()
  },

  onWin: function () {
    this.won = true
    this.stopTimer()
    this.playSfx('win')
    this.vibrate()

    const sec = this.timerStarted ? Math.max(1, Math.round((Date.now() - this.t0) / 1000)) : 0
    const progress = this.getProgress()
    const best = (progress.best && progress.best[this.levelIdx]) || null
    const isNewRecord = !best || this.moves < best.moves || (this.moves === best.moves && sec < best.time)

    if (isNewRecord) {
      if (!progress.best) progress.best = {}
      progress.best[this.levelIdx] = { moves: this.moves, time: sec }
    }
    progress.unlocked = Math.max(progress.unlocked || 1, Math.min(this.levelIdx + 2, data.levels.length))
    wx.setStorageSync(STORAGE_KEY, progress)
    this.progress = progress

    const finalBestMoves = best ? Math.min(best.moves, this.moves) : this.moves
    const finalBestTime = best ? Math.min(best.time, sec) : sec

    this.setData({
      showWin: true,
      isNewRecord: isNewRecord,
      isLastLevel: this.levelIdx === data.levels.length - 1,
      winLine: data.levels[this.levelIdx].winLine || '太棒了，继续加油！',
      bestMoves: finalBestMoves,
      bestTime: formatTime(finalBestTime),
      timeStr: formatTime(sec)
    })
    this.animateWinStats(this.moves, this.pushes, sec)
    this.launchConfetti()
  },

  /**
   * 通关后数字滚动动画
   */
  animateWinStats: function (moves, pushes, sec) {
    const self = this
    if (this.statsTimer) clearInterval(this.statsTimer)
    const steps = 22
    let i = 0
    this.statsTimer = setInterval(function () {
      i++
      const t = i / steps
      self.setData({
        winStats: {
          moves: Math.round(moves * t),
          pushes: Math.round(pushes * t),
          time: formatTime(Math.round(sec * t))
        }
      })
      if (i >= steps) {
        clearInterval(self.statsTimer)
        self.statsTimer = null
      }
    }, 30)
  },

  goNext: function () {
    if (this.levelIdx >= data.levels.length - 1) return
    wx.redirectTo({ url: '/pages/game/game?level=' + (this.levelIdx + 1) })
  },

  /* ==================== 选关面板 ==================== */

  openLevelPicker: function () {
    const progress = this.getProgress()
    const pickerLevels = data.levels.map(function (item, i) {
      return {
        index: i,
        name: item.name,
        unlocked: i < (progress.unlocked || 1),
        done: !!(progress.best && progress.best[i])
      }
    })
    this.setData({ showLevelPicker: true, pickerLevels: pickerLevels })
  },

  closeLevelPicker: function () {
    this.setData({ showLevelPicker: false })
  },

  pickLevel: function (e) {
    const i = e.currentTarget.dataset.index
    const item = this.data.pickerLevels[i]
    if (!item || !item.unlocked) {
      wx.showToast({ title: '该关卡尚未解锁', icon: 'none' })
      return
    }
    if (i === this.levelIdx) {
      this.closeLevelPicker()
      return
    }
    wx.redirectTo({ url: '/pages/game/game?level=' + i })
  },

  /* ==================== 手势滑动 ==================== */

  onTouchStart: function (e) {
    const t = e.touches && e.touches[0]
    if (t) this.touchStart = { x: t.clientX, y: t.clientY }
  },

  onTouchEnd: function (e) {
    if (!this.touchStart) return
    const t = e.changedTouches && e.changedTouches[0]
    if (!t) {
      this.touchStart = null
      return
    }
    const dx = t.clientX - this.touchStart.x
    const dy = t.clientY - this.touchStart.y
    this.touchStart = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    if (Math.abs(dx) > Math.abs(dy)) {
      this.tryMove(0, dx > 0 ? 1 : -1)
    } else {
      this.tryMove(dy > 0 ? 1 : -1, 0)
    }
  },

  /* ==================== 计时器 / 震动 ==================== */

  startTimer: function () {
    this.timerStarted = true
    this.t0 = Date.now()
    const self = this
    this.timer = setInterval(function () {
      const sec = Math.floor((Date.now() - self.t0) / 1000)
      self.setData({ timeStr: formatTime(sec) })
    }, 500)
  },

  stopTimer: function () {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  /* ==================== 音频 ==================== */

  initAudio: function () {
    const self = this
    this.audio = {}
    const names = ['move', 'push', 'bump', 'click', 'bubble', 'win']
    names.forEach(function (name) {
      const ctx = wx.createInnerAudioContext()
      ctx.src = '/audio/' + name + '.wav'
      ctx.volume = 0.8
      self.audio[name] = ctx
    })
    this.bgm = wx.createInnerAudioContext()
    this.bgm.src = '/audio/bgm.wav'
    this.bgm.loop = true
    this.bgm.volume = 0.45
    this.audioReady = true
  },

  playSfx: function (name) {
    if (!this.soundOn || !this.audioReady || !this.audio || !this.audio[name]) return
    try {
      const ctx = this.audio[name]
      ctx.stop()
      ctx.play()
    } catch (err) {
      /* 忽略 */
    }
  },

  startBgm: function () {
    if (!this.soundOn || !this.bgm) return
    this.bgmStarted = true
    try {
      this.bgm.play()
    } catch (err) {
      /* 忽略 */
    }
  },

  pauseBgm: function () {
    if (this.bgm) {
      try {
        this.bgm.pause()
      } catch (err) {
        /* 忽略 */
      }
    }
  },

  toggleSound: function () {
    const progress = this.getProgress()
    const next = !this.soundOn
    this.soundOn = next
    progress.sound = next
    wx.setStorageSync(STORAGE_KEY, progress)
    this.progress = progress
    this.setData({ soundOn: next })
    if (next) {
      this.startBgm()
      this.playSfx('click')
    } else {
      this.pauseBgm()
    }
  },

  destroyAudio: function () {
    if (this.bgm) {
      try { this.bgm.destroy() } catch (err) { /* 忽略 */ }
      this.bgm = null
    }
    if (this.audio) {
      for (const k in this.audio) {
        try { this.audio[k].destroy() } catch (err) { /* 忽略 */ }
      }
      this.audio = null
    }
  },

  vibrate: function (type) {
    try {
      if (type === 'light') {
        wx.vibrateShort({ type: 'light' })
      } else {
        wx.vibrateShort()
      }
    } catch (err) {
      /* 低版本库不支持时忽略 */
    }
  },

  /* ==================== 工具方法 ==================== */

  cloneBoxes: function () {
    const copy = []
    for (let i = 0; i < ROWS; i++) {
      copy[i] = this.box[i].slice()
    }
    return copy
  },

  launchConfetti: function () {
    const colors = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#fbbf24', '#ec4899']
    const particles = []
    for (let i = 0; i < 44; i++) {
      particles.push({
        id: i,
        left: (Math.random() * 100).toFixed(1) + '%',
        delay: (Math.random() * 1).toFixed(2) + 's',
        dur: (1.8 + Math.random() * 1.8).toFixed(2) + 's',
        color: colors[Math.floor(Math.random() * colors.length)],
        size: (8 + Math.random() * 10).toFixed(0) + 'rpx',
        radius: Math.random() > 0.5 ? '50%' : '4rpx'
      })
    }
    this.setData({ confetti: particles })
  },

  noop: function () {},

  /* ==================== 导航 ==================== */

  goBack: function () {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  }
})
