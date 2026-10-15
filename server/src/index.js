import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { now, DATA_DIR } from './db.js';
import { nextStyleNo, canTransition, STATUS_LABEL, CATEGORIES, SEASONS } from './styleNo.js';
import { SNIPPETS, TEMPLATES } from './seedTemplatesV4.js';
import { applyTagRules } from './seedTagRules.js';
const LANGS = ['EN', 'ES', 'PT', 'FR', 'DE', 'AR'];
const SCENES = ['first', 'ask', 'quote', 'nudge'];

seedV4();
// 中文落款片段：阿里内置翻译流用（粘中文，平台自动翻译）；老库启动时补齐（seedV3 只在空库跑）
db.prepare(`INSERT OR IGNORE INTO snippets (key,lang,title_zh,body) VALUES ('signature','ZH','落款-中文','祝好，\nYingzi')`).run();

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
  version: '0.10.9',
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

function seedV4() {
  const row = db.prepare(`SELECT value FROM app_config WHERE key='seed_version'`).get();
  if (row && row.value === 'v4') {
    // 已是 v4：回填空 gloss_zh（兼容），不重灌
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
    return;
  }
  // v0.9.0：话术库 v2.1 全量替换 —— 只动 origin='seed' 的模板与 snippets，
  // 自定义（custom）/legacy 模板、款档案/样衣/报价等业务表不受影响
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
    db.prepare(`DELETE FROM templates WHERE origin='seed'`).run();
    db.prepare('DELETE FROM snippets').run();
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
    db.prepare(`INSERT OR REPLACE INTO app_config (key,value,updated_at) VALUES ('seed_version','v4',?)`).run(t);
  })();
  console.log(`[seed] v4 话术库 v2.1 全量重灌：${TEMPLATES.length} 个模板 / ${SNIPPETS.length} 个共享片段`);
}
// v0.10.2：种子模板批量打标（v4 之后跑，只打 origin=seed，不覆盖人工）
{
  const tv = db.prepare(`SELECT value FROM app_config WHERE key='tag_rules_version'`).get();
  if (!tv || tv.value !== 'v1') {
    const n = applyTagRules(db);
    db.prepare(`INSERT OR REPLACE INTO app_config (key,value,updated_at) VALUES ('tag_rules_version','v1',?)`)
      .run(new Date().toISOString());
    console.log(`[seed] 批量打标：${n} 条模板`);
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
  const { q = '', scene = '', tag = '' } = req.query;
  const args = [];
  let sql = 'SELECT t.* FROM templates t WHERE 1=1';
  if (scene) { sql += ' AND t.scene=?'; args.push(scene); }
  if (tag) {
    sql += ` AND EXISTS (SELECT 1 FROM template_tags tt JOIN tags g ON g.id=tt.tag_id
      WHERE tt.template_id=t.id AND g.name=?)`;
    args.push(tag);
  }
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
  const tagStmt = db.prepare(
    `SELECT g.id,g.grp,g.name FROM template_tags tt JOIN tags g ON g.id=tt.tag_id
     WHERE tt.template_id=? ORDER BY g.sort,g.id`);
  const templates = rows.map((t) => {
    const locales = locStmt.all(t.id);
    const en = locales.find((l) => l.lang === 'EN');
    return {
      id: t.id, key: t.key, scene: t.scene, category: t.category,
      note_zh: t.note_zh, gloss_zh: t.gloss_zh || '', usage_count: t.usage_count, origin: t.origin,
      langs: locales.map((l) => l.lang),
      title: (en || locales[0] || {}).title || t.key,
      vars: varStmt.all(t.id),
      tags: tagStmt.all(t.id),
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
  if (!locales.length) {
    // 中文流：只传中文话术时自动生成占位语言版本（库表仍要求至少一个 locale，外语数据不再编辑）
    if (!b.gloss_zh || !String(b.gloss_zh).trim()) return res.status(400).json({ error: '中文话术必填' });
    locales.push({ lang: 'EN', title: String(b.note_zh || b.key || '模板').trim() || '模板', body: b.gloss_zh });
  }
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
  seedV4();
  res.json({ ok: true, count: TEMPLATES.length });
});

// 渲染：多语言回退 + 片段展开 + 必填校验（红线）
app.post('/api/reply-templates/:id/render', (req, res) => {
  const t = getTemplateFull(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  const rawLang = req.body && req.body.lang;
  const slots = (req.body && req.body.slots) || {};
  // 中文渲染：用中文对照 gloss_zh（阿里内置翻译流：粘中文，平台自动翻译）
  let body, langUsed, fallback;
  if (rawLang === 'ZH') {
    if (!t.gloss_zh) return res.status(400).json({ error: '该模板没有中文对照，请到编辑页补充' });
    body = t.gloss_zh; langUsed = 'ZH'; fallback = false;
  } else {
    const lang = LANGS.includes(rawLang) ? rawLang : 'EN';
    const picked = pickLocale(t, lang);
    if (!picked.locale) return res.status(400).json({ error: '该模板没有任何语言版本' });
    body = picked.locale.body; langUsed = picked.locale.lang; fallback = picked.fallback;
  }
  const missing = (t.vars || [])
    .filter((v) => v.required && !String(slots[v.name] || '').trim())
    .map((v) => v.label_zh || v.name);
  if (missing.length) {
    return res.status(400).json({ error: `红线：${missing.join('、')}不能为空，请填写后再复制发出`, missing });
  }
  const text = renderBody(expandSnippets(body, langUsed), slots);
  res.json({ ok: true, text, lang_used: langUsed, fallback });
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

// ---------- tags（受控词表/打标，任务 3） ----------
// 打标只能选表内词：PUT /api/reply-templates/:id/tags 会校验 id 合法性，词表外写不进
const TAG_GROUPS = ['款式', '轮廓', '领型', '袖型', '元素', '面料属性', '颜色', '话题'];
app.get('/api/tags', (req, res) => {
  const tags = db.prepare('SELECT id,grp,name,sort FROM tags ORDER BY sort,id').all();
  const used = db.prepare('SELECT tag_id, COUNT(*) c FROM template_tags GROUP BY tag_id').all();
  const usedMap = new Map(used.map((u) => [u.tag_id, u.c]));
  res.json(tags.map((t) => ({ ...t, used: usedMap.get(t.id) || 0 })));
});
app.post('/api/tags', (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const grp = String(b.grp || '').trim();
  if (!name) return res.status(400).json({ error: '标签名必填' });
  if (!TAG_GROUPS.includes(grp)) return res.status(400).json({ error: '分组必须是：' + TAG_GROUPS.join('、') });
  try {
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort),-1) m FROM tags').get().m;
    const r = db.prepare('INSERT INTO tags (grp,name,sort) VALUES (?,?,?)').run(grp, name, maxSort + 1);
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch {
    return res.status(400).json({ error: '该标签名已存在' });
  }
});
app.put('/api/tags/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM tags WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '标签不存在' });
  const name = String((req.body || {}).name || '').trim();
  if (!name) return res.status(400).json({ error: '标签名必填' });
  try {
    db.prepare('UPDATE tags SET name=? WHERE id=?').run(name, t.id);
    res.json({ ok: true });
  } catch {
    return res.status(400).json({ error: '该标签名已存在' });
  }
});
app.delete('/api/tags/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM tags WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '标签不存在' });
  db.prepare('DELETE FROM tags WHERE id=?').run(t.id); // 关联经外键级联清除
  res.json({ ok: true });
});
app.post('/api/tags/merge', (req, res) => {
  const b = req.body || {};
  const from = db.prepare('SELECT * FROM tags WHERE id=?').get(b.from_id);
  const to = db.prepare('SELECT * FROM tags WHERE id=?').get(b.to_id);
  if (!from || !to) return res.status(404).json({ error: '标签不存在' });
  if (from.id === to.id) return res.status(400).json({ error: '不能合并到自己' });
  db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO template_tags (template_id,tag_id)
      SELECT template_id, ? FROM template_tags WHERE tag_id=?`).run(to.id, from.id);
    db.prepare('DELETE FROM tags WHERE id=?').run(from.id);
  })();
  res.json({ ok: true });
});
// 模板打标：整组替换，只接受 tags 表内 id
app.get('/api/reply-templates/:id/tags', (req, res) => {
  const t = db.prepare('SELECT id FROM templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  const rows = db.prepare(
    `SELECT g.id,g.grp,g.name FROM template_tags tt JOIN tags g ON g.id=tt.tag_id
     WHERE tt.template_id=? ORDER BY g.sort,g.id`).all(t.id);
  res.json(rows);
});
app.put('/api/reply-templates/:id/tags', (req, res) => {
  const t = db.prepare('SELECT id FROM templates WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '模板不存在' });
  const ids = [...new Set((req.body && req.body.tag_ids) || [])].map(Number).filter((n) => n > 0);
  if (ids.length) {
    const ok = db.prepare(`SELECT COUNT(*) c FROM tags WHERE id IN (${ids.map(() => '?').join(',')})`).get(...ids).c;
    if (ok !== ids.length) return res.status(400).json({ error: '含词表外的标签 id，拒绝写入' });
  }
  const ins = db.prepare('INSERT OR IGNORE INTO template_tags (template_id,tag_id) VALUES (?,?)');
  db.transaction(() => {
    db.prepare('DELETE FROM template_tags WHERE template_id=?').run(t.id);
    for (const id of ids) ins.run(t.id, id);
  })();
  res.json({ ok: true, count: ids.length });
});

// ---------- admin 配置 & AI 话术助手（v0.8.0） ----------
// v0.10.3：模型不再硬编码——管理后台从 /models 拉取列表，下拉框选择；
// 后台模型（backend_model）专供 LLM 理解层用，可选便宜快的模型。
const ADMIN_DEFAULTS = {
  base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  chat_model: '',
  backend_model: '',
  embedding_model: '',
  vision_model: '',
  api_key: '',
};
function getAdminConfig(includeKey = false) {
  const rows = db.prepare('SELECT key, value FROM app_config').all();
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const cfg = {
    base_url: m.base_url || ADMIN_DEFAULTS.base_url,
    chat_model: m.chat_model || '',
    backend_model: m.backend_model || '',
    embedding_model: m.embedding_model || '',
    vision_model: m.vision_model || '',
  };
  if (includeKey) cfg.api_key = m.api_key || '';
  return cfg;
}
function adminHasKey() {
  const r = db.prepare("SELECT value FROM app_config WHERE key='api_key'").get();
  return !!(r && String(r.value).trim());
}

// 管理配置：Key 永不返回明文，只返回是否已设置
app.get('/api/admin/config', (req, res) => {
  res.json({ ...getAdminConfig(false), has_key: adminHasKey() });
});
app.put('/api/admin/config', (req, res) => {
  const b = req.body || {};
  const up = db.prepare(
    'INSERT INTO app_config (key, value, updated_at) VALUES (?,?,?) ' +
    'ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at'
  );
  const t = now();
  for (const k of ['base_url', 'chat_model', 'backend_model', 'embedding_model', 'vision_model']) {
    if (b[k] !== undefined) up.run(k, String(b[k]).slice(0, 500), t);
  }
  // api_key 为空时不覆盖旧值
  if (b.api_key !== undefined && String(b.api_key).trim() !== '') {
    up.run('api_key', String(b.api_key).trim(), t);
  }
  res.json({ ok: true, ...getAdminConfig(false), has_key: adminHasKey() });
});
// 拉取可用模型列表（不硬编码）：GET {base_url}/models
app.get('/api/admin/models', async (req, res) => {
  const cfg = getAdminConfig(true);
  if (!cfg.api_key) return res.status(400).json({ error: '未配置 API Key' });
  try {
    const url = cfg.base_url.replace(/\/+$/, '') + '/models';
    const r = await fetch(url, {
      headers: { 'Authorization': `Bearer ${cfg.api_key}` },
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `模型服务返回 ${r.status}`);
    const models = (d.data || []).map((m) => m.id).filter(Boolean).sort();
    res.json({ models });
  } catch (e) {
    res.status(500).json({ error: `拉取模型列表失败：${e.message || e}` });
  }
});
// 连通性测试：用选定的聊天模型发一条最小请求
app.post('/api/admin/test', async (req, res) => {
  const cfg = getAdminConfig(true);
  if (!cfg.api_key) return res.status(400).json({ error: '未配置 API Key' });
  const model = (req.body && req.body.model) || cfg.chat_model;
  if (!model) return res.status(400).json({ error: '未选择模型' });
  try {
    const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        enable_thinking: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `模型服务返回 ${r.status}`);
    const reply = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    res.json({ ok: true, model, reply: reply.slice(0, 100) });
  } catch (e) {
    res.status(500).json({ error: `连通性测试失败：${e.message || e}` });
  }
});

// AI 检索：关键词 LIKE（gloss_zh/note_zh/key/category/语言变体）
// v0.9.0：92 条模板下，原"OR 泛洪 + 任意取 8"Top-8 召回仅 30%（黄金集实测）。
// 改为停用词过滤 + 按命中 token 数计分排序，黄金集 Top-8 召回 100%。
// 预留：标签过滤（0.3）与向量检索（0.4b）接入点
const AI_STOP = new Set(('what is the a an and or to of in on for you your yours i it its are do does did can could would should shall will please hi hello hey thanks thank thankyou bonjour salut hola ola salam quoi comment combien pour avec dans les des une un uno el la los las der die das und ist ich ich bin ein eine den dem ein en et det de da quoi 什么 怎么 如何 多少 吗 呢 的 了 是 有 在 和 与 或 个 这 那 我 你 您 他 她 它 们').split(' '));
// v0.10.1: 意图路由最小版（任务22）——价格意图加权 quote 场景
// 背景："礼服多少钱"类中文问价，2-gram 切分后候选全是 1 分平局，LLM 盲选答非所问。
// 规则先行：检出价格意图 → quote 场景模板 +100 加权，打破平局。
const PRICE_KWS = ['多少钱','价格','报价','费用','how much','price','prices','pricing','cost','costs',
  'combien','prix','tarif','cuánto','cuanto','precio','preço','quanto','custa',
  'كم','السعر','سعر','الثمن','بكم',
  'сколько','цена','стоимость',
  'wie viel','preis','kosten'];
function hasPriceIntent(msg) {
  const low = String(msg).toLowerCase();
  return PRICE_KWS.some((k) => low.includes(k.toLowerCase()));
}
// v0.10.2: LLM 理解层（用户要求：后台模型处理关键词自动分流，替代 2-gram 切片）
// 流程：llmUnderstand(意图/产品标签/关键词/语言) → smartRetrieve(标签+场景+关键词精准检索) → llmSelect(选模板+抽slot)
const TAG_VOCAB = {
  '款式': ['西装','燕尾服','晚礼服','婚纱','伴娘裙','派对礼服','伴郎团西装','单排扣西装','双排扣西装','两件套','三件套','西装马甲'],
  '轮廓': ['鱼尾','A字','直筒','百褶','蓬蓬'],
  '领型': ['抹胸','V领','一字肩','单肩','挂脖','方领','戗驳领','青果领','平驳领'],
  '袖型': ['长袖','短袖','无袖','细肩带'],
  '元素': ['钉珠','刺绣','亮片','蕾丝贴花','珍珠','3D花朵','缎面翻领','缎面纽扣','裤侧缎条','格纹'],
  '面料属性': ['缎面','金属缎','蕾丝','网纱','雪纺','丝绒','绉布','羊毛混纺','真丝','粘纤','聚酯纤维','高支羊毛'],
  '颜色': ['藏青','黑色','白色','灰色','酒红','鼠尾草绿','祖母绿','粉色'],
};
const INTENT_SCENE = { '问价': 'quote', '打招呼': 'first', '跟进': 'nudge' };
async function llmUnderstand(message, cfg) {
  const model = cfg.backend_model || cfg.chat_model;
  if (!model) throw new Error('未配置后台模型');
  const vocabStr = Object.entries(TAG_VOCAB).map(([g, ws]) => `${g}：${ws.join('、')}`).join('\n');
  const sys = '你是询盘理解助手。分析买家消息，只输出 JSON，不要输出其他文字。\n' +
    '格式：{"intent":"问价|问MOQ|问样品|问交期|问运费|问定制|问产品|打招呼|跟进|其他",' +
    '"product_tags":["从下面产品词表中选1-3个最相关的词，只选产品词（款式/轮廓/领型/袖型/元素/面料属性/颜色），不要选话题词"],' +
    '"keywords":["从消息原文提取1-4个关键词，保留原文语言"],' +
    '"lang":"EN|FR|ES|PT|AR|RU|DE|ZH|其他"}' +
    '\n产品词表：\n' + vocabStr;
  const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: message }],
      temperature: 0.1,
      max_tokens: 300,
      enable_thinking: false,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || `模型服务返回 ${r.status}`);
  const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '{}';
  const u = JSON.parse(text);
  // 清洗：product_tags 只保留词表内的词
  const allTags = new Set(Object.values(TAG_VOCAB).flat());
  return {
    intent: String(u.intent || '其他'),
    product_tags: [...new Set(u.product_tags || [])].filter((t) => allTags.has(t)).slice(0, 3),
    keywords: [...new Set(u.keywords || [])].map(String).filter((k) => k.length >= 2).slice(0, 4),
    lang: String(u.lang || '其他'),
  };
}
// 精准检索：意图→场景过滤 + 产品标签加权 + LLM关键词 LIKE（不再用 2-gram 切片）
function smartRetrieve(under, message) {
  const tagIds = under.product_tags.length
    ? db.prepare(`SELECT id FROM tags WHERE name IN (${under.product_tags.map(() => '?').join(',')})`).all(...under.product_tags).map((r) => r.id)
    : [];
  const kws = under.keywords.length ? under.keywords : [message.slice(0, 20)];
  const scored = new Map();
  const stmt = db.prepare(
    `SELECT t.id FROM templates t WHERE t.key LIKE ? OR t.note_zh LIKE ? OR t.gloss_zh LIKE ?
     OR EXISTS (SELECT 1 FROM template_locales l WHERE l.template_id=t.id AND (l.title LIKE ? OR l.body LIKE ?))`
  );
  for (const kw of kws) {
    const like = `%${kw}%`;
    for (const r of stmt.all(like, like, like, like, like)) {
      scored.set(r.id, (scored.get(r.id) || 0) + 10);
    }
  }
  // 产品标签：命中一个 +30
  if (tagIds.length) {
    const tstmt = db.prepare(`SELECT template_id FROM template_tags WHERE tag_id IN (${tagIds.map(() => '?').join(',')})`);
    for (const r of tstmt.all(...tagIds)) {
      scored.set(r.template_id, (scored.get(r.template_id) || 0) + 30);
    }
  }
  // 意图→场景：命中 +50
  const scene = INTENT_SCENE[under.intent];
  if (scene) {
    const sstmt = db.prepare('SELECT id FROM templates WHERE scene=?');
    for (const r of sstmt.all(scene)) {
      if (scored.has(r.id)) scored.set(r.id, scored.get(r.id) + 50);
    }
  }
  // 价格意图兜底（规则先行，LLM 没检出时）：quote +100
  if (!scene && hasPriceIntent(message)) {
    const qstmt = db.prepare("SELECT id FROM templates WHERE scene='quote'");
    for (const r of qstmt.all()) {
      if (scored.has(r.id)) scored.set(r.id, scored.get(r.id) + 100);
    }
  }
  const topIds = [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0]);
  if (!topIds.length) return [];
  const rows = db.prepare(`SELECT * FROM templates WHERE id IN (${topIds.map(() => '?').join(',')})`).all(...topIds);
  const rank = new Map(topIds.map((id, i) => [id, i]));
  rows.sort((a, b) => rank.get(a.id) - rank.get(b.id));
  const varStmt = db.prepare('SELECT name,type,required,label_zh FROM template_vars WHERE template_id=? ORDER BY sort,id');
  const scoreMap = new Map(scored);
  return rows.map((t) => ({
    id: t.id, key: t.key, scene: t.scene, note_zh: t.note_zh, gloss_zh: t.gloss_zh || '',
    vars: varStmt.all(t.id),
    score: scoreMap.get(t.id) || 0,
  }));
}
function aiRetrieve(message) {
  const runs = String(message).match(/[\p{L}\p{N}]{2,}/gu) || [];
  const toks = new Set();
  for (const r of runs) {
    toks.add(r);
    // 中文无分词：长词加 2-gram 兜底，提高 LIKE 召回
    if (/[一-鿿]/.test(r) && r.length > 4) {
      for (let i = 0; i + 2 <= r.length; i++) toks.add(r.slice(i, i + 2));
    }
  }
  let tokens = [...toks].filter((t) => t.length >= 2 && !AI_STOP.has(t.toLowerCase())).slice(0, 24);
  if (!tokens.length) tokens = [...toks].slice(0, 8); // 全是停用词（如只有 hello）时回退
  if (!tokens.length) return [];
  const scored = new Map(); // template_id -> 命中 token 数
  const stmt = db.prepare(
    `SELECT t.id FROM templates t WHERE t.key LIKE ? OR t.note_zh LIKE ? OR t.gloss_zh LIKE ?
     OR t.category LIKE ? OR EXISTS (SELECT 1 FROM template_locales l WHERE l.template_id=t.id AND (l.title LIKE ? OR l.body LIKE ?))`
  );
  for (const tk of tokens) {
    const like = `%${tk}%`;
    for (const r of stmt.all(like, like, like, like, like, like)) {
      scored.set(r.id, (scored.get(r.id) || 0) + 1);
    }
  }
  const topIds = [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0]);
  if (!topIds.length) return [];
  // 价格意图：quote 场景加权，打破"全是 1 分"的平局
  const priceIntent = hasPriceIntent(message);
  if (priceIntent) {
    const sceneOf = db.prepare('SELECT scene FROM templates WHERE id=?');
    const boosted = [...scored.entries()]
      .map(([id, s]) => [id, s + (sceneOf.get(id).scene === 'quote' ? 100 : 0)])
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0]);
    topIds.length = 0; topIds.push(...boosted);
  }
  const rows = db.prepare(`SELECT * FROM templates WHERE id IN (${topIds.map(() => '?').join(',')})`).all(...topIds);
  const rank = new Map(topIds.map((id, i) => [id, i]));
  rows.sort((a, b) => rank.get(a.id) - rank.get(b.id));
  return rows.map((t) => ({
    id: t.id, key: t.key, scene: t.scene, note_zh: t.note_zh, gloss_zh: t.gloss_zh || '',
    vars: db.prepare('SELECT name,type,required,label_zh FROM template_vars WHERE template_id=? ORDER BY sort,id').all(t.id),
  }));
}

const aiNorm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

// 代码护栏：template_id 必须在候选里；slot 值必须是消息原文子串；price/lead_time 缺失 → 置空
function aiGuardrails(tpl, llmSlots, message) {
  const msgNorm = aiNorm(message);
  const slots = {};
  for (const v of tpl.vars || []) {
    let val = (llmSlots && llmSlots[v.name] != null) ? String(llmSlots[v.name]).trim() : '';
    if (val && !msgNorm.includes(aiNorm(val))) val = ''; // 不是原文子串 → 置空
    slots[v.name] = val;
  }
  const missing = (tpl.vars || [])
    .filter((v) => v.required && !String(slots[v.name] || '').trim())
    .map((v) => v.label_zh || v.name);
  return { slots, missing };
}

app.post('/api/ai/assist', async (req, res) => {
  const cfg = getAdminConfig(true);
  if (!cfg.api_key) return res.status(400).json({ error: '未配置模型服务' });
  const message = String((req.body && req.body.message) || '').trim();
  if (!message) return res.status(400).json({ error: '消息不能为空' });
  if (message.length > 2000) return res.status(400).json({ error: '消息过长（最多 2000 字）' });

  // v0.10.2 新管线：LLM 理解（意图/标签/关键词）→ 精准检索；失败时回退旧检索
  let candidates;
  let under = null;
  try {
    under = await llmUnderstand(message, cfg);
    candidates = smartRetrieve(under, message);
  } catch (e) {
    candidates = [];
  }
  if (!candidates.length) candidates = aiRetrieve(message);
  if (!candidates.length) return res.status(404).json({ error: '话术库中没有匹配的模板' });

  // 短路优化：Top-1 分数断层领先且无变量可填时，直接采用，跳过 LLM 选中（省一次模型调用）
  const top1 = candidates[0];
  const top2score = candidates.length > 1 ? (candidates[1].score || 0) : 0;
  if ((top1.score || 0) - top2score >= 30 && (!top1.vars || !top1.vars.length)) {
    return finishAssist(res, top1.id, {}, message, cfg, candidates);
  }

  const sys = '你是话术库助手。从候选模板中选最匹配的一条，输出 JSON {template_id, slots:{name:value}}。' +
    (under && under.intent ? `买家意图：${under.intent}。` : '') +
    (hasPriceIntent(message) ? '买家在问价，优先选报价类模板。' : '') +
    'slot 值只能从用户消息原文提取；价格、交期若消息中没有必须留空，绝不编造。不输出其他文字。';
  const userContent = '候选模板：\n' + candidates.map((c) =>
    `- id:${c.id} key:${c.key} 场景句:${c.note_zh} 变量:${c.vars.map((v) => v.name).join(',') || '无'}`
  ).join('\n') + `\n买家消息：${message}`;

  let llm;
  try {
    const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
      body: JSON.stringify({
        model: cfg.chat_model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userContent }],
        temperature: 0.2,
        max_tokens: 300,
        enable_thinking: false,
      }),
      signal: AbortSignal.timeout(45000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || d.message || `模型服务返回 ${r.status}`);
    const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    llm = JSON.parse(text);
  } catch (e) {
    const cause = e.cause ? ` (cause: ${e.cause.message || e.cause.code || e.cause})` : '';
    return res.status(500).json({ error: `AI 调用失败：${e.message || e}${cause}` });
  }

  const templateId = Number(llm && llm.template_id);
  return finishAssist(res, templateId, (llm && llm.slots) || {}, message, cfg, candidates);
});

// 短路/正常流程共用的收尾：护栏检查 + 渲染 + 返回
function finishAssist(res, templateId, rawSlots, message, cfg, candidates) {
  const tpl = candidates.find((c) => c.id === Number(templateId));
  if (!tpl) return res.status(500).json({ error: 'AI 返回了候选之外的模板，请重试' });

  const { slots, missing } = aiGuardrails(tpl, rawSlots, message);
  // 中文渲染：同 :id/render 的 ZH 逻辑（gloss_zh + 落款片段展开）
  const full = getTemplateFull(tpl.id);
  const filled_text = renderBody(expandSnippets(full.gloss_zh || '', 'ZH'), slots);
  res.json({
    ok: true, template_id: tpl.id, template_key: tpl.key, note_zh: tpl.note_zh,
    filled_text, slots, missing,
  });
}

// ---------- static ----------
app.use(express.static(path.join(__dirname, '..', '..', 'client')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`[garment-mgmt] listening on :${PORT}`));
