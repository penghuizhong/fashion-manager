// 设计台（一期 MVP，v0.16.9）路由模块：由 server/src/index.js 经 mountDesign 挂载
import fs from 'node:fs';
import path from 'node:path';

export function mountDesign(app, ctx) {
  const { db, DATA_DIR, J, now, getAdminConfig, chatComplete } = ctx;

  // ---------- 设计台（一期 MVP，v0.16.9） ----------
  // 图片本地存储：数据盘 uploads/design/{candidate,inspiration}/，DB 存相对 web 路径；缩略图走 thumbs/
  function designDir(...segs) {
    const d = path.join(DATA_DIR, 'uploads', 'design', ...segs);
    fs.mkdirSync(d, { recursive: true });
    return d;
  }
  designDir('candidate'); designDir('inspiration'); designDir('thumbs', 'candidate'); designDir('thumbs', 'inspiration');

  let _sharp = null;
  async function getSharp() { if (!_sharp) _sharp = (await import('sharp')).default; return _sharp; }
  // 缩略图：长边 400px 的 jpg，失败返回空串（前端回退用原图）
  async function makeThumb(absSrc, webPath) {
    try {
      const s = await getSharp();
      const rel = webPath.replace(/^\/uploads\/design\//, '').replace(/\.[a-z0-9]+$/i, '.jpg');
      const outDir = designDir('thumbs', path.dirname(rel));
      await s(absSrc).rotate().resize({ width: 400, withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(path.join(outDir, path.basename(rel)));
      return `/uploads/design/thumbs/${rel}`;
    } catch (e) { console.warn('[design] 缩略图失败', e.message); return ''; }
  }
  function designAbs(webPath) { return path.join(DATA_DIR, 'uploads', String(webPath || '').replace(/^\/uploads\//, '')); }
  function saveDesignBuffer(buf, sub, fname) {
    const d = designDir(sub);
    fs.writeFileSync(path.join(d, fname), buf);
    return `/uploads/design/${sub}/${fname}`;
  }
  function parseDesignDataUrl(dataUrl) {
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl || '');
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length || buf.length > 8 * 1024 * 1024) return { tooBig: true };
    return { buf, ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
  }

  // 生图配置：读 visual 分类下的供应商 + image_gen 模型（与连通测试同一套，v0.16.8 拍板）
  function getImageGenConfig() {
    const pv = db.prepare('SELECT * FROM model_providers WHERE category=?').get('visual') || {};
    const m = db.prepare(`SELECT * FROM models WHERE category='visual' AND subcategory='image_gen' AND is_active=1 ORDER BY id LIMIT 1`).get();
    const base_url = String(((m && m.base_url) || pv.base_url || '')).replace(/\/+$/, '');
    const api_key = String((m && m.api_key) || pv.api_key || '');
    const api_format = pv.api_format === 'qwen' ? 'qwen' : 'openrouter';
    const model = (m && m.model_id) || 'qwen-image-3.0';
    if (!base_url) throw new Error('请先在管理设置里配置视觉模型的供应商地址');
    if (!api_key) throw new Error('请先在管理设置里配置视觉模型的 API Key');
    return { base_url, api_key, api_format, model };
  }

  // ① 意图解析：一句话改法 → 结构化参数 JSON（廓形/颜色/面料/细节）
  async function parseRedesignParams(desc, garmentName) {
    try {
      const cfg = getAdminConfig(true);
      const model = cfg.backend_model || cfg.chat_model;
      if (!model) return {};
      const raw = await chatComplete([
        { role: 'system', content: '你是服装设计助理。把用户的改款描述解析成 JSON，只返回 JSON：{"silhouette":"廓形","color":"颜色","fabric":"面料","details":"细节"}，没提到的留空字符串。' },
        { role: 'user', content: `款：${garmentName}\n改法：${desc}` },
      ], model, 400, { jsonMode: true, usageTag: 'designParse', temperature: 0.2 });
      const p = J.parse(raw, {});
      return { silhouette: String(p.silhouette || ''), color: String(p.color || ''), fabric: String(p.fabric || ''), details: String(p.details || '') };
    } catch (e) { console.warn('[design] 意图解析失败', e.message); return {}; }
  }
  function buildGenPrompt(g, desc, params) {
    const bits = [];
    if (desc) bits.push(desc);
    const pl = [];
    if (params.silhouette) pl.push(`廓形：${params.silhouette}`);
    if (params.color) pl.push(`颜色：${params.color}`);
    if (params.fabric) pl.push(`面料：${params.fabric}`);
    if (params.details) pl.push(`细节：${params.details}`);
    if (pl.length) bits.push(pl.join('；'));
    return `服装改款效果图：${bits.join('；')}。保留原图服装的主体结构和版型，只做上述局部改款，生成高质量产品效果图。这是设计预览图，不是生产版；结构性改款仍需重新制版。`;
  }
  async function downloadImage(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`图片下载失败 ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    return { buf, ext: ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg' };
  }
  // qwen 原生格式：异步提交 → 轮询任务 → 下载图片
  async function pollQwenTask(origin, headers, taskId) {
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const r = await fetch(`${origin}/api/v1/tasks/${taskId}`, { headers, signal: AbortSignal.timeout(30000) });
      const d = await r.json().catch(() => ({}));
      const st = d.output && d.output.task_status;
      if (st === 'SUCCEEDED') {
        const url = d.output.results && d.output.results[0] && d.output.results[0].url;
        if (!url) throw new Error('生图成功但未返回图片地址');
        return downloadImage(url);
      }
      if (st === 'FAILED' || st === 'CANCELED' || st === 'UNKNOWN') throw new Error(`生图任务${st}：${(d.output && d.output.message) || ''}`);
    }
    throw new Error('生图超时（180 秒）');
  }
  async function qwenImageEdit({ base_url, api_key, model, prompt, imageDataUrl, n }) {
    const origin = new URL(base_url).origin;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}`, 'X-DashScope-Async': 'enable' };
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = await fetch(origin + '/api/v1/services/aigc/multimodal-generation/generation', {
        method: 'POST', headers,
        body: JSON.stringify({
          model,
          input: { messages: [{ role: 'user', content: [{ image: imageDataUrl }, { text: prompt }] }] },
          parameters: { prompt_extend: true },
        }),
        signal: AbortSignal.timeout(60000),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || d.code || `生图提交失败 ${r.status}`);
      const taskId = d.output && d.output.task_id;
      if (!taskId) throw new Error('生图接口未返回 task_id');
      out.push(await pollQwenTask(origin, headers, taskId));
    }
    return out;
  }
  // OpenAI 兼容格式
  async function openrouterImages({ base_url, api_key, model, prompt, n }) {
    const r = await fetch(base_url + '/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
      body: JSON.stringify({ model, prompt, n, size: '1024x1024' }),
      signal: AbortSignal.timeout(180000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `生图失败 ${r.status}`);
    const out = [];
    for (const it of (d.data || [])) {
      if (it.b64_json) out.push({ buf: Buffer.from(it.b64_json, 'base64'), ext: 'png' });
      else if (it.url) out.push(await downloadImage(it.url));
    }
    if (!out.length) throw new Error('生图未返回图片');
    return out;
  }
  // 三步主流程：①意图解析 → ②调图生图 → ③落盘+缩略图+入库（失败写 error，不抛）
  async function runRedesign(taskId, opts = {}) {
    const t = db.prepare('SELECT * FROM design_tasks WHERE id=?').get(taskId);
    if (!t) return;
    try {
      const g = db.prepare('SELECT * FROM garments WHERE id=?').get(t.garment_id) || {};
      const gName = `${g.style_no || ''} ${g.name || ''}`.trim();
      const params = opts.skipParse ? J.parse(t.params_json, {}) : await parseRedesignParams(t.desc_text, gName);
      if (!opts.skipParse) db.prepare('UPDATE design_tasks SET params_json=?, updated_at=? WHERE id=?').run(J.str(params), now(), taskId);
      const cfg = getImageGenConfig();
      const prompt = buildGenPrompt(g, t.desc_text, params);
      let imgs;
      if (cfg.api_format === 'qwen') {
        if (!t.base_path || !fs.existsSync(designAbs(t.base_path))) throw new Error('qwen 图生图需要基准图，请先上传基准图');
        const abs = designAbs(t.base_path);
        const buf = fs.readFileSync(abs);
        const ext = (path.extname(abs).slice(1) || 'png').replace('jpg', 'jpeg');
        imgs = await qwenImageEdit({ ...cfg, prompt, imageDataUrl: `data:image/${ext};base64,${buf.toString('base64')}`, n: 3 });
      } else {
        imgs = await openrouterImages({ ...cfg, prompt, n: 3 });
      }
      let i = 0;
      for (const im of imgs) {
        i++;
        const web = saveDesignBuffer(im.buf, 'candidate', `t${taskId}_${Date.now()}_${i}.${im.ext}`);
        const abs = designAbs(web);
        let w = 0, h = 0;
        try { const meta = await (await getSharp())(abs).metadata(); w = meta.width || 0; h = meta.height || 0; } catch {}
        const thumb = await makeThumb(abs, web);
        db.prepare(`INSERT INTO design_images (task_id, path, thumb_path, width, height, params_snapshot, created_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'))`)
          .run(taskId, web, thumb, w, h, J.str(params));
      }
      db.prepare(`UPDATE design_tasks SET status='done', error='', updated_at=datetime('now','localtime') WHERE id=?`).run(taskId);
    } catch (e) {
      console.error('[redesign]', e.message);
      db.prepare(`UPDATE design_tasks SET status='failed', error=?, updated_at=datetime('now','localtime') WHERE id=?`).run(String(e.message || e).slice(0, 500), taskId);
    }
  }
  // 新版次：V+1，复制最新版次的样衣数据（与 POST /api/garments/:id/versions 同逻辑）
  function newVersionFrom(gid, note) {
    const t = now();
    return db.transaction(() => {
      const max = db.prepare('SELECT MAX(ver_num) AS m FROM versions WHERE garment_id=?').get(gid).m || 0;
      const ver_num = max + 1;
      const v = db.prepare('INSERT INTO versions (garment_id,ver,ver_num,note,created_at) VALUES (?,?,?,?,?)').run(gid, `V${ver_num}`, ver_num, String(note || '').slice(0, 500), t);
      const latest = db.prepare('SELECT version_id FROM samples WHERE garment_id=? ORDER BY version_id DESC LIMIT 1').get(gid);
      let size_table = '[]', materials = '[]', craft_desc = '', photos = '[]', fitting_notes = '', labor_cost = 0;
      if (latest) {
        const src = db.prepare('SELECT * FROM samples WHERE version_id=? AND garment_id=?').get(latest.version_id, gid);
        if (src) ({ size_table, materials, craft_desc, photos, fitting_notes, labor_cost } = src);
      }
      db.prepare(`INSERT INTO samples (garment_id,version_id,size_table,materials,craft_desc,photos,fitting_notes,labor_cost,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(gid, v.lastInsertRowid, size_table, materials, craft_desc, photos, fitting_notes, labor_cost, t, t);
      db.prepare('UPDATE garments SET updated_at=? WHERE id=?').run(t, gid);
      return { id: v.lastInsertRowid, ver: `V${ver_num}`, ver_num };
    })();
  }

  // 设计图上传（基准图 / 灵感图，base64，≤8MB）
  app.post('/api/design/upload', (req, res) => {
    const { dataUrl, kind } = req.body || {};
    const p = parseDesignDataUrl(dataUrl);
    if (!p) return res.status(400).json({ error: '图片格式不支持（仅 jpeg/png/webp）' });
    if (p.tooBig) return res.status(400).json({ error: '图片超过 8MB' });
    const sub = kind === 'inspiration' ? 'inspiration' : 'candidate';
    const web = saveDesignBuffer(p.buf, sub, `up_${Date.now()}.${p.ext}`);
    res.json({ ok: true, path: web });
  });

  // POST /api/redesign：创建任务并异步跑三步，返回 task_id（前端轮询）
  app.post('/api/redesign', (req, res) => {
    const { garment_id, base_path, base_image_id, insp_id, desc } = req.body || {};
    const gid = Number(garment_id);
    if (!(gid > 0)) return res.status(400).json({ error: '请先选择款' });
    if (!db.prepare('SELECT id FROM garments WHERE id=?').get(gid)) return res.status(404).json({ error: '款不存在' });
    if (!String(desc || '').trim() && !insp_id) return res.status(400).json({ error: '请描述改法或选择灵感图' });
    let bp = String(base_path || '');
    if (base_image_id) { const bi = db.prepare('SELECT path FROM design_images WHERE id=?').get(Number(base_image_id)); if (bi) bp = bi.path; }
    if (insp_id) { const ins = db.prepare('SELECT path FROM inspirations WHERE id=?').get(Number(insp_id)); if (ins) bp = ins.path; }
    const r = db.prepare(`INSERT INTO design_tasks (garment_id, base_image_id, insp_id, base_path, desc_text, params_json, status, created_at, updated_at)
      VALUES (?,?,?,?,?, '{}', 'generating', datetime('now','localtime'), datetime('now','localtime'))`)
      .run(gid, base_image_id ? Number(base_image_id) : null, insp_id ? Number(insp_id) : null, bp, String(desc || '').slice(0, 2000));
    const taskId = r.lastInsertRowid;
    runRedesign(taskId);
    res.json({ ok: true, task_id: taskId });
  });
  // 任务状态 + 候选图（轮询）
  app.get('/api/redesign/:id', (req, res) => {
    const t = db.prepare('SELECT * FROM design_tasks WHERE id=?').get(Number(req.params.id));
    if (!t) return res.status(404).json({ error: '任务不存在' });
    const images = db.prepare('SELECT * FROM design_images WHERE task_id=? ORDER BY id').all(t.id);
    res.json({ task: { ...t, params: J.parse(t.params_json, {}) }, images });
  });
  // 重新生成：手动改参数后重跑（跳过意图解析）
  app.post('/api/redesign/:id/regenerate', (req, res) => {
    const t = db.prepare('SELECT * FROM design_tasks WHERE id=?').get(Number(req.params.id));
    if (!t) return res.status(404).json({ error: '任务不存在' });
    const p = (req.body && req.body.params) || {};
    const params = { silhouette: String(p.silhouette || ''), color: String(p.color || ''), fabric: String(p.fabric || ''), details: String(p.details || '') };
    db.prepare(`UPDATE design_tasks SET params_json=?, status='generating', error='', updated_at=datetime('now','localtime') WHERE id=?`).run(J.str(params), t.id);
    runRedesign(t.id, { skipParse: true });
    res.json({ ok: true });
  });
  // 点选候选 → 存为新版次（V+1，复制上一版样衣数据）
  app.post('/api/redesign/:id/select', (req, res) => {
    const t = db.prepare('SELECT * FROM design_tasks WHERE id=?').get(Number(req.params.id));
    if (!t) return res.status(404).json({ error: '任务不存在' });
    const img = db.prepare('SELECT * FROM design_images WHERE id=? AND task_id=?').get(Number((req.body || {}).image_id), t.id);
    if (!img) return res.status(400).json({ error: '请选择本次任务生成的候选图' });
    const out = db.transaction(() => {
      db.prepare('UPDATE design_images SET selected=0 WHERE task_id=?').run(t.id);
      db.prepare('UPDATE design_images SET selected=1 WHERE id=?').run(img.id);
      db.prepare('UPDATE design_tasks SET selected_image_id=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?').run(img.id, t.id);
      const note = String((req.body || {}).note || t.desc_text || '设计台改款').slice(0, 500);
      return newVersionFrom(t.garment_id, note);
    })();
    res.json({ ok: true, ...out });
  });
  // 按款查看改款历史
  app.get('/api/garments/:id/design-history', (req, res) => {
    const gid = Number(req.params.id);
    const tasks = db.prepare(`SELECT t.*,
        (SELECT COUNT(*) FROM design_images WHERE task_id=t.id) AS img_count,
        (SELECT thumb_path FROM design_images WHERE task_id=t.id AND selected=1 LIMIT 1) AS sel_thumb,
        (SELECT thumb_path FROM design_images WHERE task_id=t.id LIMIT 1) AS first_thumb
      FROM design_tasks t WHERE garment_id=? ORDER BY id DESC`).all(gid);
    res.json(tasks.map((t) => ({ ...t, params: J.parse(t.params_json, {}) })));
  });
  // 资产库：候选图 + 灵感图统一列表（可按款/类型筛选）
  app.get('/api/assets', (req, res) => {
    const { type = '', garment_id = '' } = req.query;
    const out = [];
    if (!type || type === 'candidate') {
      let sql = `SELECT di.*, t.garment_id FROM design_images di LEFT JOIN design_tasks t ON t.id=di.task_id WHERE 1=1`;
      const args = [];
      if (garment_id) { sql += ' AND t.garment_id=?'; args.push(Number(garment_id)); }
      out.push(...db.prepare(sql + ' ORDER BY di.id DESC').all(...args).map((r) => ({ kind: 'candidate', ...r, params: J.parse(r.params_snapshot, {}) })));
    }
    if (!type || type === 'inspiration') {
      let sql = `SELECT * FROM inspirations WHERE 1=1`;
      const args = [];
      if (garment_id) { sql += ' AND garment_id=?'; args.push(Number(garment_id)); }
      out.push(...db.prepare(sql + ' ORDER BY id DESC').all(...args).map((r) => ({ kind: 'inspiration', ...r })));
    }
    out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    res.json(out);
  });
  app.put('/api/assets/:kind/:id', (req, res) => {
    const tbl = req.params.kind === 'candidate' ? 'design_images' : req.params.kind === 'inspiration' ? 'inspirations' : null;
    if (!tbl) return res.status(400).json({ error: '类型无效' });
    db.prepare(`UPDATE ${tbl} SET note=? WHERE id=?`).run(String((req.body || {}).note || '').slice(0, 500), Number(req.params.id));
    res.json({ ok: true });
  });
  app.delete('/api/assets/:kind/:id', (req, res) => {
    const tbl = req.params.kind === 'candidate' ? 'design_images' : req.params.kind === 'inspiration' ? 'inspirations' : null;
    if (!tbl) return res.status(400).json({ error: '类型无效' });
    const r = db.prepare(`SELECT path, thumb_path FROM ${tbl} WHERE id=?`).get(Number(req.params.id));
    if (!r) return res.status(404).json({ error: '记录不存在' });
    db.prepare(`DELETE FROM ${tbl} WHERE id=?`).run(Number(req.params.id));
    for (const p of [r.path, r.thumb_path]) {
      if (!p) continue;
      try { fs.unlinkSync(designAbs(p)); } catch {}
    }
    res.json({ ok: true });
  });
  // 灵感库：上传入库（一期不打标：上传、备注、来源链接、关联款、浏览）
  app.post('/api/inspirations', (req, res) => {
    const { path: p, note, source_url, garment_id } = req.body || {};
    if (!p || !String(p).startsWith('/uploads/design/inspiration/')) return res.status(400).json({ error: '请先上传灵感图' });
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
  // 以灵感图新建改款
  app.post('/api/inspirations/:id/redesign', (req, res) => {
    const ins = db.prepare('SELECT * FROM inspirations WHERE id=?').get(Number(req.params.id));
    if (!ins) return res.status(404).json({ error: '灵感图不存在' });
    const gid = Number((req.body || {}).garment_id) || ins.garment_id;
    if (!(gid > 0)) return res.status(400).json({ error: '请先选择款' });
    const r = db.prepare(`INSERT INTO design_tasks (garment_id, insp_id, base_path, desc_text, params_json, status, created_at, updated_at)
      VALUES (?,?,?, ?, '{}', 'generating', datetime('now','localtime'), datetime('now','localtime'))`)
      .run(gid, ins.id, ins.path, String((req.body || {}).desc || '参考灵感图改款').slice(0, 2000));
    runRedesign(r.lastInsertRowid);
    res.json({ ok: true, task_id: r.lastInsertRowid });
  });

}
