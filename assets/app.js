import { defaults, limits, personalKeys, choices, sanitize, budget, cashflow, prepayment, taxEstimate } from './model.js';

const $ = id => document.getElementById(id);
const storageKey = 'our-home.plan.v1';
let state = sanitize(defaults);
let storageAvailable = true;
try { const saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (saved?.version === 1) state = sanitize(saved.plan); } catch { storageAvailable = false; }
const money = (n, digits = 1) => n.toLocaleString('zh-CN', { maximumFractionDigits: digits });
const yuan = n => money(n, 0);
const icons = {
  home: '<path d="m3 11 9-8 9 8v10H3Z"/><path d="M9 21v-8h6v8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  wallet: '<path d="M20 7V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7"/><path d="M21 12h-6v5h6"/><path d="M17 14.5h.1"/>',
  chart: '<path d="M4 3v17h17M8 15v-4m5 4V7m5 8V3"/>',
  check: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 11 3 3 6-6M8 18h8"/>',
  upload: '<path d="M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5"/>',
  download: '<path d="M12 3v13m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  print: '<path d="M7 8V3h10v5M7 17H3V9h18v8h-4M7 14h10v7H7Z"/><path d="M17 11h1"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  key: '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-6-6 3-3m0 6 3-3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h3m4 0h3m-10 3h3"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  heart: '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-6 6 8 15 8 15S26 11 20 5Z"/>'
};
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[el.dataset.icon] || ''}</svg>`; });

const fields = {
  'house-fields': [['price', '心仪房子的总价', '成交价，可先放一个目标', '万'], ['tax', '税费与交易费用', '契税、个税、中介等综合预估', '万'], ['reserve', '购房备用金', '给评估差额、临时费用留余地', '万']],
  'renovation-fields': [['renovation', '硬装', '拆旧、水电、防水、门窗等', '万'], ['furniture', '家具', '沙发、床、餐桌与柜子', '万'], ['appliances', '家电', '冰箱、空调、洗衣机与厨电', '万'], ['moving', '租房与搬家', '过渡期间的生活安排', '万']],
  'wedding-fields': [['bride', '彩礼', '原稿 10～18 万 · 两家商量', '万'], ['gold', '三金', '原稿 3～5 万 · 项链、戒指、手镯', '万'], ['ring', '婚戒', '原稿 1～2.5 万', '万'], ['dinner', '家长见面宴', '原稿 1～2 万 · 两三桌', '万'], ['gifts', '改口费与见面礼', '原稿 0.5～1 万', '万'], ['candy', '喜糖与伴手礼', '原稿 0.5～1 万', '万'], ['photos', '婚纱照', '原稿 0.8～1.5 万 · 可以晚一点', '万'], ['honeymoon', '蜜月旅行', '原稿 0～4 万 · 不着急出发', '万']],
  'loan-fields': [['fund', '公积金贷款', '实际使用额不超过房价', '万'], ['commercial', '组合贷中的商贷', '不超过房价减去公积金贷款', '万'], ['years', '还款年限', '两种贷款使用相同年限', '年'], ['rate', '公积金年利率', '沿用首套 5 年以上 2.6% 示例', '%'], ['commercialRate', '商业贷款年利率', '3.1% 为测算假设，可调整', '%'], ['offset', '每月公积金抵扣', '两人合计，以实际可抵扣额为准', '元']],
  'prepay-fields': [['prepay', '提前偿还一笔', '仅用于公积金贷款部分', '万'], ['prepayYear', '第几年末提前还', '超过贷款年限时，不产生额外省息', '年']]
};
fields['house-fields'].push(['extraHome', '其他购房支出', '验房等未含在税费里的报价 · 暂按 0', '万']);
fields['renovation-fields'].push(['extraReno', '装修补充项目', '软装、清运、保洁等未包含项 · 暂按 0', '万']);
fields['wedding-fields'].push(['extraWedding', '结婚补充项目', '交通住宿、服装等未包含项 · 暂按 0', '万']);
fields['cash-fields'] = [['cashNow', '现有可动用现金', '两人合计，已经到账的钱', '万'], ['support', '确定会到账的家庭支持', '不含已计入现有现金的部分', '万']];
fields['loan-fields'].push(['incomeA', '一方每月到手收入', '未知可留空，不含公积金与年终奖', '元'], ['incomeB', '另一方每月到手收入', '未知可留空，不含公积金与年终奖', '元']);
fields['tax-fields'] = [['brokerRate', '买方中介费占成交价', '1%仅为试算示例，实际双方协商', '%'], ['registration', '转移登记费用', '住宅登记 80 元/件，按实际办理调整', '元'], ['surchargeRate', '附加占增值税比例', '6%为市区税率与减半优惠组合假设', '%'], ['pitAmount', '实际核定卖方个税', '仅在选择手填税额时使用', '万'], ['taxExtra', '其他交易费用', '评估等按实报价，未发生则为 0', '万']];
fields['schedule-fields'] = [['closingMonth', '第几月过户', '按计划支付首付尾款与税费', '月'], ['moveMonth', '第几月入住', '不能早于过户月', '月'], ['weddingMonth', '第几月安排结婚费用', '按付款较集中的月份模拟', '月'], ['supportMonth', '家庭支持第几月到账', '未到账前不能用来支付', '月'], ['brideReturn', '确定转回小家的彩礼', '默认 0；不能超过彩礼支付额', '万'], ['returnMonth', '彩礼转回的月份', '若实际包含在现有现金中，此处填 0', '月']];
for (const [container, items] of Object.entries(fields)) {
  $(container).innerHTML = items.map(([key, label, hint, unit]) => `<div class="input-row"><label for="field-${key}">${label}<small>${hint}</small></label><div class="number-control"><input id="field-${key}" data-field="${key}" type="number" inputmode="decimal" min="${limits[key][0]}" max="${limits[key][1]}" step="${['years', 'prepayYear', 'offset', 'closingMonth', 'moveMonth', 'weddingMonth', 'supportMonth', 'returnMonth'].includes(key) ? 1 : 'any'}" value="${state[key] ?? ''}" placeholder="待填" aria-label="${label}（${unit}）"><span>${unit}</span></div></div>`).join('');
}
$('split-fields').innerHTML = [['houseShare', '买房与备用'], ['renovationShare', '装修与生活'], ['weddingShare', '其他结婚开销']].map(([key, title]) => `<div class="range-field"><div class="range-top"><label for="field-${key}">${title} · 男方承担</label><output for="field-${key}" id="output-${key}">${state[key]}%</output></div><input type="range" min="0" max="100" step="5" id="field-${key}" data-field="${key}" value="${state[key]}" aria-label="${title}男方承担比例"><div class="range-foot"><span>女方全额</span><span>两人对半</span><span>男方全额</span></div></div>`).join('');

const tasks = [
  ['确认家庭实际可贷额度', '现行首套家庭基本最高额度 200 万，符合补充公积金条件可再增加最高 40 万。240 万不是每个家庭都能贷满，结合缴存、余额等做正式试算。'],
  ['核对房屋持有年限与唯一住房条件', '2026 年起，持有不足 2 年的住房销售增值税征收率为 3%，满 2 年免征。个税另按具体条件核定。'],
  ['拿到一份完整的税费与中介报价', '契税取决于家庭住房套数、面积等条件。卖方税费由谁承担，也要在合同里讲清楚。'],
  ['确认评估价与可贷年限', '房龄、借款人条件和评估结果都可能影响贷款。评估价降低多少，不代表首付就必然增加多少。'],
  ['把付款和放款节点写进合同', '与卖家和贷款机构确认定金、首付、过户和放款的顺序，以及审核不通过的处理方式。'],
  ['确认首付提取和冲还贷办理规则', '提取首付、按月抵扣与提前还本金是不同操作。先向上海公积金中心确认适用条件，再决定办理顺序。'],
  ['装修前，把必要项目和可选项目分开', '优先考虑水电、防水等难以返工的项目。分阶段支付，验收后再进入下一步。'],
  ['和双方家人聊聊结婚安排', '彩礼、三金、见面宴和时间表都提前商量；买房和结婚开销可以错开安排。'],
  ['提前还款前，留足日常现金', '先考虑装修、结婚与应急资金，再比较省息、流动性及其他资金用途。不要把历史投资收益当作未来保证。']
];
$('checklist-items').innerHTML = tasks.map(([title, desc], i) => `<label class="task"><input type="checkbox" data-task="task-${i}" ${state.checks.includes(`task-${i}`) ? 'checked' : ''}><span><strong>${title}</strong><small>${desc}</small></span></label>`).join('');

function setOutput(values) {
  document.querySelectorAll('[data-out]').forEach(el => { if (Object.hasOwn(values, el.dataset.out)) el.textContent = values[el.dataset.out]; });
}
function render() {
  const estimate = taxEstimate(state);
  if (state.taxMode === 'calculated' && estimate.complete) { state.tax = estimate.total; if (document.activeElement !== $('field-tax')) $('field-tax').value = Number(state.tax.toFixed(5)); }
  document.querySelector('label[for="field-rate"] small').textContent = state.years <= 5 ? '首套 ≤5年政策参考 2.1%，请核实后调整' : '首套 >5年政策参考 2.6%，以实际合同为准';
  const b = budget(state);
  const pp = prepayment(b.fund * 10000, state.rate, state.years, state.prepay * 10000, state.prepayYear, state.prepayMode);
  const remaining = pp.remainingMonths ? `${Math.floor(pp.remainingMonths / 12)} 年 ${pp.remainingMonths % 12} 个月` : '已结清';
  const outputs = Object.fromEntries(['price', 'reserve', 'years', 'rate'].map(k => [k, money(state[k])]));
  Object.assign(outputs, Object.fromEntries(['total', 'ready', 'home', 'down', 'renovation', 'wedding'].map(k => [k, money(b[k])])), {
    male: money(b.male, 2), female: money(b.female, 2), payment: yuan(b.payment), outOfPocket: yuan(b.outOfPocket), offset: yuan(state.offset),
    modeLabel: state.mode === 'fund' ? '纯公积金贷款' : '公积金 + 商业组合贷', saved: money(pp.saved / 10000, 2), newPayment: yuan(pp.payment), remaining
  });
  setOutput(outputs);
  const colors = ['#315b48', '#c7d5b9', '#e9bfa3'];
  const groups = [['买房与备用', b.home], ['装修与生活', b.renovation], ['结婚与纪念', b.wedding]];
  const a = b.total > 0 ? b.home / b.total * 100 : 0, c = b.total > 0 ? (b.home + b.renovation) / b.total * 100 : 0;
  $('budget-donut').style.background = b.total ? `conic-gradient(${colors[0]} 0 ${a}%, ${colors[1]} ${a}% ${c}%, ${colors[2]} ${c}% 100%)` : '#e8eddf';
  $('budget-donut').setAttribute('aria-label', groups.map(([label, value]) => `${label}${money(value)}万元`).join('，'));
  $('budget-legend').innerHTML = groups.map(([label, value], i) => `<div class="legend-row"><div class="legend-label"><span class="legend-dot" style="background:${colors[i]}"></span>${label}</div><div class="legend-value"><strong>${money(value)} <small>万</small></strong><small>${b.total ? money(value / b.total * 100) : 0}%</small></div></div>`).join('');
  for (const key of ['houseShare', 'renovationShare', 'weddingShare']) $('output-' + key).textContent = `${state[key]}%`;
  $('male-breakdown').textContent = `买房 ${money(b.home * state.houseShare / 100, 2)} 万 · 装修 ${money(b.renovation * state.renovationShare / 100, 2)} 万 · 结婚 ${money(b.weddingFixed + b.weddingOther * state.weddingShare / 100, 2)} 万`;
  $('female-breakdown').textContent = `买房 ${money(b.home * (100 - state.houseShare) / 100, 2)} 万 · 装修 ${money(b.renovation * (100 - state.renovationShare) / 100, 2)} 万 · 结婚 ${money(b.weddingOther * (100 - state.weddingShare) / 100, 2)} 万`;
  $('split-bar').style.background = `linear-gradient(to right,#315b48 ${b.total ? b.male / b.total * 100 : 0}%,#e9bfa3 0)`;
  const focusedMode = document.activeElement?.dataset?.mode;
  $('loan-options').innerHTML = ['fund', 'combo'].map(mode => {
    const item = budget(state, mode);
    return `<button class="loan-option ${state.mode === mode ? 'selected' : ''}" data-mode="${mode}" aria-pressed="${state.mode === mode}"><div class="option-top"><span>${mode === 'fund' ? '纯公积金贷款' : '公积金 + 商业组合贷'}</span><span class="radio-dot"></span></div><small>现金总预算</small><div class="option-amount">${money(item.total)}<small>万</small></div><div class="option-row"><span>首付款</span><b>${money(item.down)} 万</b></div><div class="option-row"><span>每月还款</span><b>${yuan(item.payment)} 元</b></div><div class="option-row"><span>${state.years} 年总利息</span><b>${money(item.interest / 10000)} 万</b></div><div class="option-foot">公积金 ${money(item.fund)} 万${mode === 'combo' ? ` + 商贷 ${money(item.commercial)} 万` : '<br>多准备首付，减少每月还款'}</div></button>`;
  }).join('');
  if (focusedMode) document.querySelector(`[data-mode="${focusedMode}"]`)?.focus({ preventScroll: true });
  document.querySelectorAll('[data-prepay]').forEach(button => { const active = button.dataset.prepay === state.prepayMode; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  $('prepay-note').textContent = `实际提前偿还 ${money(pp.used / 10000, 2)} 万 · ${state.prepayYear >= state.years ? '所选时间已到贷款期满，不再提前还款' : `在第 ${state.prepayYear} 年末操作，最后一期按实际剩余金额偿还`}`;
  const years = [1, 3, 5, 10, 15].filter(y => y < state.years);
  $('prepay-table').innerHTML = years.length ? years.map(y => `<tr><td>第 ${y} 年末</td>${['term', 'payment'].map(mode => `<td>${money(prepayment(b.fund * 10000, state.rate, state.years, state.prepay * 10000, y, mode).saved / 10000, 2)} 万</td>`).join('')}</tr>`).join('') : '<tr><td colspan="3">当前年限内没有完整年度后的提前还款节点。</td></tr>';
  const count = state.checks.filter(k => Number(k.slice(5)) < tasks.length).length;
  $('check-progress').textContent = `${count} / ${tasks.length} 已完成`;
  renderCashflow(b);
  renderTax(estimate);
}
function renderTax(estimate) {
  const applied = state.taxMode === 'calculated';
  $('tax-estimate').innerHTML = `<div class="tax-result"><span>此情景 · 买方交易费用</span><strong>${estimate.complete ? money(estimate.total, 3) + ' 万' : '条件待确认'}</strong><p>${estimate.complete ? '选择应用后，将替换上方综合税费，并随房价与已选条件联动。' : '还需确认：' + estimate.missing.join('、') + '。'}${applied && !estimate.complete ? ' 当前保留上次已应用金额，请补全后继续计算。' : ''}</p><button class="button primary" id="apply-tax" ${!estimate.complete ? 'disabled' : ''}>${applied && estimate.complete ? '已联动到预算 ✓' : '应用到购房预算'}</button></div><div class="tax-breakdown">${estimate.complete ? `契税 <strong>${money(estimate.deed, 3)} 万</strong><br>买方中介费 <strong>${money(estimate.broker, 3)} 万</strong> · 登记 <strong>${yuan(state.registration)} 元</strong><br>额外承担卖方税费 <strong>${money(estimate.sellerTaxes, 3)} 万</strong>${state.sellerBurden === 'buyer' ? `<br>其中增值税 ${money(estimate.vat, 3)} + 附加 ${money(estimate.surcharge, 3)} + 个税 ${money(estimate.pit, 3)} 万` : ''}<br>其他交易费用 <strong>${money(state.taxExtra, 3)} 万</strong>` : `先看契税差别：假设卖方满二免增值税，当前 ${money(state.price)} 万房价<br>面积 ≤140㎡：<strong>${money(state.price * .01, 2)} 万</strong><br>面积 >140㎡：<strong>${money(state.price * .015, 2)} 万</strong><br>卖方税费、中介费等需单独确认，不能把这个数当交易总费用。`}<p class="field-note">当前预算中的综合交易费：${money(state.tax, 3)} 万 · ${applied && estimate.complete ? '按情景联动' : '手填 / 保留估算'}。手动改上方税费后会取消联动。</p></div>`;
  document.querySelectorAll('[data-choice]').forEach(input => { input.value = state[input.dataset.choice]; });
}
function renderCashflow(b) {
  const c = cashflow(state);
  const missingLabels = c.missing.map(key => Object.values(fields).flat().find(item => item[0] === key)?.[1] || key);
  const resultCard = (title, value, detail) => `<article class="card cash-result"><span>${title}</span><strong>${value}</strong><p>${detail}</p></article>`;
  $('cash-results').innerHTML = resultCard('一次性资金总需求', `${money(b.total)} <small>万</small>`, '含购房备用，不含未来房贷本息与生活支出。')
    + resultCard('执行计划前需有现金', c.required === null ? '待填写' : `${money(c.required, 2)} <small>万</small>`, '结合支持与彩礼返还的到账月份，确保各付款节点不动用购房备用。')
    + resultCard('当前一次性资金缺口', c.gap === null ? '待填写' : `${money(c.gap, 2)} <small>万</small>`, '只比较当前现金和本页一次性计划；不等同于整体财务是否安全。');
  $('overview-readiness').textContent = c.missing.length ? '可用现金仍在商量，可以先看预算与分摊。工资和月供单独算，生活支出这轮暂未纳入。' : `当前一次性计划资金缺口 ${money(c.gap, 2)} 万；月供与生活支出另行安排，不用未来工资填平这里的缺口。`;
  const totalIncome = state.incomeA === null || state.incomeB === null ? null : state.incomeA + state.incomeB;
  $('income-results').innerHTML = totalIncome === null ? '<p class="field-note">填入双方到手收入后，查看月供占比与还贷后收入余量。未知可留空，不采用虚构收入。</p>' : `<div class="income-metrics"><div><span>合同月供 / 到手收入</span><strong>${totalIncome > 0 ? money(b.payment / totalIncome * 100) + '%' : '无收入'}</strong></div><div><span>公积金抵扣后 / 到手收入</span><strong>${totalIncome > 0 ? money(b.outOfPocket / totalIncome * 100) + '%' : '无收入'}</strong></div><div><span>还贷后收入余量</span><strong>${yuan(totalIncome - b.outOfPocket)}<small> 元</small></strong></div></div><p class="field-note">未扣生活费、其他负债及年度支出，不等于每月可储蓄金额。若公积金抵扣停止，需多留 ${yuan(Math.min(b.payment, state.offset))} 元 / 月。</p>`;
  const extraCash = Math.max(0, b.fund - 200);
  const reduced = budget({ ...state, fund: Math.min(state.fund, 200) });
  const overrun = state.renovation * .1;
  $('stress-cases').innerHTML = `<div class="analysis-item"><span class="tag">额度变少</span><h3>公积金只能贷到 200 万</h3><p>按当前房价与商贷设置，需多准备 ${money(reduced.down - b.down)} 万首付，月供变为 ${yuan(reduced.payment)} 元。${extraCash > 0 ? '如果增加商贷补缺口，要同时重算月供。' : '当前公积金使用额不高于 200 万，此情景不增加首付。'}200 万仍只是情景，实际可贷额也可能更低。</p></div><div class="analysis-item"><span class="tag">装修超支</span><h3>硬装比报价多 10%</h3><p>追加 ${money(overrun)} 万；若由购房备用金覆盖，会剩 ${money(Math.max(0, state.reserve - overrun))} 万备用${overrun > state.reserve ? `，还缺 ${money(overrun - state.reserve)} 万` : ''}。这是压力测试，不再把同一笔费用叠加到已含备用的预算里。</p></div><div class="analysis-item"><span class="tag">收入中断</span><h3>公积金暂时不能抵扣月供</h3><p>届时每月需用现金支付完整月供 ${yuan(b.payment)} 元，比当前抵扣假设多 ${yuan(Math.min(b.payment, state.offset))} 元。账户余额不足或入账中断时，要有另一笔钱接住。</p></div>`;
  if (c.missing.length) {
    $('cash-chart').innerHTML = `<div class="empty-state"><span data-empty-icon>↗</span><h3>现金还在商量，也可以先看预算</h3><p>待填写：${missingLabels.join('、')}。</p><small>没有的项目请填 0；留空表示尚不清楚。</small></div>`;
    $('cash-table').innerHTML = '<tr><td colspan="5">填入可用现金和确定的家庭支持后显示；没有支持请填 0。</td></tr>';
    return;
  }
  const max = Math.max(1, ...c.rows.map(row => Math.abs(row.free)));
  $('cash-chart').innerHTML = `<div class="chart-heading"><h3>每月可安排余额</h3><span>${c.tightest ? `第 ${c.tightest} 月最紧` : '起步时资金要求最高'} · 已扣除购房备用</span></div><div class="cash-bars">${c.rows.map(row => `<div class="cash-bar-column"><span>${money(row.free)}</span><div class="cash-bar-track"><i class="${row.free < 0 ? 'negative' : ''}" style="height:${Math.max(3, Math.abs(row.free) / max * 100)}%"></i></div><small>${row.month} 月</small></div>`).join('')}</div><p class="field-note">每根柱高表示余额绝对值，负余额以橙色标示；具体数值见下表。</p>`;
  $('cash-table').innerHTML = c.rows.map(row => `<tr><td>第 ${row.month} 月<small>${row.events.join(' · ') || '无一次性付款'}</small></td><td>${money(row.income, 2)}</td><td>${money(row.out, 2)}</td><td>${money(row.balance, 2)}</td><td class="${row.free < 0 ? 'negative-number' : ''}">${money(row.free, 2)}</td></tr>`).join('');
}
function syncInputs() {
  document.querySelectorAll('[data-field]').forEach(input => { input.value = state[input.dataset.field] ?? ''; });
  document.querySelectorAll('[data-task]').forEach(input => { input.checked = state.checks.includes(input.dataset.task); });
  document.querySelectorAll('[data-choice]').forEach(input => { input.value = state[input.dataset.choice]; });
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, plan: state })); storageAvailable = true; }
  catch { storageAvailable = false; }
  $('save-status').textContent = storageAvailable ? '已保存到本机浏览器' : '未能本地保存，请导出备份';
}
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500); }
document.querySelectorAll('[data-field]').forEach(input => {
  input.addEventListener('input', () => {
    const number = Number(input.value);
    if (input.value === '' && personalKeys.includes(input.dataset.field)) { state[input.dataset.field] = null; render(); save(); return; }
    if (input.value === '' || !Number.isFinite(number)) return;
    state = sanitize({ ...state, [input.dataset.field]: number });
    if (input.dataset.field === 'tax') state.taxMode = 'manual';
    render(); save();
  });
  input.addEventListener('change', () => { syncInputs(); });
  input.addEventListener('blur', () => { input.value = state[input.dataset.field] ?? ''; });
});
document.querySelectorAll('[data-choice]').forEach(input => input.addEventListener('change', () => { state[input.dataset.choice] = input.value; render(); save(); }));
$('tax-estimate').addEventListener('click', event => { if (!event.target.closest('#apply-tax') || !taxEstimate(state).complete) return; state.taxMode = 'calculated'; render(); save(); toast('交易费用已替换原估算，并随房价与条件联动'); });
$('loan-options').addEventListener('click', event => { const button = event.target.closest('[data-mode]'); if (!button) return; state.mode = button.dataset.mode; render(); save(); toast('贷款方案已更新，预算和分摊已同步'); });
document.querySelectorAll('[data-prepay]').forEach(button => button.addEventListener('click', () => { state.prepayMode = button.dataset.prepay; render(); save(); }));
document.querySelectorAll('[data-task]').forEach(input => input.addEventListener('change', () => { state.checks = input.checked ? [...new Set([...state.checks, input.dataset.task])] : state.checks.filter(x => x !== input.dataset.task); render(); save(); }));
$('simple-button').addEventListener('click', () => { state.renovation = 15; state.furniture = 4; state.appliances = 3; syncInputs(); render(); save(); toast('已应用轻装修：硬装 15 万，家具家电 7 万'); });
$('reset-button').addEventListener('click', () => $('reset-dialog').showModal());
$('reset-dialog').addEventListener('close', () => { if ($('reset-dialog').returnValue !== 'reset') return; state = sanitize(defaults); syncInputs(); render(); save(); toast('已恢复示例计划'); });
$('export-button').addEventListener('click', () => {
  const payload = { app: 'our-home', version: 1, exportedAt: new Date().toISOString(), plan: state };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `我们的家-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('已导出计划，可以带去另一台设备');
});
$('import-button').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 100000) throw new Error('文件过大');
    const data = JSON.parse(await file.text());
    if (data.app !== 'our-home' || data.version !== 1 || !data.plan || typeof data.plan !== 'object' || Array.isArray(data.plan)) throw new Error('格式不匹配');
    for (const [key, [min, max]] of Object.entries(limits)) {
      if (personalKeys.includes(key) && data.plan[key] === null) continue;
      if (typeof data.plan[key] !== 'number' || !Number.isFinite(data.plan[key]) || data.plan[key] < min || data.plan[key] > max) throw new Error('预算字段不完整或超出范围');
    }
    if (!['fund', 'combo'].includes(data.plan.mode) || !['term', 'payment'].includes(data.plan.prepayMode) || !Array.isArray(data.plan.checks)) throw new Error('计划格式不完整');
    for (const [key, options] of Object.entries(choices)) if (!options.includes(data.plan[key])) throw new Error('情景字段不完整');
    state = sanitize(data.plan); syncInputs(); render(); save(); toast('计划已导入，预算和待办已恢复');
  } catch { toast('导入失败，请选择由本站导出的有效 JSON 计划文件'); }
  event.target.value = '';
});
$('print-button').addEventListener('click', () => window.print());

const pages = { overview: '计划总览', budget: '预算与分摊', loans: '房贷小算盘', cashflow: '现金与底气', checklist: '安家备忘录' };
function navigate() {
  const requested = location.hash.slice(1);
  const page = Object.hasOwn(pages, requested) ? requested : 'overview';
  document.querySelectorAll('.page').forEach(section => { section.hidden = section.id !== page; });
  document.querySelectorAll('[data-page]').forEach(link => { const active = link.dataset.page === page; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  $('page-name').textContent = pages[page]; document.title = `${pages[page]} · 我们的家`;
  window.scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', navigate);
$('save-status').textContent = storageAvailable ? '计划保存在本机浏览器' : '未能读取存档，请导出备份';
render(); navigate();
