import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, sanitize, monthly, budget, cashflow, prepayment, taxEstimate, payroll, payrollSummary } from '../assets/model.js';
const close = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≠ ${b}`);

test('原稿预算按项目求和，分摊守恒', () => {
  const b = budget(defaults);
  close(b.total, 250.3); close(b.ready, 172.3); close(b.wedding, 24);
  close(b.male, 135.15); close(b.female, 115.15); close(b.male + b.female, b.total);
  for (const share of [0, 25, 50, 100]) {
    const x = budget({ ...defaults, houseShare: share, renovationShare: 100 - share, weddingShare: share });
    close(x.male + x.female, x.total);
  }
});
test('组合贷释放现金，增加的月供只来自商贷', () => {
  const pure = budget(defaults), combo = budget(defaults, 'combo');
  close(pure.total - combo.total, 100);
  close(combo.payment - pure.payment, monthly(1000000, 3.1, 360));
});
test('固定贷款额时降价直接减少首付；贷款不能超过房价', () => {
  close(budget({ ...defaults, price: 380 }).down, 140);
  const small = budget({ ...defaults, price: 200 }, 'combo');
  close(small.down, 0); close(small.fund, 200); close(small.commercial, 0);
});
test('提前还款以独立逐月本金与利息结果核对', () => {
  const p = 2400000, rate = .026 / 12, payment = monthly(p, 2.6, 360);
  let balance = p, interest = 0, months = 0;
  while (balance > 1e-7 && months < 360) {
    interest += balance * rate;
    balance = Math.max(0, balance * (1 + rate) - payment);
    months++;
    if (months === 36) balance -= 500000;
  }
  const result = prepayment(p, 2.6, 30, 500000, 3, 'term');
  close(result.interest, interest, .001);
  assert.equal(result.remainingMonths, months - 36);
  assert.ok(result.saved > 400000 && result.saved < 420000);
});
test('零利率、全额结清、贷款到期、不提前还款边界', () => {
  for (const mode of ['term', 'payment']) {
    const zero = prepayment(120000, 0, 10, 30000, 2, mode);
    close(zero.saved, 0); assert.ok(Number.isFinite(zero.payment)); assert.ok(zero.remainingMonths >= 0);
    const all = prepayment(120000, 2.6, 10, 500000, 2, mode);
    assert.equal(all.remainingMonths, 0); close(all.payment, 0); assert.ok(all.used < 120000);
    const late = prepayment(120000, 2.6, 10, 30000, 20, mode);
    close(late.saved, 0); close(late.used, 0); assert.equal(late.remainingMonths, 0);
    const none = prepayment(120000, 2.6, 10, 0, 2, mode);
    close(none.saved, 0); assert.equal(none.remainingMonths, 96);
    assert.deepEqual(prepayment(0, 0, 10, 50000, 3, mode).remainingMonths, 0);
  }
});
test('同条件下缩年限更省息，早还比晚还省息', () => {
  const early = prepayment(2400000, 2.6, 30, 500000, 1, 'term');
  const late = prepayment(2400000, 2.6, 30, 500000, 10, 'term');
  const lower = prepayment(2400000, 2.6, 30, 500000, 1, 'payment');
  assert.ok(early.saved > late.saved); assert.ok(early.saved > lower.saved);
  assert.ok(lower.payment < monthly(2400000, 2.6, 360));
});
test('不信任的存储数据不能带来非数值、负数或无限预算', () => {
  const x = sanitize({ price: -3, years: 100, rate: Infinity, reserve: 'oops', mode: 'bad', checks: ['task-1', 'task-1', '<script>'] });
  assert.equal(x.price, 0); assert.equal(x.years, 30); assert.equal(x.rate, defaults.rate); assert.equal(x.reserve, defaults.reserve); assert.equal(x.mode, 'fund');
  assert.deepEqual(x.checks, ['task-1']);
  assert.ok(Number.isFinite(budget(x).total));
});
test('未知现金不当作零；收入不补贴一次性资金缺口', () => {
  assert.equal(cashflow(defaults).gap, null);
  const s = { ...defaults, cashNow: 240, support: 0 };
  close(cashflow(s).gap, 10.3);
  close(cashflow({ ...s, incomeA: 100000, incomeB: 100000 }).gap, 10.3);
});
test('税前收入估算税后到手与公积金账户入账', () => {
  const one = payroll(20000, null, 0, 7, 7);
  close(one.social, 2100); close(one.employeeFund, 1400); close(one.employerFund, 1400);
  close(one.tax, 940); close(one.net, 15560); close(one.fundDeposit, 2800);
  const summary = payrollSummary({ ...defaults, grossA: 20000, grossB: 10000 });
  assert.equal(summary.grossTotal, 30000);
  assert.equal(summary.fundDeposit, 4200);
  close(budget({ ...defaults, grossA: 20000, grossB: 10000 }).offset, 4200);
});
test('付款总额守恒，定金不重复，备用金只扣一次', () => {
  for (const closingMonth of [1, 2, 12]) {
    const s = sanitize({ ...defaults, cashNow: 250.3, support: 0, closingMonth, moveMonth: closingMonth });
    const flow = cashflow(s);
    close(flow.rows.reduce((sum, row) => sum + row.out, 0), budget(s).total - s.reserve);
    close(flow.required, budget(s).total); close(flow.gap, 0); close(flow.rows.at(-1).free, 0);
  }
});
test('迟到账支持不能填平早期首付缺口；彩礼回流不消除先付款', () => {
  const base = { ...defaults, cashNow: 0, support: 100 };
  const early = cashflow({ ...base, supportMonth: 1 });
  const late = cashflow({ ...base, supportMonth: 12 });
  assert.ok(late.required > early.required);
  const returned = cashflow({ ...base, support: 0, brideReturn: 14, returnMonth: 7 });
  close(returned.required, 250.3);
  close(returned.end, -(250.3 - 12 - 14));
});
test('首套契税面积分档，满五唯一，无卖方税额', () => {
  const s = { ...defaults, areaBand: 'small', sellerStatus: 'unique', sellerBurden: 'buyer' };
  const t = taxEstimate(s);
  assert.equal(t.complete, true); close(t.deed, 4); close(t.sellerTaxes, 0); close(t.total, 8.008);
  close(taxEstimate({ ...s, areaBand: 'large' }).deed, 6);
  assert.equal(taxEstimate(defaults).complete, false);
});
test('不足两年含税价正确还原税基，卖方税不默认转嫁', () => {
  const s = { ...defaults, areaBand: 'small', sellerStatus: 'under2', sellerBurden: 'buyer', pitMode: 'assessed' };
  const t = taxEstimate(s);
  close(t.net, 400 / 1.03); close(t.vat, 400 / 1.03 * .03); close(t.surcharge, t.vat * .06); close(t.pit, t.net * .01);
  const seller = taxEstimate({ ...s, sellerBurden: 'seller' });
  close(t.total - seller.total, t.sellerTaxes);
  assert.equal(taxEstimate({ ...s, pitMode: 'unknown' }).complete, false);
  close(taxEstimate({ ...s, pitMode: 'manual', pitAmount: 15 }).pit, 15);
});
test('税费应用后房价变化联动总额，付款计划不再用旧税费', () => {
  const s = { ...defaults, cashNow: 250, support: 0, taxMode: 'calculated', areaBand: 'small', sellerStatus: 'unique', sellerBurden: 'seller' };
  close(budget(s).tax, 8.008);
  close(budget({ ...s, price: 380 }).tax, 7.608);
  close(cashflow(s).rows.reduce((sum, r) => sum + r.out, 0), budget(s).total - s.reserve);
});
