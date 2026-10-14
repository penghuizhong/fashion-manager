import db from './db.js';

// 款号规则：年份2位 + 季节1位(S春夏/A秋冬) + 类别2位 + 流水3位，如 26S-DR-001
// 版次拼在展示层：26S-DR-001-V2
export const CATEGORIES = {
  TS: '上衣', DR: '连衣裙', SK: '半裙', PN: '裤装', JK: '外套/夹克', ST: '套装',
};
export const SEASONS = { S: '春夏', A: '秋冬' };

export function nextStyleNo(season, category) {
  if (!SEASONS[season]) throw new Error('季节必须是 S 或 A');
  if (!CATEGORIES[category]) throw new Error('未知类别代码');
  const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
  const run = db.transaction(() => {
    const row = db.prepare(
      'SELECT seq FROM style_counters WHERE yy=? AND season=? AND category=?'
    ).get(yy, season, category);
    const seq = (row ? row.seq : 0) + 1;
    db.prepare(
      `INSERT INTO style_counters (yy, season, category, seq) VALUES (?,?,?,?)
       ON CONFLICT(yy, season, category) DO UPDATE SET seq=excluded.seq`
    ).run(yy, season, category, seq);
    return seq;
  });
  const seq = run();
  return { style_no: `${yy}${season}-${category}-${String(seq).padStart(3, '0')}`, yy, seq };
}

export const STATUS_FLOW = ['draft', 'sampling', 'confirmed'];
export const STATUS_LABEL = { draft: '设计中', sampling: '样衣中', confirmed: '已确认' };

export function canTransition(from, to) {
  const a = STATUS_FLOW.indexOf(from), b = STATUS_FLOW.indexOf(to);
  return a !== -1 && b !== -1 && b === a + 1; // 只允许向前推一格
}
