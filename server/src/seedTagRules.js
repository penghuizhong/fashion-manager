/* 模板批量打标规则（v0.10.2）
 * 用途：给 92 条种子模板按内容自动打标（INSERT OR IGNORE，不覆盖人工打标）
 * 规则基于 key/note_zh/gloss_zh 关键词；人工可在编辑页调整
 */
export const TAG_RULES = [
  // 款式（key）
  { match: (k) => k.includes('tuxedo'), tags: ['燕尾服'] },
  { match: (k) => k.includes('suit') && !k.includes('tuxedo'), tags: ['西装'] },
  { match: (k) => (k.includes('dress') || k.includes('gown')) && !k.includes('wedding') && !k.includes('bridal'), tags: ['晚礼服'] },
  { match: (k) => k.includes('wedding') || k.includes('bridal'), tags: ['婚纱'] },
  { match: (k) => k.includes('bridesmaid'), tags: ['伴娘裙'] },
  // 话题（note_zh）
  { match: (k, n) => n.includes('问价'), tags: ['报价'] },
  { match: (k, n) => n.includes('MOQ') || n.includes('起订'), tags: ['起订量'] },
  { match: (k, n) => n.includes('样品'), tags: ['样品'] },
  { match: (k, n) => n.includes('交期') || n.includes('交货'), tags: ['大货交期'] },
  { match: (k, n) => n.includes('运费') || n.includes('运输'), tags: ['运费'] },
  { match: (k, n) => n.includes('定制'), tags: ['定制'] },
  { match: (k, n) => n.includes('付款'), tags: ['付款'] },
  { match: (k, n) => n.includes('颜色'), tags: ['颜色'] },
  { match: (k, n) => n.includes('面料'), tags: ['面料咨询'] },
  { match: (k, n) => n.includes('尺码'), tags: ['尺码'] },
  { match: (k, n) => n.includes('跟进') || k.includes('nudge'), tags: ['订单跟进'] },
  // 颜色（gloss_zh）
  { match: (k, n, g) => g.includes('藏青'), tags: ['藏青'] },
  { match: (k, n, g) => k.includes('black') || g.includes('黑色'), tags: ['黑色'] },
  { match: (k, n, g) => k.includes('white') || g.includes('白色'), tags: ['白色'] },
  { match: (k, n, g) => k.includes('pink') || g.includes('粉色'), tags: ['粉色'] },
];

export function applyTagRules(db) {
  const tags = new Map(db.prepare('SELECT name, id FROM tags').all().map((r) => [r.name, r.id]));
  const ins = db.prepare('INSERT OR IGNORE INTO template_tags (template_id, tag_id) VALUES (?,?)');
  let count = 0;
  const rows = db.prepare("SELECT id, key, note_zh, gloss_zh FROM templates WHERE origin='seed'").all();
  db.transaction(() => {
    for (const t of rows) {
      const k = (t.key || '').toLowerCase();
      const n = t.note_zh || '';
      const g = t.gloss_zh || '';
      const names = new Set();
      for (const r of TAG_RULES) {
        if (r.match(k, n, g)) r.tags.forEach((x) => names.add(x));
      }
      let added = false;
      for (const name of names) {
        const id = tags.get(name);
        if (id) { ins.run(t.id, id); added = true; }
      }
      if (added) count++;
    }
  })();
  return count;
}
