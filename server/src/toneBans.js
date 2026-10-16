// 任务41: 语气禁令文件（SOUL.md 式）
// 具体禁令而非空话，随版本走。管住 LLM 改写的那一小块自由度。
export const TONE_BANS = [
  {
    id: 'ban-001',
    rule: '价格永远带币种',
    pattern: /[$€¥£]\s*\d|\d+\s*(USD|EUR|CNY|元|美元|欧元)/i,
    // 反向检查：如果提到价格但没带币种，违规
    check: (text) => {
      const hasPriceNum = /\d+\s*(块|钱)/.test(text) && !/[$€¥£]|USD|EUR|CNY|元|美元|欧元/i.test(text);
      return hasPriceNum ? '价格没带币种' : null;
    },
  },
  {
    id: 'ban-002',
    rule: '不确定就说"我跟工厂确认后回复您"',
    check: (text) => {
      // 如果用了"大概""可能""应该"这类模糊词，提示改用确认话术
      const fuzzy = ['大概', '可能', '应该', '估计'];
      const hit = fuzzy.find((w) => text.includes(w));
      return hit ? `含模糊词"${hit}"，请改用"我跟工厂确认后回复您"` : null;
    },
  },
  {
    id: 'ban-003',
    rule: '不说 AI 腔',
    check: (text) => {
      const aiTone = ['好问题！', '很好的问题', '作为AI', '我是一个'];
      const hit = aiTone.find((w) => text.includes(w));
      return hit ? `含 AI 腔"${hit}"` : null;
    },
  },
];

export function checkTone(text) {
  const violations = [];
  for (const ban of TONE_BANS) {
    const reason = ban.check(text);
    if (reason) violations.push({ id: ban.id, rule: ban.rule, reason });
  }
  return violations;
}
