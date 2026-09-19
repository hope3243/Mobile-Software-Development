const assert = require('assert/strict'),
  fs = require('fs'),
  vm = require('vm');
const root = require('path').resolve(__dirname, '..') + '/';
let enabled = false;
const memory = {};
global.getApp = () => ({
  globalData: {
    cloudEnabled: enabled
  }
});
global.wx = {
  getStorageSync: k => memory[k],
  setStorageSync: (k, v) => memory[k] = JSON.parse(JSON.stringify(v)),
  saveFile: async ({
    tempFilePath
  }) => ({
    savedFilePath: 'saved/' + tempFilePath
  }),
  removeSavedFile() {}
};
const s = require(root + 'miniprogram/utils/store');
(async () => {
  const all = await s.list();
  assert.equal(all.length, 10);
  assert.equal((await s.list({
    category: '自然'
  })).length, 2);
  assert.equal((await s.list({
    keyword: '山谷'
  })).length, 1);
  assert.equal((await s.list({
    keyword: '[.*'
  })).length, 0);
  const authors = await s.list({
    author: all[0]._openid
  });
  assert(authors.every(x => x.nickName === all[0].nickName));
  assert.equal(authors.length, 2);
  const likedDemo = await s.toggleLike(all[0]);
  assert.equal(likedDemo.liked, true);
  assert.equal((await s.detail(all[0]._id)).liked, true);
  const commentDemo = await s.addComment(all[0], '很喜欢这束光');
  assert.equal(commentDemo.commentCount, 1);
  assert.equal((await s.detail(all[0]._id)).comments.length, 1);
  await s.removeComment(all[0], commentDemo.comment._id);
  assert.equal((await s.detail(all[0]._id)).comments.length, 0);
  assert.equal(s.toggle(all[0]), true);
  assert.equal(s.favorites().length, 1);
  assert.equal((await s.detail(all[0]._id)).saved, true);
  assert.equal(s.toggle(all[0]), false);
  assert.equal(s.favorites().length, 0);
  s.write('favorites', [{
    _id: 'demo-01',
    demo: true
  }]);
  assert.equal((await s.favoriteList())[0].likeCount, 129);
  s.write('favorites', []);
  const progress = [];
  const id = await s.publish({
    title: ' 测试作品 ',
    description: '说明',
    category: '日常',
    location: '杭州',
    images: ['a.jpg', 'b.jpg']
  }, p => progress.push(p));
  const p = await s.detail(id);
  assert.equal(p.title, '测试作品');
  assert.equal(p.images.length, 2);
  assert.equal(p._openid, 'local-me');
  assert.equal(progress.at(-1), 100);
  assert.deepEqual(await s.stats(), {
    published: 1,
    saved: 0
  });
  assert.equal((await s.list({
    author: 'local-me'
  })).length, 1);
  s.toggle(p);
  await s.remove(p);
  assert.equal(s.favorites().length, 0);
  await assert.rejects(() => s.detail(id));
  console.log('PASS: 本地筛选、搜索、作者一致性、收藏切换、双图发布、进度、删除与失效详情');
  const docs = new Map();
  let openid = 'alice';
  let captured;
  const collection = {
    where(f) {
      captured = f;
      return this;
    },
    orderBy() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    async get() {
      return {
        data: []
      };
    },
    async count() {
      return {
        total: Array.from(docs.values()).filter(item => item._openid === openid).length
      };
    },
    doc(id) {
      return {
        async get() {
          if (!docs.has(id)) throw Error('document does not exist');
          return {
            data: docs.get(id)
          };
        },
        async set({
          data
        }) {
          docs.set(id, data);
        },
        async update({
          data
        }) {
          docs.set(id, Object.assign({}, docs.get(id), data));
        },
        async remove() {
          docs.delete(id);
        }
      };
    }
  };
  const db = {
    collection: () => collection,
    RegExp: o => {
      assert.doesNotThrow(() => new RegExp(o.regexp));
      return o;
    },
    command: {
      and: x => ({
        and: x
      }),
      or: x => ({
        or: x
      })
    },
    runTransaction: async fn => ({
      result: await fn({
        collection: () => collection
      }),
      errMsg: 'runTransaction:ok'
    })
  };
  const cloud = {
    init() {},
    database: () => db,
    getWXContext: () => ({
      OPENID: openid
    })
  };
  const sandbox = {
    require: x => x === 'wx-server-sdk' ? cloud : require(x),
    exports: {},
    console: {
      error() {}
    }
  };
  vm.runInNewContext(fs.readFileSync(root + 'cloudfunctions/photoService/index.js', 'utf8'), sandbox);
  const main = sandbox.exports.main;
  assert.equal((await main({
    action: 'identity'
  })).openid, 'alice');
  assert.equal((await main({
    action: 'stats'
  })).published, 0);
  const post = {
    title: '作品',
    description: '故事',
    category: '自然',
    images: ['cloud://test/photo.jpg'],
    nickName: '作者',
    _openid: 'forged'
  };
  const a = await main({
    action: 'publish',
    post,
    requestId: 'request-1'
  });
  assert(a.id, JSON.stringify(a));
  assert.equal(docs.get(a.id)._openid, 'alice');
  const b = await main({
    action: 'publish',
    post,
    requestId: 'request-1'
  });
  assert.equal(a.id, b.id);
  assert.equal(docs.size, 1);
  const cloudLike = await main({
    action: 'toggleLike',
    id: a.id
  });
  assert.equal(cloudLike.liked, true);
  assert.equal(cloudLike.likeCount, 1);
  const cloudFavorite = await main({
    action: 'toggleFavorite',
    id: a.id
  });
  assert.equal(cloudFavorite.saved, true);
  const cloudComment = await main({
    action: 'addComment',
    id: a.id,
    content: '云端评论',
    nickName: 'Alice'
  });
  assert.equal(cloudComment.commentCount, 1);
  const cloudDetail = await main({
    action: 'detail',
    id: a.id
  });
  assert.equal(cloudDetail.data.liked, true);
  assert.equal(cloudDetail.data.favorited, true);
  assert.equal(cloudDetail.data.comments.length, 1);
  assert.equal((await main({
    action: 'stats'
  })).published, 1);
  assert((await main({
    action: 'publish',
    post: {
      ...post,
      images: ['https://fake']
    },
    requestId: '2'
  })).error);
  await main({
    action: 'list',
    keyword: '[.*'
  });
  assert.equal(captured.and[1].or[0].title.regexp, '\\[\\.\\*');
  openid = 'bob';
  assert((await main({
    action: 'removeComment',
    id: a.id,
    commentId: cloudComment.comment._id
  })).error);
  assert((await main({
    action: 'remove',
    id: a.id
  })).error);
  assert.equal(docs.size, 1);
  openid = 'alice';
  assert.equal((await main({
    action: 'removeComment',
    id: a.id,
    commentId: cloudComment.comment._id
  })).commentCount, 0);
  assert((await main({
    action: 'remove',
    id: a.id
  })).ok);
  assert.equal(docs.size, 0);
  console.log('PASS: 云端身份防伪造、发布幂等、文件校验、正则转义、跨用户删除阻止、本人删除（模拟 SDK）');
  // Page event bindings and routes must resolve to real implementation.
  for (const page of JSON.parse(fs.readFileSync(root + 'miniprogram/app.json')).pages) {
    const code = fs.readFileSync(root + 'miniprogram/' + page + '.js', 'utf8');
    let def;
    vm.runInNewContext(code, {
      require: () => s,
      Page: x => def = x
    });
    const wxml = fs.readFileSync(root + 'miniprogram/' + page + '.wxml', 'utf8');
    for (const m of wxml.matchAll(/(?:bind|catch)(?::)?[a-z]+="([a-zA-Z][a-zA-Z0-9]*)"/g)) assert.equal(
      typeof def[m[1]], 'function', page + ': missing ' + m[1]);
  }
  console.log('PASS: 全部 6 个页面事件绑定存在');
})().catch(e => {
  console.error(e);
  process.exit(1)
});
