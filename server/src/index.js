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
// 任务29: AI 接口限流（防刷 API 额度）
const aiRate = new Map(); // ip -> [timestamps]
function aiRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const win = aiRate.get(ip) || [];
  const recent = win.filter((t) => now - t < 60000);
  if (recent.length >= 10) return res.status(429).json({ error: '请求太频繁，请稍后再试' });
  recent.push(now);
  aiRate.set(ip, recent);
  next();
}
// message 长度校验
function aiMsgCheck(req, res, next) {
  const msg = (req.body && req.body.message) || '';
  if (msg.length > 2000) return res.status(400).json({ error: '消息太长（最多2000字）' });
  next();
}

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
  version: '0.10.24',
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
  // v6 迁移：清理 note_zh 旧编号（v5 已做 key 重命名，此步可独立跑）
  if (row && (row.value === 'v5' || row.value === 'v4')) {
    const t6 = now();
    const nrows = db.prepare(`SELECT id, note_zh FROM templates WHERE origin='seed' AND note_zh LIKE 'v2.1 #%'`).all();
    const nupd = db.prepare(`UPDATE templates SET note_zh=?, updated_at=? WHERE id=?`);
    let nc = 0;
    db.transaction(() => {
      for (const r of nrows) {
        const clean = r.note_zh.replace(/^v2\.1 #\d+(=\d+)?\s*[｜|]\s*/, '');
        if (clean !== r.note_zh) { nupd.run(clean, t6, r.id); nc++; }
      }
      db.prepare(`UPDATE app_config SET value='v6' WHERE key='seed_version'`).run();
    })();
    console.log(`[seed] v5→v6 note_zh清理：${nc} 条`);
    if (row.value === 'v5') return;
  }
  // v5 迁移：模板 key 重命名（v21-xxx → SCENE-xxx），UPDATE 保 ID，标签关联不受影响
  if (row && row.value === 'v4') {
    const KEYMAP = {
  'v21-001': 'ASK-001',
  'v21-002': 'ASK-002',
  'v21-003': 'ASK-003',
  'v21-004': 'ASK-004',
  'v21-005': 'ASK-005',
  'v21-006': 'ASK-006',
  'v21-007': 'ASK-007',
  'v21-008': 'ASK-008',
  'v21-009': 'ASK-009',
  'v21-010': 'ASK-010',
  'v21-011': 'ASK-011',
  'v21-012': 'QUOTE-001',
  'v21-013': 'QUOTE-002',
  'v21-014': 'QUOTE-003',
  'v21-015': 'QUOTE-004',
  'v21-016': 'QUOTE-005',
  'v21-017': 'QUOTE-006',
  'v21-018': 'QUOTE-007',
  'v21-019': 'QUOTE-008',
  'v21-020': 'QUOTE-009',
  'v21-021': 'QUOTE-010',
  'v21-022': 'QUOTE-011',
  'v21-023': 'QUOTE-012',
  'v21-024': 'QUOTE-013',
  'v21-025': 'QUOTE-014',
  'v21-026': 'ASK-012',
  'v21-027': 'ASK-013',
  'v21-028': 'ASK-014',
  'v21-029': 'ASK-015',
  'v21-030': 'ASK-016',
  'v21-031': 'ASK-017',
  'v21-032': 'ASK-018',
  'v21-033': 'ASK-019',
  'v21-034': 'ASK-020',
  'v21-035': 'ASK-021',
  'v21-036': 'ASK-022',
  'v21-037': 'ASK-023',
  'v21-038': 'ASK-024',
  'v21-039': 'ASK-025',
  'v21-040': 'ASK-026',
  'v21-041': 'ASK-027',
  'v21-042': 'ASK-028',
  'v21-043': 'ASK-029',
  'v21-044': 'ASK-030',
  'v21-045': 'ASK-031',
  'v21-046': 'ASK-032',
  'v21-047': 'ASK-033',
  'v21-048': 'ASK-034',
  'v21-049': 'ASK-035',
  'v21-050': 'ASK-036',
  'v21-051': 'ASK-037',
  'v21-052': 'ASK-038',
  'v21-053': 'ASK-039',
  'v21-054': 'ASK-040',
  'v21-055': 'ASK-041',
  'v21-056': 'ASK-042',
  'v21-057': 'ASK-043',
  'v21-058': 'ASK-044',
  'v21-059': 'ASK-045',
  'v21-060': 'ASK-046',
  'v21-061': 'ASK-047',
  'v21-062': 'ASK-048',
  'v21-063': 'FIRST-001',
  'v21-064': 'FIRST-002',
  'v21-065': 'FIRST-003',
  'v21-066': 'FIRST-004',
  'v21-067': 'FIRST-005',
  'v21-068': 'FIRST-006',
  'v21-069': 'FIRST-007',
  'v21-070': 'FIRST-008',
  'nudge-3step': 'NUDGE-001',
  'first-design-4q': 'FIRST-009',
  'ask-sample-4q': 'ASK-049',
  'quote-multi-sample': 'QUOTE-015',
  'ask-change-fabric': 'ASK-050',
  'ask-preship-confirm': 'ASK-051',
  'ask-taxid-address': 'ASK-052',
  'quote-tuxedo-fabric': 'QUOTE-016',
  'first-which-product': 'FIRST-010',
  'ask-suit-3piece': 'ASK-053',
  'ask-suit-es': 'ASK-054',
  'ask-size-no-style': 'ASK-055',
  'quote-tuxedo-sample': 'QUOTE-017',
  'ask-which-jacket': 'ASK-056',
  'first-hi-only': 'FIRST-011',
  'ask-mermaid-gown': 'ASK-057',
  'ask-metallic-mermaid': 'ASK-058',
  'ask-lace-gown-de': 'ASK-059',
  'first-halter-custom': 'FIRST-012',
  'quote-dress-ar': 'QUOTE-018',
  'first-pic-inquiry': 'FIRST-013',
  'quote-tuxedo-fr': 'QUOTE-019'
    };
    const upd = db.prepare(`UPDATE templates SET key=?, updated_at=? WHERE key=? AND origin='seed'`);
    let c = 0;
    const t = now();
    db.transaction(() => {
      for (const [oldK, newK] of Object.entries(KEYMAP)) {
        const r = upd.run(newK, t, oldK);
        if (r.changes) c++;
      }
      db.prepare(`UPDATE app_config SET value='v5' WHERE key='seed_version'`).run();
    })();
    console.log(`[seed] v4→v5 key重命名：${c} 个模板`);
    return;
  }
  if (row && row.value === 'v6') return;
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
    db.prepare(`INSERT OR REPLACE INTO app_config (key,value,updated_at) VALUES ('seed_version','v6',?)`).run(t);
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
    // 任务25: embedding 独立 Key/地址
    embedding_base_url: m.embedding_base_url || '',
    embedding_model: m.embedding_model || '',
    // 任务24: vision 独立供应商（默认 OpenRouter）
    vision_provider: m.vision_provider || 'openrouter',
    vision_base_url: m.vision_base_url || 'https://openrouter.ai/api/v1',
    vision_model: m.vision_model || '',
  };
  if (includeKey) {
    cfg.api_key = m.api_key || '';
    cfg.embedding_api_key = m.embedding_api_key || '';
    cfg.vision_api_key = m.vision_api_key || '';
  }
  return cfg;
}
function adminHasKey(key = 'api_key') {
  const r = db.prepare('SELECT value FROM app_config WHERE key=?').get(key);
  return !!(r && String(r.value).trim());
}

// 管理配置：Key 永不返回明文，只返回是否已设置
app.get('/api/admin/config', (req, res) => {
  res.json({
    ...getAdminConfig(false),
    has_key: adminHasKey('api_key'),
    has_embedding_key: adminHasKey('embedding_api_key'),
    has_vision_key: adminHasKey('vision_api_key'),
  });
});
app.put('/api/admin/config', (req, res) => {
  const b = req.body || {};
  const up = db.prepare(
    'INSERT INTO app_config (key, value, updated_at) VALUES (?,?,?) ' +
    'ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at'
  );
  const t = now();
  for (const k of ['base_url', 'chat_model', 'backend_model', 'embedding_model', 'vision_model',
    'embedding_base_url', 'vision_provider', 'vision_base_url']) {
    if (b[k] !== undefined) up.run(k, String(b[k]).slice(0, 500), t);
  }
  // api_key 类为空时不覆盖旧值
  for (const k of ['api_key', 'embedding_api_key', 'vision_api_key']) {
    if (b[k] !== undefined && String(b[k]).trim() !== '') {
      up.run(k, String(b[k]).trim(), t);
    }
  }
  res.json({ ok: true, ...getAdminConfig(false), has_key: adminHasKey() });
});
// 任务25: embedding 模型列表拉取
app.post('/api/admin/embedding/models', async (req, res) => {
  const { base_url, api_key } = req.body || {};
  const cfg = getAdminConfig(true);
  const url = (base_url || cfg.embedding_base_url || '').replace(/\/+$/, '');
  const key = api_key || cfg.embedding_api_key || '';
  if (!url) return res.status(400).json({ error: '请先填 Embedding Base URL' });
  try {
    const r = await fetch(url + '/models', {
      headers: key ? { 'Authorization': `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `返回 ${r.status}`);
    res.json({ ok: true, models: (d.data || []).map((x) => x.id).filter(Boolean) });
  } catch (e) { res.status(500).json({ error: `拉取失败：${e.message}` }); }
});
app.post('/api/admin/embedding/test', async (req, res) => {
  const cfg = getAdminConfig(true);
  const base_url = ((req.body && req.body.base_url) || cfg.embedding_base_url || '').replace(/\/+$/, '');
  const api_key = (req.body && req.body.api_key) || cfg.embedding_api_key || '';
  const model = (req.body && req.body.model) || cfg.embedding_model || '';
  if (!base_url || !model) return res.status(400).json({ error: '请先填地址和模型' });
  try {
    const r = await fetch(base_url + '/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(api_key ? { 'Authorization': `Bearer ${api_key}` } : {}) },
      body: JSON.stringify({ model, input: '测试' }),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `返回 ${r.status}`);
    const dim = (d.data && d.data[0] && d.data[0].embedding && d.data[0].embedding.length) || 0;
    res.json({ ok: true, msg: `连通正常，向量维度 ${dim}` });
  } catch (e) { res.status(500).json({ error: `测试失败：${e.message}` }); }
});
// 任务24: vision 模型列表拉取 + 连通性测试
app.post('/api/admin/vision/models', async (req, res) => {
  const cfg = getAdminConfig(true);
  const url = (((req.body && req.body.base_url) || cfg.vision_base_url) || '').replace(/\/+$/, '');
  const key = (req.body && req.body.api_key) || cfg.vision_api_key || '';
  if (!url) return res.status(400).json({ error: '请先填 Vision Base URL' });
  try {
    const r = await fetch(url + '/models', {
      headers: key ? { 'Authorization': `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `返回 ${r.status}`);
    res.json({ ok: true, models: (d.data || []).map((x) => x.id).filter(Boolean) });
  } catch (e) { res.status(500).json({ error: `拉取失败：${e.message}` }); }
});
app.post('/api/admin/vision/test', async (req, res) => {
  const cfg = getAdminConfig(true);
  const base_url = (((req.body && req.body.base_url) || cfg.vision_base_url) || '').replace(/\/+$/, '');
  const api_key = (req.body && req.body.api_key) || cfg.vision_api_key || '';
  const model = (req.body && req.body.model) || cfg.vision_model || '';
  if (!base_url || !model) return res.status(400).json({ error: '请先填地址和模型' });
  try {
    const r = await fetch(base_url + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(api_key ? { 'Authorization': `Bearer ${api_key}` } : {}) },
      body: JSON.stringify({
        model, max_tokens: 10,
        messages: [{ role: 'user', content: [
          { type: 'text', text: '这是什么颜色？只回一个词。' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } },
        ]}],
      }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `返回 ${r.status}`);
    res.json({ ok: true, msg: '连通正常，视觉模型可工作' });
  } catch (e) { res.status(500).json({ error: `测试失败：${e.message}` }); }
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
const INTENT_SCENE = {
  '问价': 'quote', '问MOQ': 'quote', '问交期': 'quote', '问运费': 'quote',
  '问样品': 'ask', '问定制': 'ask', '问产品': 'ask',
  '打招呼': 'first', '跟进': 'nudge',
};
async function llmUnderstand(message, cfg) {
  const ck = message.trim();
  // 任务34: SQLite 持久化缓存（5分钟 TTL）
  try {
    const row = db.prepare("SELECT result_json, created_at FROM ai_understand_cache WHERE msg_hash=?").get(ck);
    if (row) {
      const age = (Date.now() - new Date(row.created_at.replace(' ', 'T')).getTime()) / 1000;
      if (age < 300) return JSON.parse(row.result_json);
    }
  } catch (e) {}
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
  if (d.usage) logUsage(model, 'llmUnderstand', d.usage.prompt_tokens, d.usage.completion_tokens);
  const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '{}';
  const u = JSON.parse(text);
  // 清洗：product_tags 只保留词表内的词
  const allTags = new Set(Object.values(TAG_VOCAB).flat());
  const _out = {
    intent: String(u.intent || '其他'),
    product_tags: [...new Set(u.product_tags || [])].filter((t) => allTags.has(t)).slice(0, 3),
    keywords: [...new Set(u.keywords || [])].map(String).filter((k) => k.length >= 2).slice(0, 4),
    lang: String(u.lang || '其他'),
  };
  try {
    db.prepare('INSERT OR REPLACE INTO ai_understand_cache (msg_hash, result_json) VALUES (?,?)')
      .run(ck, JSON.stringify(_out));
    // 清理过期（保留最近 500 条）
    db.exec("DELETE FROM ai_understand_cache WHERE msg_hash NOT IN (SELECT msg_hash FROM ai_understand_cache ORDER BY created_at DESC LIMIT 500)");
  } catch (e) {}
  return _out;
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
  // 价格意图兜底：LLM判其他或没检出场景时，关键词才生效
  if ((!scene || under.intent === '其他') && hasPriceIntent(message)) {
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

app.post('/api/ai/assist', aiRateLimit, aiMsgCheck, async (req, res) => {
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
    // 任务31: 空标签监控
    if (under && !under.product_tags.length && (under.keywords || []).length) {
      try {
        db.prepare('INSERT INTO ai_empty_tag_log (message, lang, keywords) VALUES (?,?,?)')
          .run(message.slice(0, 500), under.lang || '', (under.keywords || []).join(','));
      } catch (e) {}
    }
  } catch (e) {
    candidates = [];
  }
  if (!candidates.length) candidates = aiRetrieve(message);
  if (!candidates.length) return res.status(404).json({ error: '话术库中没有匹配的模板' });

  // Top-3 逻辑：Top-1 断层领先时直接取前3（省 LLM）；否则 LLM 从候选中选3个
  const top1 = candidates[0];
  const top2score = candidates.length > 1 ? (candidates[1].score || 0) : 0;
  let top3;
  if ((top1.score || 0) - top2score >= 30) {
    top3 = candidates.slice(0, 3);
  } else {
    const sys = '你是话术库助手。从候选模板中选最匹配的3条，按相关度排序，输出 JSON {picks:[{template_id}]}。' +
      (under && under.intent ? `买家意图：${under.intent}。` : '') +
      ((under && under.intent !== '问价' && hasPriceIntent(message)) ? '买家在问价，优先选报价类模板。' : '') +
      '不输出其他文字。';
    const userContent = '候选模板：\n' + candidates.map((c) =>
      `- id:${c.id} key:${c.key} 场景句:${c.note_zh} 变量:${c.vars.map((v) => v.name).join(',') || '无'}`
    ).join('\n') + `\n买家消息：${message}`;
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
      if (d.usage) logUsage(cfg.chat_model, 'top3ranking', d.usage.prompt_tokens, d.usage.completion_tokens);
      const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
      const llm = JSON.parse(text);
      const ids = (llm.picks || []).map((p) => Number(p.template_id)).filter((id) => candidates.find((c) => c.id === id));
      top3 = ids.map((id) => candidates.find((c) => c.id === id)).filter(Boolean);
    } catch (e) {
      const cause = e.cause ? ` (cause: ${e.cause.message || e.cause.code || e.cause})` : '';
      console.error('[ai/assist] LLM error:', e.message || e, cause);
      return res.status(500).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }
  }
  if (!top3.length) top3 = candidates.slice(0, 3);
  // 任务36: MMR 多样性排序（相关性 0.7 + 场景多样性 0.3）
  if (top3.length >= 3) {
    const maxScore = Math.max(...top3.map((c) => c.score || 0), 1);
    const picked = [top3[0]];
    const rest = top3.slice(1);
    while (picked.length < 3 && rest.length) {
      let bestIdx = 0, bestVal = -Infinity;
      rest.forEach((c, idx) => {
        const rel = (c.score || 0) / maxScore;
        const sameScene = picked.filter((p) => p.scene === c.scene).length;
        const div = 1 - (sameScene / picked.length) * 0.5;
        const mmr = 0.7 * rel + 0.3 * div;
        if (mmr > bestVal) { bestVal = mmr; bestIdx = idx; }
      });
      picked.push(rest.splice(bestIdx, 1)[0]);
    }
    top3 = picked;
  }
  const options = top3.map((c, i) => {
    const full = getTemplateFull(c.id);
    const text = full.gloss_zh || '';
    // 任务35: 预览优先保留含数字/价格/交期的句子
    let preview;
    const sentences = text.split(/(?<=[。！？])/);
    const keySent = sentences.find((st) => /\d|价格|报价|\$|交期|天|运费/.test(st));
    if (keySent) {
      preview = keySent.slice(0, 80);
      if (text.length > 80) preview += '…';
    } else {
      preview = text.slice(0, 80) + (text.length > 80 ? '…' : '');
    }
    return {
      template_id: c.id, template_key: c.key, note_zh: c.note_zh, scene: c.scene,
      preview,
      recommended: i === 0,
      has_vars: (c.vars || []).length > 0,
    };
  });
  res.json({ ok: true, options, message });
});

// 选中某条候选后：抽 slot + 护栏 + 渲染
app.post('/api/ai/assist/select', aiRateLimit, aiMsgCheck, async (req, res) => {
  const { template_id, message } = req.body || {};
  if (!template_id || !message) return res.status(400).json({ error: '缺少参数' });
  const cfg = getAdminConfig(true);
  if (!cfg.api_key) return res.status(400).json({ error: '未配置 API Key' });
  const tpl = db.prepare('SELECT * FROM templates WHERE id=?').get(Number(template_id));
  if (!tpl) return res.status(404).json({ error: '模板不存在' });
  const varStmt = db.prepare('SELECT name,type,required,label_zh FROM template_vars WHERE template_id=? ORDER BY sort,id');
  tpl.vars = varStmt.all(tpl.id);
  let slots = {};
  if (tpl.vars.length) {
    // 有变量时调 LLM 抽 slot
    const sys = '从买家消息中提取模板变量值，输出 JSON {slots:{name:value}}。值必须是原文子串；价格、交期没有就留空，绝不编造。\n' +
      '示例1：变量[price] 消息"I want 2 pieces, how much?" → {"slots":{"price":""}}（消息中无价格，留空）\n' +
      '示例2：变量[color,size] 消息"Je veux la robe rouge en taille M" → {"slots":{"color":"rouge","size":"M"}}\n' +
      '示例3：变量[quantity] 消息"أريد ٥ قطع" → {"slots":{"quantity":"٥ قطع"}}';
    const userContent = `变量：${tpl.vars.map((v) => v.name).join(',')}\n买家消息：${message}`;
    try {
      const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
        body: JSON.stringify({
          model: cfg.chat_model,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: sys }, { role: 'user', content: userContent }],
          temperature: 0.1,
          max_tokens: 200,
          enable_thinking: false,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        if (d.usage) logUsage(cfg.chat_model, 'slotExtract', d.usage.prompt_tokens, d.usage.completion_tokens);
        const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '{}';
        slots = JSON.parse(text).slots || {};
      }
    } catch (e) { /* 抽 slot 失败就用空 */ }
  }
  const candidates = [{ ...tpl, id: tpl.id }];
  // 任务33: 记录用户选择（rank 从请求来，前端传）
  try {
    const rank = Number((req.body || {}).rank) || 0;
    db.prepare('INSERT INTO ai_select_log (template_id, template_key, rank, message) VALUES (?,?,?,?)')
      .run(tpl.id, tpl.key || '', rank, String(message).slice(0, 300));
  } catch (e) {}
  return finishAssist(res, tpl.id, slots, message, cfg, candidates);
});

// 短路/正常流程共用的收尾：护栏检查 + 渲染 + 返回
async function faithfulnessCheck(filledText, slots, message, cfg) {
  // 任务40: 高风险类全量二检 — 用便宜模型验证 claim 是否有来源支持
  const sys = '你是 faithfulness 检查员。判断客服回复中的价格/交期数字是否有明确来源支持。' +
    '来源只能是：用户消息原文、已填充的 slot 值。输出 JSON {"pass":true/false,"reason":""}。' +
    '示例：回复"报价 $500"但 slot 为空 → {"pass":false,"reason":"价格无来源"}';
  try {
    const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
      body: JSON.stringify({
        model: cfg.backend_model || cfg.chat_model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `回复：${filledText}\nSlots：${JSON.stringify(slots)}\n用户消息：${message}` },
        ],
        temperature: 0.1, max_tokens: 200, enable_thinking: false,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { pass: true }; // 检查服务挂了就放行（fail open，避免阻塞）
    if (d.usage) logUsage(cfg.backend_model || cfg.chat_model, 'faithfulness', d.usage.prompt_tokens, d.usage.completion_tokens);
    const t = (d.choices?.[0]?.message?.content) || '{}';
    return JSON.parse(t);
  } catch (e) { return { pass: true }; }
}

async function finishAssist(res, templateId, rawSlots, message, cfg, candidates) {
  const tpl = candidates.find((c) => c.id === Number(templateId));
  if (!tpl) return res.status(500).json({ error: 'AI 返回了候选之外的模板，请重试' });

  const { slots, missing } = aiGuardrails(tpl, rawSlots, message);
  // 中文渲染：同 :id/render 的 ZH 逻辑（gloss_zh + 落款片段展开）
  const full = getTemplateFull(tpl.id);
  const filled_text = renderBody(expandSnippets(full.gloss_zh || '', 'ZH'), slots);
  // 任务40: 高风险类（价格/交期 slot 有值）全量二检
  const highRisk = ['price', '价格', 'lead_time', '交期'].some((k) => String(slots[k] || '').trim());
  if (highRisk) {
    const check = await faithfulnessCheck(filled_text, slots, message, cfg);
    if (!check.pass) {
      // 任务42: 转人工上下文打包
      return res.json({
        ok: false, locked: true, reason: check.reason || 'faithfulness 检查未通过',
        template_id: tpl.id, template_key: tpl.key,
        hint: '已锁死转人工',
        handoff: {
          buyer_message: message,
          candidates_top3: candidates.slice(0, 3).map((c) => ({ id: c.id, key: c.key, note_zh: c.note_zh })),
          selected_template: { id: tpl.id, key: tpl.key, note_zh: tpl.note_zh },
          missing_fields: missing,
          guardrail_triggered: 'faithfulnessCheck',
          slots,
        },
      });
    }
  }
  // 任务41: 语气禁令检查
  const { checkTone } = await import('./toneBans.js');
  const violations = checkTone(filled_text);
  const resp = {
    ok: true, template_id: tpl.id, template_key: tpl.key, note_zh: tpl.note_zh,
    filled_text, slots, missing,
    tone_violations: violations.length ? violations : undefined,
  };
  // 任务42: 有缺失字段时也附上下文包（接手人直接看到卡点）
  if (missing && missing.length) {
    resp.handoff = {
      buyer_message: message,
      candidates_top3: candidates.slice(0, 3).map((c) => ({ id: c.id, key: c.key, note_zh: c.note_zh })),
      selected_template: { id: tpl.id, key: tpl.key, note_zh: tpl.note_zh },
      missing_fields: missing,
      guardrail_triggered: 'missingRequiredSlots',
      slots,
    };
  }
  res.json(resp);
}

// 任务38: 政策库 — 只返回当前生效版本
function getEffectivePolicies() {
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare(
    `SELECT * FROM policies WHERE effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?) ORDER BY id`
  ).all(today, today);
}
function checkPolicyRef(policyId) {
  // 引用检查：过期返回需人工确认
  const p = db.prepare('SELECT * FROM policies WHERE id=?').get(policyId);
  if (!p) return { ok: false, reason: '政策不存在' };
  const today = new Date().toISOString().slice(0, 10);
  if (p.effective_from > today || (p.effective_to && p.effective_to < today)) {
    return { ok: false, reason: '需人工确认', policy: p };
  }
  return { ok: true, policy: p };
}
// 政策 CRUD API
app.get('/api/policies', (req, res) => {
  res.json(db.prepare('SELECT * FROM policies ORDER BY id DESC').all());
});
app.post('/api/policies', (req, res) => {
  const { entry, effective_from, effective_to, updated_by } = req.body || {};
  if (!entry || !String(entry).trim()) return res.status(400).json({ error: '条目必填' });
  if (!effective_from) return res.status(400).json({ error: '生效日期必填' });
  // 原子化检查：拒绝模糊词
  const fuzzy = ['大概', '一般', '通常', '可能', '左右'];
  const hit = fuzzy.find((w) => String(entry).includes(w));
  if (hit) return res.status(400).json({ error: `条目含模糊词"${hit}"，请改写为精确表述` });
  const r = db.prepare(
    'INSERT INTO policies (entry, effective_from, effective_to, updated_by) VALUES (?,?,?,?)'
  ).run(String(entry).trim(), effective_from, effective_to || null, updated_by || '');
  res.json({ ok: true, id: r.lastInsertRowid });
});
app.put('/api/policies/:id', (req, res) => {
  const { entry, effective_from, effective_to } = req.body || {};
  const cur = db.prepare('SELECT * FROM policies WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: '政策不存在' });
  // 版本化：更新时版本号+1
  db.prepare(
    'UPDATE policies SET entry=COALESCE(?,entry), effective_from=COALESCE(?,effective_from), effective_to=?, version=version+1 WHERE id=?'
  ).run(entry, effective_from, effective_to || null, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/policies/:id', (req, res) => {
  db.prepare('DELETE FROM policies WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// 任务43: 每周复盘 API
app.get('/api/reviews', (req, res) => {
  res.json(db.prepare('SELECT * FROM review_log ORDER BY week DESC, id DESC').all());
});
app.post('/api/reviews', (req, res) => {
  const { week, issue, root_cause, action, action_type } = req.body || {};
  if (!week || !issue || !root_cause || !action || !action_type)
    return res.status(400).json({ error: 'week/issue/root_cause/action/action_type 必填' });
  const r = db.prepare(
    'INSERT INTO review_log (week, issue, root_cause, action, action_type) VALUES (?,?,?,?,?)'
  ).run(week, issue, root_cause, action, action_type);
  res.json({ ok: true, id: r.lastInsertRowid });
});
app.put('/api/reviews/:id/done', (req, res) => {
  db.prepare("UPDATE review_log SET status='done' WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});
// 复盘完成率检查：本周定位的问题是否都有沉淀
app.get('/api/reviews/weekly/:week', (req, res) => {
  const rows = db.prepare('SELECT * FROM review_log WHERE week=?').all(req.params.week);
  const total = rows.length;
  const done = rows.filter((r) => r.status === 'done').length;
  res.json({ week: req.params.week, total, done, pending: total - done, rows });
});

// 任务26: 记录用量（价格与调用数据关联）
function logUsage(model, endpoint, tokensIn, tokensOut) {
  try {
    const pr = db.prepare('SELECT input_price, output_price FROM model_prices WHERE model_id=?').get(model);
    const cost = pr ? (tokensIn / 1000 * pr.input_price + tokensOut / 1000 * pr.output_price) : 0;
    db.prepare(
      'INSERT INTO ai_usage_log (model, endpoint, tokens_in, tokens_out, cost) VALUES (?,?,?,?,?)'
    ).run(model, endpoint, tokensIn || 0, tokensOut || 0, cost);
  } catch (e) {}
}
// 模型价格 CRUD
app.get('/api/admin/model-prices', (req, res) => {
  res.json(db.prepare('SELECT * FROM model_prices ORDER BY model_id').all());
});
app.put('/api/admin/model-prices', (req, res) => {
  const { model_id, input_price, output_price } = req.body || {};
  if (!model_id) return res.status(400).json({ error: 'model_id 必填' });
  db.prepare(
    'INSERT INTO model_prices (model_id, input_price, output_price) VALUES (?,?,?) ' +
    "ON CONFLICT(model_id) DO UPDATE SET input_price=excluded.input_price, output_price=excluded.output_price, updated_at=datetime('now','localtime')"
  ).run(model_id, Number(input_price) || 0, Number(output_price) || 0);
  res.json({ ok: true });
});
// 用量统计（按模型汇总）
app.get('/api/admin/usage', (req, res) => {
  const days = Number(req.query.days) || 30;
  const rows = db.prepare(
    `SELECT model, COUNT(*) as calls, SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out, SUM(cost) as cost
     FROM ai_usage_log WHERE created_at >= datetime('now', '-' || ? || ' days')
     GROUP BY model ORDER BY cost DESC`
  ).all(days);
  const total = db.prepare(
    `SELECT COUNT(*) as calls, SUM(cost) as cost FROM ai_usage_log
     WHERE created_at >= datetime('now', '-' || ? || ' days')`
  ).get(days);
  res.json({ by_model: rows, total });
});

// ===== 模型管理 =====
const MODEL_CATS = {
  basic: { name: '基础模型', subs: { chat: '对话模型', backend: '后台模型', vision_understand: '识图模型' } },
  visual: { name: '视觉模型', subs: { image_gen: '生图模型', video: '视频模型' } },
  embedding: { name: '向量模型', subs: { embedding: '向量模型' } },
};
app.get('/api/admin/models', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT id, model_id, display_name, description, category, subcategory, provider_name, base_url, input_price, output_price, is_active, created_at FROM models';
  const args = [];
  if (category) { sql += ' WHERE category=?'; args.push(category); }
  sql += ' ORDER BY category, subcategory, model_id';
  res.json(db.prepare(sql).all(...args));
});
app.post('/api/admin/models', (req, res) => {
  const { model_id, display_name, description, category, subcategory, provider_name, base_url, api_key, input_price, output_price } = req.body || {};
  if (!model_id || !String(model_id).trim()) return res.status(400).json({ error: '模型 ID 必填' });
  if (!category || !MODEL_CATS[category]) return res.status(400).json({ error: '分类必填' });
  try {
    const r = db.prepare(
      `INSERT INTO models (model_id, display_name, description, category, subcategory, provider_name, base_url, api_key, input_price, output_price)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(
      String(model_id).trim(), String(display_name || '').trim(), String(description || '').trim(),
      category, subcategory || '', String(provider_name || '').trim(),
      String(base_url || '').trim(), String(api_key || '').trim(),
      Number(input_price) || 0, Number(output_price) || 0
    );
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: '该模型已上架' });
    throw e;
  }
});
app.put('/api/admin/models/:id', (req, res) => {
  const b = req.body || {};
  const sets = [], args = [];
  for (const k of ['display_name', 'description', 'subcategory', 'provider_name', 'base_url', 'input_price', 'output_price', 'is_active']) {
    if (b[k] !== undefined) { sets.push(`${k}=?`); args.push(b[k]); }
  }
  if (b.api_key !== undefined && String(b.api_key).trim() !== '') { sets.push('api_key=?'); args.push(String(b.api_key).trim()); }
  if (!sets.length) return res.json({ ok: true });
  args.push(req.params.id);
  db.prepare(`UPDATE models SET ${sets.join(',')} WHERE id=?`).run(...args);
  res.json({ ok: true });
});
app.delete('/api/admin/models/:id', (req, res) => {
  db.prepare('DELETE FROM models WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
// 分类供应商配置
app.get('/api/admin/model-providers', (req, res) => {
  const rows = db.prepare('SELECT category, provider_name, base_url FROM model_providers').all();
  const m = Object.fromEntries(rows.map((r) => [r.category, r]));
  // 掩码：只返回是否已设置
  const withKey = db.prepare('SELECT category FROM model_providers WHERE api_key IS NOT NULL AND api_key != ?').all('');
  const hasKey = Object.fromEntries(withKey.map((r) => [r.category, true]));
  res.json({ providers: m, has_key: hasKey, categories: MODEL_CATS });
});
app.put('/api/admin/model-providers/:category', (req, res) => {
  const { category } = req.params;
  if (!MODEL_CATS[category]) return res.status(400).json({ error: '分类无效' });
  const { provider_name, base_url, api_key } = req.body || {};
  const cur = db.prepare('SELECT * FROM model_providers WHERE category=?').get(category);
  db.prepare(
    `INSERT INTO model_providers (category, provider_name, base_url, api_key) VALUES (?,?,?,?)
     ON CONFLICT(category) DO UPDATE SET provider_name=excluded.provider_name, base_url=excluded.base_url,
     api_key=CASE WHEN excluded.api_key='' THEN model_providers.api_key ELSE excluded.api_key END,
     updated_at=datetime('now','localtime')`
  ).run(category, String(provider_name || ''), String(base_url || ''), String(api_key || ''));
  res.json({ ok: true });
});

// 模型管理：拉取可用模型（按分类供应商）
app.post('/api/admin/models/pull', async (req, res) => {
  const { category } = req.body || {};
  if (!category || !MODEL_CATS[category]) return res.status(400).json({ error: '分类无效' });
  const pv = db.prepare('SELECT * FROM model_providers WHERE category=?').get(category);
  const base_url = ((req.body && req.body.base_url) || (pv && pv.base_url) || '').replace(/\/+$/, '');
  const api_key = (req.body && req.body.api_key) || (pv && pv.api_key) || '';
  if (!base_url) return res.status(400).json({ error: '请先配置该分类的供应商地址' });
  try {
    const r = await fetch(base_url + '/models', {
      headers: api_key ? { 'Authorization': `Bearer ${api_key}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `返回 ${r.status}`);
    res.json({ ok: true, models: (d.data || []).map((x) => x.id).filter(Boolean) });
  } catch (e) { res.status(500).json({ error: `拉取失败：${e.message}` }); }
});
// 模型管理：连通测试（按分类走不同接口）
app.post('/api/admin/models/test', async (req, res) => {
  const { model_id, category } = req.body || {};
  if (!model_id) return res.status(400).json({ error: '模型 ID 必填' });
  const pv = db.prepare('SELECT * FROM model_providers WHERE category=?').get(category || 'basic');
  const base_url = ((req.body && req.body.base_url) || (pv && pv.base_url) || '').replace(/\/+$/, '');
  const api_key = (req.body && req.body.api_key) || (pv && pv.api_key) || '';
  if (!base_url) return res.status(400).json({ error: '请先配置供应商地址' });
  try {
    let url, body;
    if (category === 'embedding') {
      url = base_url + '/embeddings';
      body = { model: model_id, input: '测试' };
    } else if (category === 'visual') {
      url = base_url + '/images/generations';
      body = { model: model_id, prompt: 'a red apple', n: 1, size: '256x256' };
    } else {
      url = base_url + '/chat/completions';
      body = { model: model_id, max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] };
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(api_key ? { 'Authorization': `Bearer ${api_key}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || `返回 ${r.status}`);
    res.json({ ok: true, msg: '连通正常' });
  } catch (e) { res.status(500).json({ error: `测试失败：${e.message}` }); }
});
// 模型管理：分类统计（按上架模型的消耗）
app.get('/api/admin/models/stats', (req, res) => {
  const days = Number(req.query.days) || 30;
  // 所有上架的模型
  const models = db.prepare('SELECT model_id, display_name, category, subcategory FROM models WHERE is_active=1').all();
  // 用量按 model 分组
  const usage = db.prepare(
    `SELECT model, endpoint, COUNT(*) as calls, SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out, SUM(cost) as cost
     FROM ai_usage_log WHERE created_at >= datetime('now', '-' || ? || ' days')
     GROUP BY model, endpoint`
  ).all(days);
  // 按分类汇总
  const byCat = {};
  for (const cat of Object.keys(MODEL_CATS)) byCat[cat] = { calls: 0, cost: 0, models: [] };
  const modelMap = Object.fromEntries(models.map((m) => [m.model_id, m]));
  for (const u of usage) {
    const m = modelMap[u.model];
    const cat = m ? m.category : 'basic'; // 未上架的模型归基础类
    if (!byCat[cat]) continue;
    byCat[cat].calls += u.calls;
    byCat[cat].cost += u.cost || 0;
  }
  // 每个模型的明细
  const byModel = models.map((m) => {
    const us = usage.filter((u) => u.model === m.model_id);
    const calls = us.reduce((a, b) => a + b.calls, 0);
    const cost = us.reduce((a, b) => a + (b.cost || 0), 0);
    const byEndpoint = us.map((u) => ({ endpoint: u.endpoint, calls: u.calls }));
    return { ...m, calls, cost, by_endpoint: byEndpoint };
  }).sort((a, b) => b.calls - a.calls);
  const total = { calls: byModel.reduce((a, b) => a + b.calls, 0), cost: byModel.reduce((a, b) => a + b.cost, 0) };
  res.json({ by_category: byCat, by_model: byModel, total, categories: MODEL_CATS });
});

// ---------- static ----------
app.use(express.static(path.join(__dirname, '..', '..', 'client')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`[garment-mgmt] listening on :${PORT}`));
