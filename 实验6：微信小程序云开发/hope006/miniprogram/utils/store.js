const KEY = 'frame-v1-';
const seeds = [
  ['01', '雾从山谷里醒来', '自然', '林间来信', '清晨六点，云雾沿着山脊缓慢移动，风里都是草木的气息。', 'photo-1441974231531-c6227db76b6e', 440,
    '莫干山'
  ],
  ['02', '风经过旷野', '自然', '林间来信', '沿着没有名字的小路往前走，远山和天空都变得很近。', 'photo-1500534314209-a25ddb2bd429', 350,
    '西北旷野'
  ],
  ['03', '城市雨后的蓝', '城市', '周末散步', '雨停后的玻璃幕墙收集了整座城市的光。', 'photo-1480714378408-67cf0d13bc1b', 390, '上海'],
  ['04', '街角仍有晚风', '城市', '周末散步', '下班以后绕远一点，熟悉的街道也会出现新的风景。', 'photo-1449824913935-59a10b8d2000', 460, '杭州'],
  ['05', '去海边等一场日落', '旅行', '岛屿日记', '车窗外的海一闪而过，旅途从这一刻开始有了颜色。', 'photo-1475924156734-496f6cac6ec1', 340,
    '东山岛'
  ],
  ['06', '下一站，慢一点', '旅行', '岛屿日记', '把行程留一点空白，才装得下路上偶然遇见的惊喜。', 'photo-1469854523086-cc02fe5d8800', 430,
    '在路上'
  ],
  ['07', '今天的咖啡刚刚好', '日常', '小满日记', '咖啡温热，阳光落在桌面上，普通的上午也值得被记住。', 'photo-1495474472287-4d71bcdd2085', 380,
    '家中'
  ],
  ['08', '把日子过成一首小诗', '日常', '小满日记', '一把旧椅子、一束花，以及窗边缓慢移动的光。', 'photo-1503602642458-232111445657', 450, '午后'],
  ['09', '她和四月的风', '人像', '微光肖像', '自然的笑容比精心准备的姿势，更接近那天真正的心情。', 'photo-1494790108377-be9c29b29330', 460,
    '白墙边'
  ],
  ['10', '光落在肩上', '人像', '微光肖像', '没有复杂布景，只留下人物与安静的下午光线。', 'photo-1500648767791-00dcc994a43e', 400, '工作室']
].map((x, i) => ({
  _id: 'demo-' + x[0],
  _openid: 'author-' + x[3],
  title: x[1],
  category: x[2],
  nickName: x[3],
  description: x[4],
  images: ['https://images.unsplash.com/' + x[5] + '?auto=format&fit=crop&w=900&q=80'],
  height: x[6],
  baseLikes: [128, 96, 214, 76, 183, 142, 88, 64, 256, 119][i],
  createdAt: Date.now() - i * 86400000,
  location: x[7],
  demo: true
}));

function read(k, f) {
  try {
    return wx.getStorageSync(KEY + k) || f;
  } catch (e) {
    return f;
  }
}

function write(k, v) {
  wx.setStorageSync(KEY + k, v);
}

function cloud() {
  return getApp().globalData.cloudEnabled;
}
async function call(action, data = {}) {
  const r = await wx.cloud.callFunction({
    name: 'photoService',
    data: Object.assign({
      action
    }, data)
  });
  if (!r.result || r.result.error) throw Error((r.result && r.result.error) || '云服务暂时不可用');
  return r.result;
}

function normalize(p) {
  const localLiked = read('likes', []).includes(p._id);
  const localComments = read('comments-' + p._id, []);
  const liked = typeof p.liked === 'boolean' ? p.liked : localLiked;
  const likeCount = typeof p.likeCount === 'number' ? p.likeCount : (p.baseLikes || 0) + (localLiked ? 1 : 0);
  const comments = (Array.isArray(p.comments) ? p.comments : localComments).map(item => Object.assign({},
    item, {
      time: new Date(item.createdAt).toLocaleString(),
      initial: (item.nickName || '拾').slice(0, 1)
    }));
  return Object.assign({}, p, {
    cover: p.images[0],
    height: p.height || 380,
    date: new Date(p.createdAt).toLocaleDateString(),
    saved: typeof p.favorited === 'boolean' ? p.favorited : read('favorites', []).some(x => x._id === p
      ._id),
    liked,
    likeCount,
    comments,
    commentCount: typeof p.commentCount === 'number' ? p.commentCount : comments.length
  });
}
async function list({
  skip = 0,
  category = '全部',
  keyword = '',
  author = ''
} = {}) {
  let rows;
  if (cloud()) {
    const r = await call('list', {
      skip,
      category,
      keyword,
      author
    });
    const featured = skip === 0 ? seeds.filter(p =>
      (category === '全部' || p.category === category) &&
      (!author || p._openid === author) &&
      (!keyword || (p.title + p.description + p.nickName).toLowerCase().includes(keyword.toLowerCase()))
    ) : [];
    rows = r.data.concat(featured);
  } else {
    rows = read('posts', []).concat(seeds).filter(p => (category === '全部' || p.category === category) && (!
      author || p._openid === author) && (!keyword || (p.title + p.description + p.nickName)
      .toLowerCase().includes(keyword.toLowerCase()))).sort((a, b) => b.createdAt - a.createdAt).slice(
      skip, skip + 12);
  }
  return rows.map(normalize);
}
async function detail(id) {
  if (id.startsWith('demo-')) {
    const p = seeds.find(x => x._id === id);
    if (!p) throw Error('作品不存在');
    return normalize(p);
  }
  if (cloud()) return normalize((await call('detail', {
    id
  })).data);
  const p = read('posts', []).find(x => x._id === id);
  if (!p) throw Error('作品不存在或已删除');
  return normalize(p);
}

function refreshSavedPhoto(saved) {
  const currentSeed = seeds.find(item => item._id === saved._id);
  const currentPost = read('posts', []).find(item => item._id === saved._id);
  return Object.assign({}, saved, currentSeed || currentPost || {});
}

function favorites() {
  return read('favorites', []).map(refreshSavedPhoto).map(normalize);
}

function usesLocalSocial(p) {
  return !cloud() || p.demo || String(p._id || '').startsWith('local-');
}

async function favoriteList() {
  const local = read('favorites', []).filter(p => usesLocalSocial(p)).map(refreshSavedPhoto);
  if (!cloud()) return local.map(normalize);
  const result = await call('favoriteList');
  return result.data.map(normalize).concat(local.map(normalize));
}

async function stats() {
  const saved = read('favorites', []).length;
  if (cloud()) {
    const result = await call('stats');
    return {
      published: result.published,
      saved: result.saved + read('favorites', []).filter(p => p.demo).length
    };
  }
  return {
    published: read('posts', []).length,
    saved
  };
}

function toggle(p) {
  let a = read('favorites', []);
  const had = a.some(x => x._id === p._id);
  a = had ? a.filter(x => x._id !== p._id) : [p].concat(a);
  write('favorites', a);
  return !had;
}

async function toggleLike(p) {
  if (!usesLocalSocial(p)) return await call('toggleLike', {
    id: p._id
  });
  let ids = read('likes', []);
  const liked = ids.includes(p._id);
  ids = liked ? ids.filter(id => id !== p._id) : ids.concat(p._id);
  write('likes', ids);
  return {
    liked: !liked,
    likeCount: Math.max(0, (p.likeCount || p.baseLikes || 0) + (liked ? -1 : 1))
  };
}

async function toggleFavorite(p) {
  if (!usesLocalSocial(p)) return await call('toggleFavorite', {
    id: p._id
  });
  const saved = toggle(p);
  return {
    saved,
    favoriteCount: Math.max(0, (p.favoriteCount || 0) + (saved ? 1 : -1))
  };
}

async function addComment(p, content) {
  const profile = read('profile', {
    nickName: '拾光旅人'
  });
  if (!usesLocalSocial(p)) return await call('addComment', {
    id: p._id,
    content,
    nickName: profile.nickName,
    avatarUrl: profile.avatarUrl || ''
  });
  const comments = read('comments-' + p._id, []);
  const comment = {
    _id: 'comment-' + Date.now(),
    content: content.trim().slice(0, 200),
    nickName: profile.nickName || '拾光旅人',
    avatarUrl: profile.avatarUrl || '',
    createdAt: Date.now(),
    mine: true
  };
  write('comments-' + p._id, comments.concat(comment));
  return {
    comment,
    commentCount: comments.length + 1
  };
}

async function removeComment(p, commentId) {
  if (!usesLocalSocial(p)) return await call('removeComment', {
    id: p._id,
    commentId
  });
  const comments = read('comments-' + p._id, []).filter(item => item._id !== commentId);
  write('comments-' + p._id, comments);
  return {
    commentCount: comments.length
  };
}
async function identity() {
  if (cloud()) return (await call('identity')).openid;
  return 'local-me';
}
async function persist(path) {
  return (await wx.saveFile({
    tempFilePath: path
  })).savedFilePath;
}
async function publish(form, onProgress) {
  const files = [];
  let committed = false;
  try {
    for (let i = 0; i < form.images.length; i++) {
      const p = form.images[i];
      if (cloud()) {
        const ext = (p.match(/\.(png|jpe?g|webp)$/i) || [])[1] || 'jpg';
        const r = await wx.cloud.uploadFile({
          cloudPath: 'photos/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext,
          filePath: p
        });
        files.push(r.fileID);
      } else files.push(await persist(p));
      onProgress(Math.round((i + 1) / form.images.length * 85));
    }
    const author = read('profile', {
      nickName: '拾光旅人'
    });
    const post = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      location: form.location.trim(),
      images: files,
      nickName: author.nickName || '拾光旅人',
      avatarUrl: author.avatarUrl || ''
    };
    if (cloud()) {
      const r = await call('publish', {
        post,
        requestId: form.requestId
      });
      committed = true;
      onProgress(100);
      return r.id;
    }
    post._id = 'local-' + Date.now();
    post._openid = 'local-me';
    post.createdAt = Date.now();
    write('posts', [post].concat(read('posts', [])));
    committed = true;
    onProgress(100);
    return post._id;
  } catch (e) {
    if (!committed && !cloud())
      for (const f of files) {
        wx.removeSavedFile({
          filePath: f,
          fail() {}
        });
      }
    throw e;
  }
}
async function remove(p) {
  if (cloud()) await call('remove', {
    id: p._id
  });
  else {
    write('posts', read('posts', []).filter(x => x._id !== p._id));
    p.images.forEach(filePath => wx.removeSavedFile({
      filePath,
      fail() {}
    }));
  }
  write('favorites', read('favorites', []).filter(x => x._id !== p._id));
}
module.exports = {
  read,
  write,
  cloud,
  list,
  detail,
  favorites,
  favoriteList,
  stats,
  toggle,
  toggleLike,
  toggleFavorite,
  addComment,
  removeComment,
  identity,
  publish,
  remove,
  normalize
};
