// 设计台 v1：视觉设计工作台（聊天式生图）
// 由 server/src/index.js 经 mountDesign 挂载
import fs from 'node:fs';
import path from 'node:path';

export function mountDesign(app, ctx) {
  const { db, DATA_DIR, J, now, getAdminConfig } = ctx;

  // ---------- 图片本地存储：uploads/design/{upload,generate}/ + thumbs/，DB 只存相对路径 ----------
  function designDir(...segs) {
    const d = path.join(DATA_DIR, 'uploads', 'design', ...segs);
    fs.mkdirSync(d, { recursive: true });
    return d;
  }
  designDir('upload'); designDir('generate');
  designDir('thumbs', 'upload'); designDir('thumbs', 'generate');

  let _sharp = null;
  async function getSharp() { if (!_sharp) _sharp = (await import('sharp')).default; return _sharp; }
  function designAbs(webPath) { return path.join(DATA_DIR, 'uploads', String(webPath || '').replace(/^\/uploads\//, '')); }
  function saveDesignBuffer(buf, sub, fname) {
    const d = designDir(sub);
    fs.writeFileSync(path.join(d, fname), buf);
    return `/uploads/design/${sub}/${fname}`;
  }
  // 缩略图：最长边 400px 的 jpg；失败返回空串（前端回退原图）
  async function makeThumb(absSrc, webPath) {
    try {
      const s = await getSharp();
      const rel = webPath.replace(/^\/uploads\/design\//, '').replace(/\.[a-z0-9]+$/i, '.jpg');
      const outDir = designDir('thumbs', path.dirname(rel));
      await s(absSrc).rotate().resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(path.join(outDir, path.basename(rel)));
      return `/uploads/design/thumbs/${rel}`;
    } catch (e) { console.warn('[design] 缩略图失败', e.message); return ''; }
  }
  function parseDesignDataUrl(dataUrl) {
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl || '');
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length || buf.length > 8 * 1024 * 1024) return { tooBig: true };
    return { buf, ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
  }
  async function downloadImage(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`图片下载失败 ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    return { buf, ext: ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg' };
  }

  // ---------- 模型与尺寸 ----------
  // visual 分类已上架模型 + 该分类供应商配置（与连通测试同一套）
  function getVisualModel(modelId) {
    const m = db.prepare(`SELECT * FROM models WHERE category='visual' AND is_active=1 AND (model_id=? OR id=?)`).get(modelId, Number(modelId) || -1);
    if (!m) throw new Error('模型不存在或未上架，请在管理设置里上架 visual 模型');
    const pv = db.prepare('SELECT * FROM model_providers WHERE category=?').get('visual') || {};
    const base_url = String((m.base_url || pv.base_url || '')).replace(/\/+$/, '');
    const api_key = String(m.api_key || pv.api_key || '');
    const api_format = pv.api_format === 'qwen' ? 'qwen' : 'openrouter';
    if (!base_url) throw new Error('请先在管理设置里配置视觉模型的供应商地址');
    if (!api_key) throw new Error('请先在管理设置里配置视觉模型的 API Key');
    return { ...m, base_url, api_key, api_format };
  }
  // 比例档位：按模型实际 size 档位来（qwen-image-3.0 为默认值，待用户按中转实测核对）
  const SIZE_TIERS = {
    'qwen-image-3.0': {
      '1:1': { low: '1024*1024', medium: '1328*1328', high: '1664*1664' },
      '3:4': { low: '768*1024', medium: '996*1328', high: '1248*1664' },
      '4:3': { low: '1024*768', medium: '1328*996', high: '1664*1248' },
      '16:9': { low: '1024*576', medium: '1328*748', high: '1664*936' },
      '9:16': { low: '576*1024', medium: '748*1328', high: '936*1664' },
    },
  };
  const DEFAULT_TIERS = SIZE_TIERS['qwen-image-3.0'];
  const tiersFor = (modelId) => SIZE_TIERS[modelId] || DEFAULT_TIERS;
  const CLARITIES = { low: '低', medium: '中', high: '高' };
  const RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16'];
  // prompt 关键词 → 比例（按匹配优先级排序）；命中后从 prompt 里删掉比例词
  const RATIO_KEYWORDS = [
    [/9\s*[:：比]\s*16/, '9:16'],
    [/16\s*[:：比]\s*9/, '16:9'],
    [/3\s*[:：比]\s*4/, '3:4'],
    [/4\s*[:：比]\s*3/, '4:3'],
    [/1\s*[:：比]\s*1/, '1:1'],
    [/方形|正方形/, '1:1'],
    [/竖版|竖图|纵向|人像/, '3:4'],
    [/横版|横图|风景/, '16:9'],
  ];
  function resolveGeneration({ prompt, model_id, clarity = 'medium', ratio = 'auto', seed = null }) {
    const model = getVisualModel(model_id);
    const tiers = tiersFor(model.model_id);
    let finalRatio = ratio, ratioFrom = 'ui', promptClean = String(prompt || '');
    if (!RATIOS.includes(finalRatio)) {
      finalRatio = '1:1'; ratioFrom = 'default';
      for (const [re, r] of RATIO_KEYWORDS) {
        if (re.test(promptClean)) { finalRatio = r; ratioFrom = 'prompt'; break; }
      }
    }
    // 比例确定后清掉 prompt 里所有比例词，避免跟 size 参数打架
    for (const [re] of RATIO_KEYWORDS) promptClean = promptClean.replace(new RegExp(re.source, 'g'), '');
    promptClean = promptClean.replace(/\s{2,}/g, ' ').replace(/^[，,、\s]+/, '').trim();
    if (!tiers[finalRatio]) finalRatio = tiers['1:1'] ? '1:1' : Object.keys(tiers)[0]; // 不支持取最接近
    const cl = CLARITIES[clarity] ? clarity : 'medium';
    const size = tiers[finalRatio][cl];
    const finalSeed = seed == null ? Math.floor(Math.random() * 2147483647) : Number(seed);
    const cost = Number(model.image_price) || 0;
    return {
      model_id: model.model_id, model_name: model.display_name || model.model_id,
      api_format: model.api_format, base_url: model.base_url, api_key: model.api_key,
      size, ratio: finalRatio, ratioFrom, clarity: cl, seed: finalSeed, cost,
      prompt_clean: promptClean,
    };
  }

  // ---------- 生图调用 ----------
  // qwen 原生格式：同步等待（中转 key 不支持 X-DashScope-Async，2026-10-17 实测）
  async function qwenGenerate({ base_url, api_key, model, prompt, imageDataUrl, size, seed }) {
    const origin = new URL(base_url).origin;
    const content = [];
    if (imageDataUrl) content.push({ image: imageDataUrl });
    content.push({ text: prompt });
    const r = await fetch(origin + '/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
      body: JSON.stringify({
        model,
        input: { messages: [{ role: 'user', content }] },
        parameters: { prompt_extend: false, size, seed },
      }),
      signal: AbortSignal.timeout(180000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || d.code || `生图失败 ${r.status}`);
    const url = d.output && d.output.results && d.output.results[0] && d.output.results[0].url;
    if (!url) throw new Error('生图成功但未返回图片地址');
    return downloadImage(url);
  }
  async function openrouterGenerate({ base_url, api_key, model, prompt, size }) {
    const r = await fetch(base_url + '/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
      body: JSON.stringify({ model, prompt, size: size.replace('*', 'x'), n: 1 }),
      signal: AbortSignal.timeout(180000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `生图失败 ${r.status}`);
    const it = (d.data || [])[0];
    if (!it) throw new Error('生图未返回图片');
    if (it.b64_json) return { buf: Buffer.from(it.b64_json, 'base64'), ext: 'png' };
    if (it.url) return downloadImage(it.url);
    throw new Error('生图未返回图片');
  }
  function logImageCost(modelId, cost) {
    try {
      db.prepare(`INSERT INTO ai_usage_log (model, endpoint, tokens_in, tokens_out, cost, cost_in, cost_out, created_at)
        VALUES (?,?,?,?,?,?,?,datetime('now','localtime'))`).run(modelId, 'design', 0, 0, cost, 0, cost);
    } catch (e) {}
  }
  function touchSession(sid) {
    db.prepare(`UPDATE design_tasks SET updated_at=datetime('now','localtime') WHERE id=?`).run(sid);
  }
  function getSession(sid) {
    const t = db.prepare(`SELECT t.*, g.style_no, g.name AS garment_name FROM design_tasks t LEFT JOIN garments g ON g.id=t.garment_id WHERE t.id=?`).get(Number(sid));
    if (!t) return null;
    return t;
  }

  // ---------- 会话 ----------
  app.post('/api/design/sessions', (req, res) => {
    const { garment_id, title } = req.body || {};
    const gid = Number(garment_id) || null;
    if (gid && !db.prepare('SELECT id FROM garments WHERE id=?').get(gid)) return res.status(404).json({ error: '款不存在' });
    const g = gid ? db.prepare('SELECT style_no FROM garments WHERE id=?').get(gid) : null;
    const r = db.prepare(`INSERT INTO design_tasks (garment_id, title, status, created_at, updated_at)
      VALUES (?,?, 'active', datetime('now','localtime'), datetime('now','localtime'))`)
      .run(gid, String(title || '').slice(0, 100) || (g ? `${g.style_no} 设计` : '新的设计'));
    res.json({ ok: true, id: r.lastInsertRowid });
  });
  app.get('/api/design/sessions', (req, res) => {
    const rows = db.prepare(`SELECT t.*, g.style_no, g.name AS garment_name,
        (SELECT COUNT(*) FROM design_chat_messages WHERE session_id=t.id) AS msg_count
      FROM design_tasks t LEFT JOIN garments g ON g.id=t.garment_id
      ORDER BY t.updated_at DESC`).all();
    res.json(rows);
  });
  app.get('/api/design/sessions/:id', (req, res) => {
    const t = getSession(req.params.id);
    if (!t) return res.status(404).json({ error: '会话不存在' });
    const msgs = db.prepare(`SELECT m.*, di.path AS img_path, di.thumb_path AS img_thumb
      FROM design_chat_messages m LEFT JOIN design_images di ON di.id=m.image_id
      WHERE m.session_id=? ORDER BY m.id`).all(t.id).map((m) => ({ ...m, meta: J.parse(m.meta_json, {}) }));
    res.json({ session: t, messages: msgs });
  });
  app.delete('/api/design/sessions/:id', (req, res) => {
    const t = getSession(req.params.id);
    if (!t) return res.status(404).json({ error: '会话不存在' });
    const imgs = db.prepare('SELECT path, thumb_path FROM design_images WHERE task_id=?').all(t.id);
    db.prepare('DELETE FROM design_tasks WHERE id=?').run(t.id);
    for (const im of imgs) for (const p of [im.path, im.thumb_path]) {
      if (!p) continue;
      try { fs.unlinkSync(designAbs(p)); } catch {}
    }
    res.json({ ok: true });
  });

  // ---------- 图片上传（聊天附件 / 图生图原图） ----------
  app.post('/api/design/upload', (req, res) => {
    const sid = Number((req.body || {}).session_id) || null;
    if (!sid || !getSession(sid)) return res.status(400).json({ error: '请先进入设计会话' });
    const p = parseDesignDataUrl((req.body || {}).dataUrl);
    if (!p) return res.status(400).json({ error: '图片格式不支持（仅 jpeg/png/webp）' });
    if (p.tooBig) return res.status(400).json({ error: '图片超过 8MB' });
    const web = saveDesignBuffer(p.buf, 'upload', `up_${Date.now()}.${p.ext}`);
    const r = db.prepare(`INSERT INTO design_images (task_id, path, kind, created_at)
      VALUES (?, ?, 'upload', datetime('now','localtime'))`).run(sid, web);
    (async () => {
      const thumb = await makeThumb(designAbs(web), web);
      if (thumb) db.prepare('UPDATE design_images SET thumb_path=? WHERE id=?').run(thumb, r.lastInsertRowid);
    })();
    res.json({ ok: true, id: r.lastInsertRowid, path: web });
  });

  // ---------- 模型列表 ----------
  app.get('/api/design/models', (req, res) => {
    const rows = db.prepare(`SELECT id, model_id, display_name, image_price FROM models
      WHERE category='visual' AND is_active=1 ORDER BY id`).all();
    res.json(rows);
  });

  // ---------- 生成前确认：解析参数 + 计费（无副作用） ----------
  app.post('/api/design/prepare', (req, res) => {
    try {
      const { prompt, image_id, model_id, clarity, ratio, seed } = req.body || {};
      if (!String(prompt || '').trim() && !image_id) return res.status(400).json({ error: '请输入描述或上传图片' });
      let imgPath = '';
      if (image_id) {
        const im = db.prepare('SELECT path FROM design_images WHERE id=?').get(Number(image_id));
        if (!im) return res.status(400).json({ error: '图片不存在' });
        imgPath = im.path;
      }
      const r = resolveGeneration({ prompt, model_id, clarity, ratio, seed });
      res.json({ ok: true, ...r, has_image: !!imgPath, image_path: imgPath });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ---------- 生成（同步等待，最长 180s；用户点确认后才调用） ----------
  app.post('/api/design/generate', async (req, res) => {
    const { session_id, prompt, image_id, model_id, clarity, ratio, seed } = req.body || {};
    const t = getSession(session_id);
    if (!t) return res.status(404).json({ error: '会话不存在' });
    let r;
    try {
      r = resolveGeneration({ prompt, model_id, clarity, ratio, seed });
    } catch (e) { return res.status(400).json({ error: e.message }); }
    if (!String(r.prompt_clean || '').trim() && !image_id) return res.status(400).json({ error: '请输入描述或上传图片' });
    try {
      let imageDataUrl = '';
      if (image_id) {
        const im = db.prepare('SELECT path FROM design_images WHERE id=?').get(Number(image_id));
        if (!im || !fs.existsSync(designAbs(im.path))) throw new Error('原图文件不存在');
        const buf = fs.readFileSync(designAbs(im.path));
        const ext = (path.extname(im.path).slice(1) || 'png').replace('jpg', 'jpeg');
        imageDataUrl = `data:image/${ext};base64,${buf.toString('base64')}`;
      }
      const dl = r.api_format === 'qwen'
        ? await qwenGenerate({ base_url: r.base_url, api_key: r.api_key, model: r.model_id, prompt: r.prompt_clean, imageDataUrl, size: r.size, seed: r.seed })
        : await openrouterGenerate({ base_url: r.base_url, api_key: r.api_key, model: r.model_id, prompt: r.prompt_clean, size: r.size });
      const web = saveDesignBuffer(dl.buf, 'generate', `g${t.id}_${Date.now()}.${dl.ext}`);
      const abs = designAbs(web);
      let w = 0, h = 0;
      try { const meta = await (await getSharp())(abs).metadata(); w = meta.width || 0; h = meta.height || 0; } catch {}
      const thumb = await makeThumb(abs, web);
      const ir = db.prepare(`INSERT INTO design_images
        (task_id, path, thumb_path, width, height, prompt, model, seed, size, cost, kind, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,'generate',datetime('now','localtime'))`)
        .run(t.id, web, thumb, w, h, r.prompt_clean.slice(0, 2000), r.model_id, r.seed, r.size, r.cost);
      const imageId = ir.lastInsertRowid;
      logImageCost(r.model_id, r.cost);
      const meta = { model: r.model_id, model_name: r.model_name, size: r.size, ratio: r.ratio, clarity: r.clarity, seed: r.seed, cost: r.cost };
      const um = db.prepare(`INSERT INTO design_chat_messages (session_id, role, text, image_id, meta_json, created_at)
        VALUES (?,?,?, ?,?,datetime('now','localtime'))`)
        .run(t.id, 'user', String(prompt || '').slice(0, 2000), image_id ? Number(image_id) : null, J.str({}));
      const am = db.prepare(`INSERT INTO design_chat_messages (session_id, role, text, image_id, meta_json, created_at)
        VALUES (?,?, '', ?,?,datetime('now','localtime'))`)
        .run(t.id, 'ai', imageId, J.str(meta));
      touchSession(t.id);
      res.json({ ok: true, image: { id: imageId, path: web, thumb_path: thumb, ...meta }, user_msg_id: um.lastInsertRowid, ai_msg_id: am.lastInsertRowid });
    } catch (e) {
      console.error('[design generate]', e.message);
      res.status(500).json({ error: e.message || '生图失败' });
    }
  });

  // ---------- 重新生成：同参数换新 seed 再跑一张 ----------
  app.post('/api/design/messages/:id/regenerate', async (req, res) => {
    const m = db.prepare('SELECT * FROM design_chat_messages WHERE id=? AND role=?').get(Number(req.params.id), 'ai');
    if (!m) return res.status(404).json({ error: '消息不存在' });
    const meta = J.parse(m.meta_json, {});
    const um = db.prepare(`SELECT * FROM design_chat_messages WHERE session_id=? AND role='user' AND id<?
      ORDER BY id DESC LIMIT 1`).get(m.session_id, m.id);
    if (!um) return res.status(400).json({ error: '找不到对应的用户消息' });
    const prevImg = m.image_id ? db.prepare('SELECT prompt FROM design_images WHERE id=?').get(m.image_id) : null;
    try {
      const r = resolveGeneration({
        prompt: (prevImg && prevImg.prompt) || um.text, model_id: meta.model, clarity: meta.clarity,
        ratio: meta.ratio, seed: null, // 换新 seed 出变化图
      });
      // 用解析出的干净 prompt（去掉比例词后的）
      const cleanPrompt = r.prompt_clean || um.text;
      let imageDataUrl = '';
      if (um.image_id) {
        const im = db.prepare('SELECT path FROM design_images WHERE id=?').get(um.image_id);
        if (im && fs.existsSync(designAbs(im.path))) {
          const buf = fs.readFileSync(designAbs(im.path));
          const ext = (path.extname(im.path).slice(1) || 'png').replace('jpg', 'jpeg');
          imageDataUrl = `data:image/${ext};base64,${buf.toString('base64')}`;
        }
      }
      const dl = r.api_format === 'qwen'
        ? await qwenGenerate({ base_url: r.base_url, api_key: r.api_key, model: r.model_id, prompt: cleanPrompt, imageDataUrl, size: r.size, seed: r.seed })
        : await openrouterGenerate({ base_url: r.base_url, api_key: r.api_key, model: r.model_id, prompt: cleanPrompt, size: r.size });
      const web = saveDesignBuffer(dl.buf, 'generate', `g${m.session_id}_${Date.now()}.${dl.ext}`);
      const thumb = await makeThumb(designAbs(web), web);
      const ir = db.prepare(`INSERT INTO design_images
        (task_id, path, thumb_path, prompt, model, seed, size, cost, kind, created_at)
        VALUES (?,?,?,?,?,?,?,?,'generate',datetime('now','localtime'))`)
        .run(m.session_id, web, thumb, cleanPrompt.slice(0, 2000), r.model_id, r.seed, r.size, r.cost);
      logImageCost(r.model_id, r.cost);
      const nmeta = { model: r.model_id, model_name: r.model_name, size: r.size, ratio: r.ratio, clarity: r.clarity, seed: r.seed, cost: r.cost, prompt: cleanPrompt.slice(0, 2000) };
      const am = db.prepare(`INSERT INTO design_chat_messages (session_id, role, text, image_id, meta_json, created_at)
        VALUES (?,?, '', ?,?,datetime('now','localtime'))`).run(m.session_id, 'ai', ir.lastInsertRowid, J.str(nmeta));
      touchSession(m.session_id);
      res.json({ ok: true, image: { id: ir.lastInsertRowid, path: web, thumb_path: thumb, ...nmeta }, ai_msg_id: am.lastInsertRowid });
    } catch (e) {
      console.error('[design regenerate]', e.message);
      res.status(500).json({ error: e.message || '重新生成失败' });
    }
  });
  app.delete('/api/design/messages/:id', (req, res) => {
    const m = db.prepare('SELECT * FROM design_chat_messages WHERE id=?').get(Number(req.params.id));
    if (!m) return res.status(404).json({ error: '消息不存在' });
    if (m.image_id) {
      const im = db.prepare('SELECT path, thumb_path, kind FROM design_images WHERE id=?').get(m.image_id);
      // 只删生成图；用户上传的原图保留（可能被其他消息引用）
      if (im && im.kind === 'generate') {
        db.prepare('UPDATE design_chat_messages SET image_id=NULL WHERE image_id=?').run(m.image_id);
        db.prepare('DELETE FROM design_images WHERE id=?').run(m.image_id);
        for (const p of [im.path, im.thumb_path]) { if (p) try { fs.unlinkSync(designAbs(p)); } catch {} }
      }
    }
    db.prepare('DELETE FROM design_chat_messages WHERE id=?').run(m.id);
    res.json({ ok: true });
  });

  // ---------- 资产库（读 design_images） ----------
  app.get('/api/assets', (req, res) => {
    const { kind = '', garment_id = '', session_id = '' } = req.query;
    let sql = `SELECT di.*, t.garment_id, g.style_no FROM design_images di
      LEFT JOIN design_tasks t ON t.id=di.task_id LEFT JOIN garments g ON g.id=t.garment_id WHERE 1=1`;
    const args = [];
    if (kind) { sql += ' AND di.kind=?'; args.push(kind); }
    if (garment_id) { sql += ' AND t.garment_id=?'; args.push(Number(garment_id)); }
    if (session_id) { sql += ' AND di.task_id=?'; args.push(Number(session_id)); }
    res.json(db.prepare(sql + ' ORDER BY di.id DESC').all(...args));
  });
  app.put('/api/assets/:id', (req, res) => {
    db.prepare('UPDATE design_images SET note=? WHERE id=?').run(String((req.body || {}).note || '').slice(0, 500), Number(req.params.id));
    res.json({ ok: true });
  });
  app.delete('/api/assets/:id', (req, res) => {
    const r = db.prepare('SELECT path, thumb_path FROM design_images WHERE id=?').get(Number(req.params.id));
    if (!r) return res.status(404).json({ error: '记录不存在' });
    db.prepare('UPDATE design_chat_messages SET image_id=NULL WHERE image_id=?').run(Number(req.params.id));
    db.prepare('DELETE FROM design_images WHERE id=?').run(Number(req.params.id));
    for (const p of [r.path, r.thumb_path]) { if (p) try { fs.unlinkSync(designAbs(p)); } catch {} }
    res.json({ ok: true });
  });

  // ---------- 灵感库（v2，本期仅保留上传入库） ----------
  app.post('/api/inspirations', (req, res) => {
    const { path: p, note, source_url, garment_id } = req.body || {};
    if (!p || !String(p).startsWith('/uploads/design/')) return res.status(400).json({ error: '请先上传灵感图' });
    if (!fs.existsSync(designAbs(p))) return res.status(400).json({ error: '图片文件不存在' });
    (async () => {
      const thumb = await makeThumb(designAbs(p), p);
      if (thumb) db.prepare('UPDATE inspirations SET thumb_path=? WHERE path=?').run(thumb, p);
    })();
    const r = db.prepare(`INSERT INTO inspirations (garment_id, path, note, source_url, created_at)
      VALUES (?,?,?, ?, datetime('now','localtime'))`)
      .run(garment_id ? Number(garment_id) : null, p, String(note || '').slice(0, 500), String(source_url || '').slice(0, 500));
    res.json({ ok: true, id: r.lastInsertRowid });
  });
  app.get('/api/inspirations', (req, res) => {
    const { garment_id = '' } = req.query;
    let sql = 'SELECT * FROM inspirations WHERE 1=1';
    const args = [];
    if (garment_id) { sql += ' AND garment_id=?'; args.push(Number(garment_id)); }
    res.json(db.prepare(sql + ' ORDER BY id DESC').all(...args));
  });
}
