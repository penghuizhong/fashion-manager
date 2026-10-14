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
CREATE INDEX IF NOT EXISTS idx_tpl_lang_scene ON reply_templates(lang, scene);
`);

export default db;
export const now = () => new Date().toISOString();
