import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { now, DATA_DIR } from './db.js';
import { nextStyleNo, canTransition, STATUS_LABEL, CATEGORIES, SEASONS } from './styleNo.js';
import { SNIPPETS, TEMPLATES } from './seedTemplatesV3.js';
const LANGS = ['EN', 'ES', 'PT', 'FR', 'DE', 'AR'];
const SCENES = ['first', 'ask', 'quote', 'nudge'];

seedV3();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '25mb' }));

const J = {
  parse: (s, fb) => { try { const v = JSON.parse(s); return v ?? fb; } catch { return fb; } },
  str: (v) => JSON.stringify(v ?? []),
};
const row = (r) => {
  if (!r) return r;
  for (const k of ['size_table', 'materials', 'photos', 'items']) if (k in r) r[k] = J.parse(r[k], []);
  return r;
};

// ---------- config ----------
app.get('/api/config', (req, res) => res.json({
  version: '0.5.1',
  categories: CATEGORIES,
  seasons: SEASONS,
  statusLabel: STATUS_LABEL,
  tplLangs: LANGS,
  tplScenes: SCENES,
}));

// ---------- garments ----------
app.get('/api/garments', (req, res) => {
  const { q = '', status = '' } = req.query;
  let sql = `
    SELECT g.*,
      (SELECT ver FROM versions WHERE garment_id=g.id ORDER BY ver_num DESC LIMIT 1) AS latest_ver,
      (SELECT updated_at FROM samples WHERE garment_id=g.id ORDER BY updated_at DESC LIMIT 1) AS sample_updated
    FROM garments g WHERE 1=1`;
  const args = [];
  if (q) { sql += ' AND (g.style_no LIKE ? OR g.name LIKE ?)'; args.push(`%${q}%`, `%${q}%`); }
  if (status) { sql += ' AND g.status=?'; args.push(status); }
  sql += ' ORDER BY g.updated_at DESC';
  res.json(db.prepare(sql).all(...args).map(row));
});

app.post('/api/garments', (req, res) => {
  const { name, category, season } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: '款名必填' });
  let sno;
  try { sno = nextStyleNo(season, category); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const t = now();
  const g = db.transaction(() => {
    const r = db.prepare(
      `INSERT INTO garments (style_no,name,category,season,year,seq,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?, 'draft', ?,?)`
    ).run(sno.style_no, String(name).trim(), category, season, sno.yy, sno.seq, t, t);
    const gid = r.lastInsertRowid;
    const v = db.prepare(
      'INSERT INTO versions (garment_id,ver,ver_num,note,created_at) VALUES (?,?,?,?,?)'
    ).run(gid, 'V1', 1, '首版', t);
    db.prepare(
      `INSERT INTO samples (garment_id,version_id,created_at,updated_at) VALUES (?,?,?,?)`
    ).run(gid, v.lastInsertRowid, t, t);
    return gid;
  })();
  res.json({ ok: true, id: g, style_no: sno.style_no });
});

app.get('/api/garments/:id', (req, res) => {
  const g = row(db.prepare('SELECT * FROM garments WHERE id=?').get(req.params.id));
  if (!g) return res.status(404).json({ error: '款不存在' });
  const versions = db.prepare('SELECT * FROM versions WHERE garment_id=? ORDER BY ver_num').all(g.id);
  const samples = db.prepare('SELECT * FROM samples WHERE garment_id=?').all(g.id).map(row);
  const qids = samples.map(s => s.id);
  const quotations = qids.length
    ? db.prepare(`SELECT * FROM quotations WHERE sample_id IN (${qids.map(() => '?').join(',')}) ORDER BY updated_at DESC`).all(...qids).map(row)
    : [];
  res.json({ garment: g, versions, samples, quotations });
});

app.patch('/api/garments/:id', (req, res) => {
  const g = db.prepare('SELECT * FROM garments WHERE id=?').get(req.params.id);
  if (!g) return res.status(404).json({ error: '款不存在' });
  const { status } = req.body || {};
  if (!canTransition(g.status, status)) {
    return res.status(400).json({ error: `状态只能从「${STATUS_LABEL[g.status]}」推进到下一阶段` });
  }
  db.prepare('UPDATE garments SET status=?, updated_at=? WHERE id=?').run(status, now(), g.id);
  res.json({ ok: true, status });
});

// ---------- versions ----------
app.post('/api/garments/:id/versions', (req, res) => {
  const g = db.prepare('SELECT * FROM garments WHERE id=?').get(req.params.id);
  if (!g) return res.status(404).json({ error: '款不存在' });
  const { note = '', copy_from } = req.body || {};
  const t = now();
  const out = db.transaction(() => {
    const max = db.prepare('SELECT MAX(ver_num) AS m FROM versions WHERE garment_id=?').get(g.id).m || 0;
    const ver_num = max + 1;
    const ver = `V${ver_num}`;
    const v = db.prepare(
      'INSERT INTO versions (garment_id,ver,ver_num,note,created_at) VALUES (?,?,?,?,?)'
    ).run(g.id, ver, ver_num, String(note).slice(0, 500), t);
    const vid = v.lastInsertRowid;
    let size_table = '[]', materials = '[]', craft_desc = '', photos = '[]', fitting_notes = '', labor_cost = 0;
    if (copy_from) {
      const src = db.prepare('SELECT * FROM samples WHERE version_id=? AND garment_id=?').get(copy_from, g.id);
      if (src) ({ size_table, materials, craft_desc, photos, fitting_notes, labor_cost } = src);
    }
    db.prepare(
      `INSERT INTO samples (garment_id,version_id,size_table,materials,craft_desc,photos,fitting_notes,labor_cost,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(g.id, vid, size_table, materials, craft_desc, photos, fitting_notes, labor_cost, t, t);
    db.prepare('UPDATE garments SET updated_at=? WHERE id=?').run(t, g.id);
    return { id: vid, ver, ver_num };
  })();
  res.json({ ok: true, ...out });
});

// ---------- samples ----------
app.put('/api/samples/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM samples WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '样衣不存在' });
  const b = req.body || {};
  const clean = (arr) => Array.isArray(arr) ? arr.filter(x => x && (x.part || x.name || x.value)) : [];
  db.prepare(
    `UPDATE samples SET size_table=?, materials=?, craft_desc=?, photos=?, fitting_notes=?, labor_cost=?, updated_at=?
     WHERE id=?`
  ).run(
    J.str(clean(b.size_table)), J.str(clean(b.materials)),
    String(b.craft_desc || '').slice(0, 5000), J.str(b.photos || []),
    String(b.fitting_notes || '').slice(0, 5000), Number(b.labor_cost) || 0, now(), s.id
  );
  db.prepare('UPDATE garments SET updated_at=? WHERE id=?').run(now(), s.garment_id);
  res.json({ ok: true });
});

// base64 照片上传（免 multer 依赖，手机端拍照压缩后上传）
app.post('/api/samples/:id/photos', (req, res) => {
  const s = db.prepare('SELECT * FROM samples WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '样衣不存在' });
  const { dataUrl } = req.body || {};
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return res.status(400).json({ error: '图片格式不支持（仅 jpeg/png/webp）' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: '图片超过 8MB' });
  const fname = `${s.garment_id}_${s.version_id}_${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(DATA_DIR, 'uploads', fname), buf);
  const photos = J.parse(s.photos, []);
  photos.push(`/uploads/${fname}`);
  db.prepare('UPDATE samples SET photos=?, updated_at=? WHERE id=?').run(J.str(photos), now(), s.id);
  res.json({ ok: true, path: `/uploads/${fname}` });
});

app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// ---------- quotations ----------
function calcItems(sample) {
  const mats = J.parse(sample.materials, []);
  const items = mats.map(mt => ({
    label: `${mt.name || '面辅料'}${mt.part ? `（${mt.part}）` : ''}${mt.usage_num ? ` ${mt.usage_num}${mt.unit || ''}` : ''}`,
    amount: Math.round((Number(mt.usage_num) || 0) * (Number(mt.price) || 0) * 100) / 100,
  })).filter(x => x.amount > 0);
  if (Number(sample.labor_cost) > 0) items.push({ label: '工费', amount: Number(sample.labor_cost) });
  return items;
}

app.post('/api/quotations', (req, res) => {
  const { sample_id, customer = '', margin = 30, terms = '' } = req.body || {};
  const s = db.prepare('SELECT * FROM samples WHERE id=?').get(sample_id);
  if (!s) return res.status(404).json({ error: '样衣不存在' });
  const items = calcItems(s);
  const cost = items.reduce((a, x) => a + x.amount, 0);
  const price = Math.round(cost * (1 + Number(margin) / 100) * 100) / 100;
  const t = now();
  const r = db.prepare(
    `INSERT INTO quotations (sample_id,customer,currency,items,margin,price,terms,status,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(s.id, String(customer).slice(0, 200), 'CNY', J.str(items), Number(margin) || 0, price, String(terms).slice(0, 1000), 'draft', t, t);
  res.json({ ok: true, id: r.lastInsertRowid, price });
});

app.get('/api/quotations/:id', (req, res) => {
  const q = row(db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id));
  if (!q) return res.status(404).json({ error: '报价单不存在' });
  const g = db.prepare('SELECT garment_id FROM samples WHERE id=?').get(q.sample_id);
  q.garment_id = g ? g.garment_id : null;
  res.json(q);
});

app.put('/api/quotations/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id);
  if (!q) return res.status(404).json({ error: '报价单不存在' });
  const b = req.body || {};
  db.prepare(
    `UPDATE quotations SET customer=?, items=?, margin=?, price=?, terms=?, status=?, updated_at=? WHERE id=?`
  ).run(
    String(b.customer ?? q.customer).slice(0, 200), J.str(b.items ?? J.parse(q.items, [])),
    Number(b.margin ?? q.margin) || 0, Number(b.price ?? q.price) || 0,
    String(b.terms ?? q.terms).slice(0, 1000),
    ['draft', 'sent', 'accepted'].includes(b.status) ? b.status : q.status, now(), q.id
  );
  res.json({ ok: true });
});

// 报价文本：一键复制，粘到阿里/微信
app.get('/api/quotations/:id/text', (req, res) => {
  const q = row(db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id));
  if (!q) return res.status(404).json({ error: '报价单不存在' });
  const s = db.prepare(
    `SELECT s.*, v.ver, g.style_no, g.name FROM samples s
     JOIN versions v ON v.id=s.version_id JOIN garments g ON g.id=s.garment_id WHERE s.id=?`
  ).get(q.sample_id);
  const items = q.items.map(i => `· ${i.label}：¥${i.amount}`).join('\n');
  const cost = q.items.reduce((a, x) => a + Number(x.amount || 0), 0);
  const text =
`报价单 ${s.style_no}-${s.ver} ${s.name}
客户：${q.customer || '—'}
成本明细：
${items || '· （无）'}
成本合计：¥${cost}
报价：¥${q.price}（${q.currency}）
条款：${q.terms || '—'}
— Yingzi`;
  res.json({ text });
});

// ---------- reply-templates（回复模板库 v0.3.0：逻辑模板 × 语言变体 × 类型化变量 × 共享片段） ----------
// 红线（通用规则）：required=1 的变量为空时 render 直接 400，不许复制发出
// 价格/交期绝不能编造 —— 由变量 required 机制保证，不再是写死的特例

function seedV3() {
  const n = db.prepare('SELECT COUNT(*) c FROM templates WHERE origin=?').get('seed').c;
  if (n === 0) {
    const t = now();
    const insT = db.prepare(
      `INSERT INTO templates (key,scene,category,status,version,note_zh,gloss_zh,source_buyer,usage_count,origin,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    const insL = db.prepare('INSERT INTO template_locales (template_id,lang,title,body) VALUES (?,?,?,?)');
    const insV = db.prepare(
      'INSERT INTO template_vars (template_id,name,type,required,label_zh,sample,sort) VALUES (?,?,?,?,?,?,?)'
    );
    const insS = db.prepare(
      'INSERT OR IGNORE INTO snippets (key,lang,title_zh,body) VALUES (?,?,?,?)'
    );
    db.transaction(() => {
      for (const s of SNIPPETS) insS.run(s.key, s.lang, s.title_zh || '', s.body);
      for (const tpl of TEMPLATES) {
        const id = insT.run(
          tpl.key, tpl.scene, tpl.category || '通用', 'published', 1,
          tpl.note_zh || '', tpl.gloss_zh || '', tpl.source_buyer || '', 0, 'seed', t, t
        ).lastInsertRowid;
        (tpl.locales || []).forEach((l) => insL.run(id, l.lang, l.title, l.body));
        (tpl.vars || []).forEach((v, i) =>
          insV.run(id, v.name, v.type || 'text', v.required ? 1 : 0, v.label_zh || v.name, v.sample || '', i));
      }
    })();
    console.log(`[seed] v3 模板库：${TEMPLATES.length} 个逻辑模板 / ${SNIPPETS.length} 个共享片段`);
    return;
  }
  // 已有种子：回填新增字段（如 gloss_zh），不重灌
  const rows = db.prepare(`SELECT id, key FROM templates WHERE origin='seed' AND (gloss_zh IS NULL OR gloss_zh='')`).all();
  if (rows.length) {
    const upd = db.prepare(`UPDATE templates SET gloss_zh=? WHERE id=?`);
    let c = 0;
    db.transaction(() => {
      for (const r of rows) {
        const tpl = TEMPLATES.find((x) => x.key === r.key);
        if (tpl && tpl.gloss_zh) { upd.run(tpl.gloss_zh, r.id); c++; }
      }
    })();
    if (c) console.log(`[seed] 回填 gloss_zh：${c} 个模板`);
  }
}

function expandSnippets(body, lang) {
  return body.replace(/\{\{\s*snippet:([a-z_]+)\s*\}\}/g, (_, k) => {
    const s = db.prepare('SELECT body FROM snippets WHERE key=? AND lang=?').get(k, lang)
      || db.prepare('SELECT body FROM snippets WHERE key=? AND lang=?').get(k, 'EN');
    return s ? s.body : '';
  });
}
function renderBody(body, slots = {}) {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) =>
    slots[k] !== undefined && slots[k] !== null ? String(slots[k]) : '');
}
function getTemplateFull(id) {
  const t = db.prepare('SELECT * FROM templates WHERE id=?').get(id);
  if (!t) return null;
  t.locales = db.prepare('SELECT lang,title,body FROM template_locales WHERE template_id=? ORDER BY lang').all(id);
  t.vars = db.prepare(
    'SELECT name,type,required,label_zh,sample FROM template_vars WHERE template_id=? ORDER BY sort,id'
  ).all(id);
  return t;
}
function pickLocale(t, lang) {
  const hit = (t.locales || []).find((l) => l.lang === lang);
  if (hit) return { locale: hit, fallback: false };
  const en = (t.locales || []).find((l) => l.lang === 'EN');
  return { locale: en || t.locales[0], fallback: true };
}
const tplTitleOf = (t) => {
  const en = (t.locales || []).find((l) => l.lang === 'EN');
  return (en || t.locales[0] || {}).title || t.key;
};

// 列表：逻辑模板 + 可用语言 + 使用次数；q 跨全部语言变体搜索
app.get('/api/reply-templates', (req, res) => {
  const { q = '', scene = '' } = req.query;
  const args = [];
  let sql = 'SELECT t.* FROM templates t WHERE 1=1';
  if (scene) { sql += ' AND t.scene=?'; args.push(scene); }
  if (q) {
    sql += ` AND (t.key LIKE ? OR t.note_zh LIKE ? OR t.category LIKE ?
      OR EXISTS (SELECT 1 FROM template_locales l WHERE l.template_id=t.id AND (l.title LIKE ? OR l.body LIKE ?)))`;
    const like = `%${q}%`;
    args.push(like, like, like, like, like);
  }
  sql += ' ORDER BY t.usage_count DESC, t.id';
  const rows = db.prepare(sql).all(...args);
  const locStmt = db.prepare('SELECT lang,title,body FROM template_locales WHERE template_id=? ORDER BY lang');
  const varStmt = db.prepare('SELECT name,label_zh FROM template_vars WHERE template_id=? ORDER BY sort,id');
  const templates = rows.map((t) => {
    const locales = locStmt.all(t.id);
    const en = locales.find((l) => l.lang === 'EN');
    return {
      id: t.id, key: t.key, scene: t.scene, category: t.category,
      note_zh: t.note_zh, gloss_zh: t.gloss_zh || '', usage_count: t.usage_count, origin: t.origin,
      langs: locales.map((l) => l.lang),
      title: (en || locales[0] || {}).title || t.key,
      vars: varStmt.all(t.id),
      // 弹窗零等待：列表一次带齐各语言正文，点卡直接渲染，不再拉详情
      locales,
    };
  });
  // 同批带上落款片段：模板页所需数据一次到位
  const snippets = db.prepare('SELECT key,lang,body FROM snippets ORDER BY lang,key').all();
  res.json({ templates, snippets });
});

app.get('/api/reply-templates/:id', (req, res) => {
  const t = getTemplateFull(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  res.json(t);
});

app.post('/api/reply-templates', (req, res) => {
  const b = req.body || {};
  if (!SCENES.includes(b.scene)) return res.status(400).json({ error: '场景必须是 first/ask/quote/nudge' });
  const locales = b.locales || [];
  if (!locales.length) return res.status(400).json({ error: '至少需要一个语言版本' });
  for (const l of locales) {
    if (!LANGS.includes(l.lang)) return res.status(400).json({ error: '语言必须是 EN/ES/PT/FR/DE/AR' });
    if (!l.title || !String(l.title).trim()) return res.status(400).json({ error: `标题必填（${l.lang}）` });
    if (!l.body || !String(l.body).trim()) return res.status(400).json({ error: `正文必填（${l.lang}）` });
  }
  const t = now();
  const key = String(b.key || '').trim() || `custom-${Date.now()}`;
  const id = db.transaction(() => {
    const tid = db.prepare(
      `INSERT INTO templates (key,scene,category,status,version,note_zh,gloss_zh,source_buyer,usage_count,origin,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(key, b.scene, b.category || '通用', 'published', 1,
      String(b.note_zh || '').slice(0, 500), String(b.gloss_zh || '').slice(0, 4000),
      String(b.source_buyer || '').slice(0, 100), 0, 'custom', t, t).lastInsertRowid;
    const insL = db.prepare('INSERT INTO template_locales (template_id,lang,title,body) VALUES (?,?,?,?)');
    const insV = db.prepare(
      'INSERT INTO template_vars (template_id,name,type,required,label_zh,sample,sort) VALUES (?,?,?,?,?,?,?)'
    );
    locales.forEach((l) => insL.run(tid, l.lang, String(l.title).trim(), l.body));
    (b.vars || []).forEach((v, i) => {
      if (!v.name) return;
      insV.run(tid, v.name, ['text', 'number', 'date', 'enum'].includes(v.type) ? v.type : 'text',
        v.required ? 1 : 0, String(v.label_zh || v.name).slice(0, 20), String(v.sample || '').slice(0, 100), i);
    });
    return tid;
  })();
  res.json({ ok: true, id });
});

app.put('/api/reply-templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  const b = req.body || {};
  if (b.scene && !SCENES.includes(b.scene)) return res.status(400).json({ error: '场景必须是 first/ask/quote/nudge' });
  db.transaction(() => {
    db.prepare(
      `UPDATE templates SET scene=?, category=?, note_zh=?, gloss_zh=?, source_buyer=?, version=version+1, updated_at=? WHERE id=?`
    ).run(b.scene || t.scene, b.category || t.category,
      String(b.note_zh ?? t.note_zh).slice(0, 500), String(b.gloss_zh ?? t.gloss_zh ?? '').slice(0, 4000),
      String(b.source_buyer ?? t.source_buyer).slice(0, 100), now(), t.id);
    if (b.locales) {
      db.prepare('DELETE FROM template_locales WHERE template_id=?').run(t.id);
      const insL = db.prepare('INSERT INTO template_locales (template_id,lang,title,body) VALUES (?,?,?,?)');
      b.locales.forEach((l) => { if (LANGS.includes(l.lang)) insL.run(t.id, l.lang, String(l.title).trim(), l.body); });
    }
    if (b.vars) {
      db.prepare('DELETE FROM template_vars WHERE template_id=?').run(t.id);
      const insV = db.prepare(
        'INSERT INTO template_vars (template_id,name,type,required,label_zh,sample,sort) VALUES (?,?,?,?,?,?,?)'
      );
      b.vars.forEach((v, i) => {
        if (!v.name) return;
        insV.run(t.id, v.name, ['text', 'number', 'date', 'enum'].includes(v.type) ? v.type : 'text',
          v.required ? 1 : 0, String(v.label_zh || v.name).slice(0, 20), String(v.sample || '').slice(0, 100), i);
      });
    }
  })();
  res.json({ ok: true });
});

app.delete('/api/reply-templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  db.prepare('DELETE FROM templates WHERE id=?').run(t.id);
  res.json({ ok: true });
});

// 种子重建：清掉 origin='seed' 的模板与全部片段，按 seedTemplatesV3.js 重灌（自定义/legacy 不受影响）
app.post('/api/reply-templates/reseed', (req, res) => {
  db.transaction(() => {
    db.prepare(`DELETE FROM templates WHERE origin='seed'`).run();
    db.prepare('DELETE FROM snippets').run();
  })();
  seedV3();
  res.json({ ok: true, count: TEMPLATES.length });
});

// 渲染：多语言回退 + 片段展开 + 必填校验（红线）
app.post('/api/reply-templates/:id/render', (req, res) => {
  const t = getTemplateFull(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  const lang = LANGS.includes(req.body && req.body.lang) ? req.body.lang : 'EN';
  const slots = (req.body && req.body.slots) || {};
  const { locale, fallback } = pickLocale(t, lang);
  if (!locale) return res.status(400).json({ error: '该模板没有任何语言版本' });
  const missing = (t.vars || [])
    .filter((v) => v.required && !String(slots[v.name] || '').trim())
    .map((v) => v.label_zh || v.name);
  if (missing.length) {
    return res.status(400).json({ error: `红线：${missing.join('、')}不能为空，请填写后再复制发出`, missing });
  }
  const text = renderBody(expandSnippets(locale.body, locale.lang), slots);
  res.json({ ok: true, text, lang_used: locale.lang, fallback });
});

// 使用统计：复制成功后调用
app.post('/api/reply-templates/:id/use', (req, res) => {
  const t = db.prepare('SELECT * FROM templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  db.prepare('UPDATE templates SET usage_count=usage_count+1 WHERE id=?').run(t.id);
  res.json({ ok: true, usage_count: t.usage_count + 1 });
});

// ---------- snippets（共享片段） ----------
app.get('/api/snippets', (req, res) => {
  res.json(db.prepare('SELECT * FROM snippets ORDER BY key, lang').all());
});
app.post('/api/snippets', (req, res) => {
  const b = req.body || {};
  if (!b.key || !String(b.key).trim()) return res.status(400).json({ error: 'key 必填' });
  if (!LANGS.includes(b.lang)) return res.status(400).json({ error: '语言必须是 EN/ES/PT/FR/DE/AR' });
  if (!b.body || !String(b.body).trim()) return res.status(400).json({ error: '正文必填' });
  try {
    const r = db.prepare('INSERT INTO snippets (key,lang,title_zh,body) VALUES (?,?,?,?)')
      .run(String(b.key).trim(), b.lang, String(b.title_zh || '').slice(0, 50), b.body);
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch {
    return res.status(400).json({ error: '该 key+语言已存在' });
  }
});
app.put('/api/snippets/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM snippets WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '片段不存在' });
  const b = req.body || {};
  db.prepare('UPDATE snippets SET title_zh=?, body=? WHERE id=?')
    .run(String(b.title_zh ?? s.title_zh).slice(0, 50), b.body ?? s.body, s.id);
  res.json({ ok: true });
});
app.delete('/api/snippets/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM snippets WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '片段不存在' });
  db.prepare('DELETE FROM snippets WHERE id=?').run(s.id);
  res.json({ ok: true });
});

// ---------- static ----------
app.use(express.static(path.join(__dirname, '..', '..', 'client')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`[garment-mgmt] listening on :${PORT}`));
