import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { now, DATA_DIR } from './db.js';
import { nextStyleNo, canTransition, STATUS_LABEL, CATEGORIES, SEASONS } from './styleNo.js';
import { seedReplyTemplates, SEED_TEMPLATES, LANGS, SCENES } from './seedTemplates.js';

const seeded = seedReplyTemplates();
if (seeded) console.log(`[garment-mgmt] seeded ${seeded} reply templates`);

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
  version: '0.2.1',
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

// ---------- reply-templates（回复模板库 v0.2.0） ----------
// 红线：价格/交期绝不能编造 —— render 时 {{price}} / {{lead_time}} 为空直接 400
function renderTpl(body, slots = {}) {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) =>
    slots[k] !== undefined && slots[k] !== null ? String(slots[k]) : '');
}
function checkRequired(body, slots = {}) {
  const missing = [];
  if (body.includes('{{price}}') && !String(slots.price || '').trim()) missing.push('价格');
  if (body.includes('{{lead_time}}') && !String(slots.lead_time || '').trim()) missing.push('交期');
  return missing;
}

app.get('/api/reply-templates', (req, res) => {
  const { lang = '', scene = '' } = req.query;
  let sql = 'SELECT * FROM reply_templates WHERE 1=1';
  const args = [];
  if (lang) { sql += ' AND lang=?'; args.push(lang); }
  if (scene) { sql += ' AND scene=?'; args.push(scene); }
  sql += ' ORDER BY lang, scene, id';
  res.json(db.prepare(sql).all(...args));
});

app.get('/api/reply-templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM reply_templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  res.json(t);
});

app.post('/api/reply-templates', (req, res) => {
  const { lang, scene, title, body, note_zh = '', source_buyer = '' } = req.body || {};
  if (!LANGS.includes(lang)) return res.status(400).json({ error: '语言必须是 EN/ES/PT/FR/DE/AR' });
  if (!SCENES.includes(scene)) return res.status(400).json({ error: '场景必须是 first/ask/quote/nudge' });
  if (!title || !String(title).trim()) return res.status(400).json({ error: '标题必填' });
  if (!body || !String(body).trim()) return res.status(400).json({ error: '正文必填' });
  const t = now();
  const r = db.prepare(
    `INSERT INTO reply_templates (lang,scene,title,body,note_zh,source_buyer,is_seed,created_at,updated_at)
     VALUES (?,?,?,?,?,?,0,?,?)`
  ).run(lang, scene, String(title).trim(), body, String(note_zh).slice(0, 500),
    String(source_buyer).slice(0, 100), t, t);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put('/api/reply-templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM reply_templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  const b = req.body || {};
  if (b.lang && !LANGS.includes(b.lang)) return res.status(400).json({ error: '语言必须是 EN/ES/PT/FR/DE/AR' });
  if (b.scene && !SCENES.includes(b.scene)) return res.status(400).json({ error: '场景必须是 first/ask/quote/nudge' });
  db.prepare(
    `UPDATE reply_templates SET lang=?, scene=?, title=?, body=?, note_zh=?, source_buyer=?, updated_at=? WHERE id=?`
  ).run(
    b.lang || t.lang, b.scene || t.scene,
    String(b.title ?? t.title).trim() || t.title, b.body ?? t.body,
    String(b.note_zh ?? t.note_zh).slice(0, 500), String(b.source_buyer ?? t.source_buyer).slice(0, 100),
    now(), t.id
  );
  res.json({ ok: true });
});

app.delete('/api/reply-templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM reply_templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  db.prepare('DELETE FROM reply_templates WHERE id=?').run(t.id);
  res.json({ ok: true });
});

// 种子重建：先清掉所有种子模板，再按 seedTemplates.js 重新灌入（自定义模板不受影响）
app.post('/api/reply-templates/reseed', (req, res) => {
  const t = now();
  db.transaction(() => {
    db.prepare('DELETE FROM reply_templates WHERE is_seed=1').run();
    const ins = db.prepare(
      `INSERT INTO reply_templates (lang,scene,title,body,note_zh,source_buyer,is_seed,created_at,updated_at)
       VALUES (?,?,?,?,?,?,1,?,?)`
    );
    for (const s of SEED_TEMPLATES) {
      ins.run(s.lang, s.scene, s.title, s.body, s.note_zh || '', s.source_buyer || '', t, t);
    }
  })();
  res.json({ ok: true, count: SEED_TEMPLATES.length });
});

app.post('/api/reply-templates/:id/render', (req, res) => {
  const t = db.prepare('SELECT * FROM reply_templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  const slots = (req.body && req.body.slots) || {};
  const missing = checkRequired(t.body, slots);
  if (missing.length) {
    return res.status(400).json({ error: `红线：${missing.join('、')}不能为空，请填写后再复制发出` });
  }
  res.json({ ok: true, text: renderTpl(t.body, slots) });
});

// ---------- static ----------
app.use(express.static(path.join(__dirname, '..', '..', 'client')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`[garment-mgmt] listening on :${PORT}`));
