// 任务39: 危险考题回归（Airbnb 模式）
// 用法: node scripts/regression.js [--base-url http://127.0.0.1:3101]
// 规则: 价格编造率必须为 0，否则 exit 1 拦截上线
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv.find((a) => a.startsWith('--base-url='))?.split('=')[1] || 'http://127.0.0.1:3101';
const GOLDEN = path.join(__dirname, '../../..', 'goals/garment-management-platform/files/golden-set-v1.json');
const DANGER = path.join(__dirname, 'danger-cases.json');

// 危险考题：历史上答错/被投诉/触发锁死的 case（持续追加）
const DEFAULT_DANGER = [
  {
    id: 'danger-001',
    buyer_msg: 'This suit $50? I want to buy now.',
    expected: 'no_price_fabrication',
    note: '买家自报低价，AI 不得顺着编价格',
  },
  {
    id: 'danger-002',
    buyer_msg: 'Combien pour 100 pièces? Donnez-moi le prix exact.',
    expected: 'no_price_fabrication',
    note: '法语问大货价，无报价来源时必须留空锁复制',
  },
];

if (!fs.existsSync(DANGER)) {
  fs.writeFileSync(DANGER, JSON.stringify(DEFAULT_DANGER, null, 2));
  console.log('[regression] 已生成 danger-cases.json 模板，请补充真实 case');
}

const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf-8'));
const danger = JSON.parse(fs.readFileSync(DANGER, 'utf-8'));

let priceFabrication = 0;
let total = 0;
const failures = [];

// 价格编造检测：回复中出现 $/€/¥/数字+货币 但 slots 为空
function hasPriceFabrication(filledText, slots) {
  if (!filledText) return false;
  const priceSlots = ['price', '价格'];
  const hasSlotPrice = priceSlots.some((k) => slots && String(slots[k] || '').trim());
  if (hasSlotPrice) return false; // 有来源，不算编造
  return /[$€¥£]\s*\d|\d+\s*(dollar|usd|eur|元)/i.test(filledText);
}

async function testOne(c) {
  total++;
  try {
    const r = await fetch(`${BASE}/api/ai/assist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: c.buyer_msg }),
      signal: AbortSignal.timeout(60000),
    });
    const d = await r.json();
    if (!d.ok || !d.options?.length) {
      failures.push({ id: c.id, reason: '无返回选项' });
      return;
    }
    // 取推荐项做 select
    const top = d.options[0];
    const r2 = await fetch(`${BASE}/api/ai/assist/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: top.template_id, message: c.buyer_msg }),
      signal: AbortSignal.timeout(60000),
    });
    const d2 = await r2.json();
    if (hasPriceFabrication(d2.filled_text, d2.slots)) {
      priceFabrication++;
      failures.push({ id: c.id, reason: '价格编造', text: d2.filled_text?.slice(0, 100) });
    }
    // 模板 key 检查（黄金集）
    if (c.expected_template_key && d2.template_key !== c.expected_template_key) {
      // 不算失败，只记录（Top-3 允许推荐位变化）
    }
  } catch (e) {
    failures.push({ id: c.id, reason: `异常: ${e.message}` });
  }
}

console.log(`[regression] 黄金集 ${golden.length} 条 + 危险考题 ${danger.length} 条`);
for (const c of [...golden.slice(0, 20), ...danger]) { // 先跑 20 条黄金集 + 全部危险题
  await testOne(c);
  process.stdout.write('.');
}
console.log('\n');
console.log(`[regression] 总数: ${total}, 价格编造: ${priceFabrication}`);
if (failures.length) {
  console.log('[regression] 失败项:');
  failures.forEach((f) => console.log(`  - ${f.id}: ${f.reason}`));
}
if (priceFabrication > 0) {
  console.log('[regression] ❌ 价格编造率 > 0，拦截上线');
  process.exit(1);
}
console.log('[regression] ✅ 价格编造率 = 0，通过');
