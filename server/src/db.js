import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.GM_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'garment.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS style_counters (
  yy TEXT NOT NULL,
  season TEXT NOT NULL,
  category TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (yy, season, category)
);
CREATE TABLE IF NOT EXISTS garments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  season TEXT NOT NULL,
  year TEXT NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  garment_id INTEGER NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  ver TEXT NOT NULL,
  ver_num INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(garment_id, ver)
);
CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  garment_id INTEGER NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  version_id INTEGER NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  size_table TEXT NOT NULL DEFAULT '[]',
  materials TEXT NOT NULL DEFAULT '[]',
  craft_desc TEXT NOT NULL DEFAULT '',
  photos TEXT NOT NULL DEFAULT '[]',
  fitting_notes TEXT NOT NULL DEFAULT '',
  labor_cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(version_id)
);
CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  customer TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'CNY',
  items TEXT NOT NULL DEFAULT '[]',
  margin REAL NOT NULL DEFAULT 30,
  price REAL NOT NULL DEFAULT 0,
  terms TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_versions_garment ON versions(garment_id);
CREATE INDEX IF NOT EXISTS idx_samples_garment ON samples(garment_id);
CREATE TABLE IF NOT EXISTS reply_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lang TEXT NOT NULL,
  scene TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  note_zh TEXT NOT NULL DEFAULT '',
  source_buyer TEXT NOT NULL DEFAULT '',
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  scene TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '通用',
  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,
  note_zh TEXT NOT NULL DEFAULT '',
  source_buyer TEXT NOT NULL DEFAULT '',
  usage_count INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'custom',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS template_locales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  UNIQUE(template_id, lang)
);
CREATE TABLE IF NOT EXISTS template_vars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  required INTEGER NOT NULL DEFAULT 0,
  label_zh TEXT NOT NULL DEFAULT '',
  sample TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  UNIQUE(template_id, name)
);
CREATE TABLE IF NOT EXISTS snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  lang TEXT NOT NULL,
  title_zh TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  UNIQUE(key, lang)
);
CREATE INDEX IF NOT EXISTS idx_tpl_scene ON templates(scene);
CREATE INDEX IF NOT EXISTS idx_tpl_key ON templates(key);
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
`);

// v0.3.0 迁移：老 reply_templates（v0.2.x 平铺结构）→ 新结构
// 种子模板由新种子重建；用户自定义模板（is_seed=0）迁为单语言逻辑模板
const hasOldTpl = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='reply_templates'`
).get();
if (hasOldTpl) {
  const scanVars = (body) => {
    const out = []; const re = /\{\{\s*([a-z_]+)\s*\}\}/g; let m;
    while ((m = re.exec(body))) if (!out.includes(m[1])) out.push(m[1]);
    return out; // {{snippet:xxx}} 含冒号，不会被 [a-z_]+ 捕获
  };
  const rows = db.prepare('SELECT * FROM reply_templates WHERE is_seed=0').all();
  const t = new Date().toISOString();
  const insT = db.prepare(
    `INSERT INTO templates (key,scene,category,status,version,note_zh,source_buyer,usage_count,origin,created_at,updated_at)
     VALUES (?,?,?,?,?, ?,?,?,?, ?,?)`
  );
  const insL = db.prepare(
    `INSERT INTO template_locales (template_id,lang,title,body) VALUES (?,?,?,?)`
  );
  const insV = db.prepare(
    `INSERT INTO template_vars (template_id,name,type,required,label_zh,sample,sort) VALUES (?,?,?,?,?,?,?)`
  );
  const LABEL = { buyer_name: '买家名', product: '产品', price: '价格', lead_time: '交期', quantity: '数量', country: '国家', size: '尺码', color: '颜色' };
  db.transaction(() => {
    rows.forEach((r, i) => {
      const key = `legacy-${r.id}-${Date.now()}-${i}`;
      const id = insT.run(key, r.scene, '通用', 'published', 1, r.note_zh || '', r.source_buyer || '', 0, 'legacy', t, t).lastInsertRowid;
      insL.run(id, r.lang, r.title, r.body);
      scanVars(r.body).forEach((v, vi) => {
        insV.run(id, v, v === 'price' || v === 'quantity' ? 'number' : 'text',
          v === 'price' || v === 'lead_time' ? 1 : 0, LABEL[v] || v, '', vi);
      });
    });
    db.exec('DROP TABLE reply_templates');
  })();
  if (rows.length) console.log(`[migrate] reply_templates → 新结构，迁移自定义模板 ${rows.length} 条`);
}

// v0.3.1：templates 加中文对照列（老库升级用）
const tplCols = db.prepare(`PRAGMA table_info(templates)`).all().map((c) => c.name);
if (!tplCols.includes('gloss_zh')) {
  db.exec(`ALTER TABLE templates ADD COLUMN gloss_zh TEXT NOT NULL DEFAULT ''`);
  console.log('[migrate] templates + gloss_zh 列');
}

export default db;
export const now = () => new Date().toISOString();
