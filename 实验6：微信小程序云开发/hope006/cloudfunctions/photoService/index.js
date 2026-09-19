const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const photos = db.collection('photos');

function str(x, n) {
  return typeof x === 'string' ? x.trim().slice(0, n) : '';
}

function transactionValue(result) {
  return result && Object.prototype.hasOwnProperty.call(result, 'result') ? result.result : result;
}

function socialView(photo, openid, includeComments) {
  const likes = Array.isArray(photo.likeUsers) ? photo.likeUsers : [];
  const favorites = Array.isArray(photo.favoriteUsers) ? photo.favoriteUsers : [];
  const comments = Array.isArray(photo.comments) ? photo.comments : [];
  const result = Object.assign({}, photo, {
    liked: likes.includes(openid),
    favorited: favorites.includes(openid),
    likeCount: likes.length,
    favoriteCount: favorites.length,
    commentCount: comments.length
  });
  result.comments = includeComments ? comments.map(item => ({
    _id: item._id,
    content: item.content,
    nickName: item.nickName,
    avatarUrl: item.avatarUrl,
    createdAt: item.createdAt,
    mine: item._openid === openid
  })) : undefined;
  delete result.likeUsers;
  delete result.favoriteUsers;
  return result;
}
exports.main = async (event) => {
  try {
    const {
      OPENID
    } = cloud.getWXContext();
    if (!OPENID) throw Error('请在微信小程序中访问');
    const e = event || {};
    if (e.action === 'identity') return {
      openid: OPENID
    };
    if (e.action === 'stats') {
      const [published, recent] = await Promise.all([
        photos.where({
          _openid: OPENID
        }).count(),
        photos.limit(100).get()
      ]);
      return {
        published: published.total,
        saved: recent.data.filter(item => Array.isArray(item.favoriteUsers) && item.favoriteUsers
          .includes(OPENID)).length
      };
    }
    if (e.action === 'list') {
      let filter = {};
      const category = str(e.category, 12);
      if (category && category !== '全部') filter.category = category;
      if (e.author) filter._openid = str(e.author, 128);
      const keyword = str(e.keyword, 60);
      if (keyword) {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = db.RegExp({
          regexp: escaped,
          options: 'i'
        });
        filter = db.command.and([filter, db.command.or([{
          title: regex
        }, {
          description: regex
        }, {
          nickName: regex
        }])]);
      }
      const skip = Math.max(0, Math.min(10000, Math.floor(Number(e.skip) || 0)));
      const result = await photos.where(filter).orderBy('createdAt', 'desc').skip(skip).limit(12).get();
      return {
        data: result.data.map(item => socialView(item, OPENID, false))
      };
    }
    if (e.action === 'detail') {
      const result = await photos.doc(str(e.id, 128)).get();
      return {
        data: socialView(result.data, OPENID, true)
      };
    }
    if (e.action === 'favoriteList') {
      const result = await photos.limit(100).get();
      return {
        data: result.data.filter(item => Array.isArray(item.favoriteUsers) && item.favoriteUsers.includes(
            OPENID))
          .sort((a, b) => b.createdAt - a.createdAt).map(item => socialView(item, OPENID, false))
      };
    }
    if (e.action === 'toggleLike' || e.action === 'toggleFavorite') {
      const id = str(e.id, 128);
      const field = e.action === 'toggleLike' ? 'likeUsers' : 'favoriteUsers';
      const transaction = await db.runTransaction(async tx => {
        const doc = tx.collection('photos').doc(id);
        const current = await doc.get();
        const users = Array.isArray(current.data[field]) ? current.data[field] : [];
        const active = users.includes(OPENID);
        const next = active ? users.filter(user => user !== OPENID) : users.concat(OPENID);
        await doc.update({
          data: {
            [field]: next
          }
        });
        return {
          active: !active,
          count: next.length
        };
      });
      const result = transactionValue(transaction);
      return e.action === 'toggleLike' ? {
        liked: result.active,
        likeCount: result.count
      } : {
        saved: result.active,
        favoriteCount: result.count
      };
    }
    if (e.action === 'addComment') {
      const id = str(e.id, 128);
      const content = str(e.content, 200);
      if (!content) throw Error('评论不能为空');
      const comment = {
        _id: crypto.randomBytes(12).toString('hex'),
        _openid: OPENID,
        content,
        nickName: str(e.nickName, 20) || '拾光旅人',
        avatarUrl: typeof e.avatarUrl === 'string' && e.avatarUrl.startsWith('cloud://') ? str(e
          .avatarUrl, 500) : '',
        createdAt: Date.now()
      };
      const transaction = await db.runTransaction(async tx => {
        const doc = tx.collection('photos').doc(id);
        const current = await doc.get();
        const comments = Array.isArray(current.data.comments) ? current.data.comments : [];
        const next = comments.concat(comment).slice(-200);
        await doc.update({
          data: {
            comments: next
          }
        });
        return next.length;
      });
      const count = transactionValue(transaction);
      return {
        comment: socialView({
          comments: [comment]
        }, OPENID, true).comments[0],
        commentCount: count
      };
    }
    if (e.action === 'removeComment') {
      const id = str(e.id, 128);
      const commentId = str(e.commentId, 64);
      const transaction = await db.runTransaction(async tx => {
        const doc = tx.collection('photos').doc(id);
        const current = await doc.get();
        const comments = Array.isArray(current.data.comments) ? current.data.comments : [];
        const target = comments.find(item => item._id === commentId);
        if (!target || target._openid !== OPENID) throw Error('只能删除自己的评论');
        const next = comments.filter(item => item._id !== commentId);
        await doc.update({
          data: {
            comments: next
          }
        });
        return next.length;
      });
      const count = transactionValue(transaction);
      return {
        commentCount: count
      };
    }
    if (e.action === 'publish') {
      const p = e.post || {};
      if (!str(p.title, 40)) throw Error('标题不能为空');
      if (!['自然', '城市', '旅行', '日常', '人像'].includes(p.category)) throw Error('请选择主题');
      if (!Array.isArray(p.images) || p.images.length < 1 || p.images.length > 9 || p.images.some(x =>
          typeof x !== 'string' || !x.startsWith('cloud://') || x.length > 500)) throw Error('图片参数无效');
      const token = str(e.requestId, 80);
      if (!token) throw Error('缺少发布请求编号');
      const id = crypto.createHash('sha256').update(OPENID + ':' + token).digest('hex');
      const post = {
        _openid: OPENID,
        title: str(p.title, 40),
        description: str(p.description, 500),
        category: p.category,
        location: str(p.location, 40),
        nickName: str(p.nickName, 20) || '拾光旅人',
        images: p.images,
        avatarUrl: typeof p.avatarUrl === 'string' && p.avatarUrl.startsWith('cloud://') ? str(p
          .avatarUrl, 500) : '',
        likeUsers: [],
        favoriteUsers: [],
        comments: [],
        createdAt: Date.now()
      };
      await db.runTransaction(async tx => {
        const doc = tx.collection('photos').doc(id);
        let old;
        try {
          old = await doc.get();
        } catch (err) {
          if (!/not exist|not found|does not exist/i.test(err.message || err.errMsg || ''))
            throw err;
        }
        if (!old || !old.data) await doc.set({
          data: post
        });
      });
      return {
        id
      };
    }
    if (e.action === 'remove') {
      const id = str(e.id, 128);
      const r = await photos.doc(id).get();
      if (r.data._openid !== OPENID) throw Error('只能删除自己的作品');
      await photos.doc(id).remove();
      return {
        ok: true
      };
    }
    throw Error('未知操作');
  } catch (err) {
    console.error('photoService:', err);
    return {
      error: err.message || '服务暂时不可用'
    };
  }
};
