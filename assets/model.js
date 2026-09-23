export const defaults = Object.freeze({
  price: 400, fund: 240, commercial: 100, mode: 'fund', tax: 12.3, reserve: 12,
  renovation: 30, furniture: 5.5, appliances: 4.5, moving: 2,
  bride: 14, gold: 4, ring: 2, dinner: 1.5, gifts: 0.5, candy: 0.5, photos: 1.5, honeymoon: 0,
  houseShare: 50, renovationShare: 50, weddingShare: 50,
  years: 30, rate: 2.6, commercialRate: 3.1, offset: 5000,
  prepay: 50, prepayYear: 3, prepayMode: 'term', checks: [],
  extraHome: 0, extraReno: 0, extraWedding: 0,
  cashNow: null, support: null, grossA: null, grossB: null, fundBaseA: null, fundBaseB: null, specialA: 0, specialB: 0,
  fundRate: 7, employerFundRate: 7,
  closingMonth: 2, moveMonth: 6, weddingMonth: 6, supportMonth: 1, brideReturn: 0, returnMonth: 7,
  taxMode: 'manual', areaBand: 'unknown', sellerStatus: 'unknown', sellerBurden: 'unknown', pitMode: 'unknown', pitAmount: null,
  brokerRate: 1, registration: 80, taxExtra: 0, surchargeRate: 6
});
export const limits = {
  price: [0, 10000], fund: [0, 10000], commercial: [0, 10000],
  tax: [0, 1000], reserve: [0, 1000], renovation: [0, 1000], furniture: [0, 1000], appliances: [0, 1000], moving: [0, 1000],
  bride: [0, 1000], gold: [0, 1000], ring: [0, 1000], dinner: [0, 1000], gifts: [0, 1000], candy: [0, 1000], photos: [0, 1000], honeymoon: [0, 1000],
  houseShare: [0, 100], renovationShare: [0, 100], weddingShare: [0, 100],
  years: [1, 30], rate: [0, 20], commercialRate: [0, 20], offset: [0, 100000], prepay: [0, 10000], prepayYear: [1, 30],
  extraHome: [0, 1000], extraReno: [0, 1000], extraWedding: [0, 1000],
  cashNow: [0, 10000], support: [0, 10000], grossA: [0, 1000000], grossB: [0, 1000000], fundBaseA: [2740, 37731], fundBaseB: [2740, 37731], specialA: [0, 100000], specialB: [0, 100000], fundRate: [0, 24], employerFundRate: [0, 24],
  closingMonth: [1, 12], moveMonth: [1, 12], weddingMonth: [1, 12], supportMonth: [1, 12], brideReturn: [0, 1000], returnMonth: [1, 12],
  brokerRate: [0, 10], registration: [0, 10000], taxExtra: [0, 1000], surchargeRate: [0, 12], pitAmount: [0, 1000]
};
export const personalKeys = ['cashNow', 'support', 'grossA', 'grossB', 'fundBaseA', 'fundBaseB', 'pitAmount'];
export const choices = { taxMode: ['manual', 'calculated'], areaBand: ['unknown', 'small', 'large'], sellerStatus: ['unknown', 'under2', 'over2', 'unique'], sellerBurden: ['unknown', 'buyer', 'seller'], pitMode: ['unknown', 'assessed', 'manual'] };
export function sanitize(raw) {
  const s = { ...defaults, checks: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) s[key] = Math.min(max, Math.max(min, raw[key]));
  }
  for (const key of ['years', 'prepayYear', 'closingMonth', 'moveMonth', 'weddingMonth', 'supportMonth', 'returnMonth']) s[key] = Math.round(s[key]);
  s.moveMonth = Math.max(s.closingMonth, s.moveMonth);
  s.brideReturn = Math.min(s.brideReturn, s.bride);
  s.returnMonth = Math.max(s.weddingMonth, s.returnMonth);
  if (['fund', 'combo'].includes(raw.mode)) s.mode = raw.mode;
  if (['term', 'payment'].includes(raw.prepayMode)) s.prepayMode = raw.prepayMode;
  for (const [key, options] of Object.entries(choices)) if (options.includes(raw[key])) s[key] = raw[key];
  if (Array.isArray(raw.checks)) s.checks = [...new Set(raw.checks.filter(x => typeof x === 'string' && /^task-\d+$/.test(x)))].slice(0, 30);
  return s;
}
export function monthly(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 1200;
  return r === 0 ? principal / months : principal * r / -Math.expm1(-months * Math.log1p(r));
}
export function loan(principal, rate, years) {
  const payment = monthly(principal, rate, years * 12);
  return { principal, payment, interest: Math.max(0, payment * years * 12 - principal), total: payment * years * 12 };
}

// Shanghai employee social-insurance contribution limits for 2026-07 to 2027-06.
// Housing-fund rates and bases remain editable because the actual wage base follows
// the employee's previous-year average wage. The fallback range uses Shanghai's
// 2026-07 to 2027-06 limits for an ordinary employed worker.
const SOCIAL_RATE = 0.105;
const SOCIAL_BASE_MIN = 7546;
const SOCIAL_BASE_MAX = 37731;
const FUND_BASE_MIN = 2740;
const FUND_BASE_MAX = 37731;
const TAX_BRACKETS = [[36000, .03, 0], [144000, .1, 2520], [300000, .2, 16920], [420000, .25, 31920], [660000, .3, 52920], [960000, .35, 85920], [Infinity, .45, 181920]];

export function annualIncomeTax(taxable) {
  const value = Math.max(0, taxable);
  const [, rate, quick] = TAX_BRACKETS.find(([upper]) => value <= upper);
  return Math.max(0, value * rate - quick);
}

export function payroll(gross, fundBase, special, fundRate, employerFundRate) {
  if (gross === null || !Number.isFinite(gross)) return null;
  const socialBase = Math.min(SOCIAL_BASE_MAX, Math.max(SOCIAL_BASE_MIN, gross));
  const base = Math.min(FUND_BASE_MAX, Math.max(FUND_BASE_MIN, fundBase === null || !Number.isFinite(fundBase) ? gross : fundBase));
  const employeeFund = base * fundRate / 100;
  const employerFund = base * employerFundRate / 100;
  const social = socialBase * SOCIAL_RATE;
  const annualTaxable = Math.max(0, (gross - social - employeeFund) * 12 - Math.max(0, special) * 12 - 60000);
  const tax = annualIncomeTax(annualTaxable) / 12;
  return {
    gross, socialBase, social, fundBase: base, employeeFund, employerFund,
    fundDeposit: employeeFund + employerFund, annualTaxable, tax,
    net: Math.max(0, gross - social - employeeFund - tax)
  };
}

export function payrollSummary(s) {
  const a = payroll(s.grossA, s.fundBaseA, s.specialA, s.fundRate, s.employerFundRate);
  const b = payroll(s.grossB, s.fundBaseB, s.specialB, s.fundRate, s.employerFundRate);
  const people = [a, b].filter(Boolean);
  if (!people.length) return null;
  return { a, b, complete: Boolean(a && b), knownCount: people.length, grossTotal: people.reduce((sum, item) => sum + item.gross, 0), netTotal: people.reduce((sum, item) => sum + item.net, 0), fundDeposit: people.reduce((sum, item) => sum + item.fundDeposit, 0) };
}

export function budget(s, mode = s.mode) {
  const estimated = s.taxMode === 'calculated' ? taxEstimate(s) : null;
  const tax = estimated?.complete ? estimated.total : s.tax;
  const fund = Math.min(s.price, s.fund);
  const commercial = mode === 'combo' ? Math.min(Math.max(0, s.price - fund), s.commercial) : 0;
  const down = s.price - fund - commercial;
  const home = down + tax + s.reserve + s.extraHome;
  const renovation = s.renovation + s.furniture + s.appliances + s.moving + s.extraReno;
  const weddingFixed = s.bride + s.gold + s.ring;
  const weddingOther = s.dinner + s.gifts + s.candy + s.photos + s.honeymoon + s.extraWedding;
  const wedding = weddingFixed + weddingOther;
  const total = home + renovation + wedding;
  const male = weddingFixed + home * s.houseShare / 100 + renovation * s.renovationShare / 100 + weddingOther * s.weddingShare / 100;
  const loans = [loan(fund * 10000, s.rate, s.years), loan(commercial * 10000, s.commercialRate, s.years)];
  const payment = loans.reduce((a, x) => a + x.payment, 0);
  const payrollResult = payrollSummary(s);
  const fundDeposit = payrollResult?.complete ? payrollResult.fundDeposit : s.offset;
  const offset = Math.min(payment, fundDeposit);
  return { down, fund, commercial, home, renovation, wedding, weddingFixed, weddingOther, total, male, female: total - male, tax, ready: down + tax + s.extraHome, payment, interest: loans.reduce((a, x) => a + x.interest, 0), offset, fundDeposit, outOfPocket: Math.max(0, payment - offset), payroll: payrollResult };
}
// P is the stated VAT-inclusive transaction value, not the seller's net proceeds.
// Contractual assumption of seller taxes is a separate cash item, not a gross-up.
export function taxEstimate(s) {
  const missing = [];
  if (s.areaBand === 'unknown') missing.push('建筑面积档位');
  if (s.sellerStatus === 'unknown') missing.push('卖方持有条件');
  if (s.sellerBurden === 'unknown') missing.push('卖方税费承担方');
  const net = s.sellerStatus === 'under2' ? s.price / 1.03 : s.price;
  const vat = s.sellerStatus === 'under2' ? net * .03 : 0;
  const surcharge = vat * s.surchargeRate / 100;
  const deed = net * (s.areaBand === 'large' ? .015 : .01);
  let pit = 0;
  if (s.sellerBurden === 'buyer' && s.sellerStatus !== 'unique') {
    if (s.pitMode === 'assessed') pit = net * .01;
    else if (s.pitMode === 'manual' && s.pitAmount !== null) pit = s.pitAmount;
    else missing.push('卖方个税计征方式 / 金额');
  }
  const broker = s.price * s.brokerRate / 100;
  const sellerTaxes = s.sellerBurden === 'buyer' ? vat + surcharge + pit : 0;
  return { complete: missing.length === 0, missing, net, vat, surcharge, deed, pit, broker, sellerTaxes,
    total: deed + broker + s.registration / 10000 + s.taxExtra + sellerTaxes };
}
export function cashflow(s) {
  const missing = ['cashNow', 'support'].filter(key => s[key] === null);
  const b = budget(s);
  if (missing.length) return { missing, rows: [], required: null, gap: null };
  let cumulative = 0, minimum = 0, tightest = 0;
  const rows = [];
  const deposit = Math.min(10, b.down);
  const returnAmount = Math.min(s.brideReturn, s.bride);
  for (let month = 1; month <= 12; month++) {
    const support = month === s.supportMonth ? s.support : 0;
    const returned = month === s.returnMonth ? returnAmount : 0;
    let expense = 0; const events = [];
    if (month === 1 && deposit > 0) { expense += deposit; events.push('定金'); }
    if (month === s.closingMonth) { expense += b.down - deposit + b.tax + s.extraHome; events.push('首付尾款与交易费'); }
    const construction = s.renovation + s.extraReno;
    const middleMonth = Math.min(s.moveMonth, s.closingMonth + 1);
    if (month === s.closingMonth) { expense += construction * .3; events.push('装修首款 30%'); }
    if (month === middleMonth) { expense += construction * .4; events.push('装修进度款 40%'); }
    if (month === s.moveMonth) { expense += construction * .3 + s.furniture + s.appliances + s.moving; events.push('装修尾款、家具家电与搬家'); }
    if (month === s.weddingMonth) { expense += b.wedding; events.push('结婚开销'); }
    if (support > 0) events.push('家庭支持到账');
    if (returned > 0) events.push('彩礼转回小家');
    cumulative += support + returned - expense;
    if (cumulative < minimum) { minimum = cumulative; tightest = month; }
    rows.push({ month, events, income: support + returned, out: expense, expense, balance: s.cashNow + cumulative, free: s.cashNow + cumulative - s.reserve });
  }
  const required = -minimum + s.reserve;
  return { missing, rows, required, gap: Math.max(0, required - s.cashNow), tightest, end: rows.at(-1).balance };
}
// Prepayment occurs immediately after the selected year's final scheduled payment.
// Simulate actual monthly payments, including the last partial payment.
export function prepayment(principal, annualRate, years, amount, atYear, mode) {
  const base = loan(principal, annualRate, years);
  const n = Math.round(years * 12), k = Math.min(n, Math.max(0, Math.round(atYear * 12)));
  const r = annualRate / 1200;
  let balance = principal, interest = 0;
  for (let i = 0; i < k && balance > 1e-7; i++) {
    const fee = balance * r;
    interest += fee; balance = Math.max(0, balance + fee - base.payment);
  }
  const used = Math.min(balance, Math.max(0, amount));
  balance -= used;
  const payment = balance <= 1e-7 ? 0 : mode === 'payment' ? monthly(balance, annualRate, n - k) : base.payment;
  let remainingMonths = 0;
  for (; remainingMonths < n - k && balance > 1e-7; remainingMonths++) {
    const fee = balance * r;
    interest += fee; balance = Math.max(0, balance + fee - payment);
  }
  return { saved: Math.max(0, base.interest - interest), interest, payment, remainingMonths, used, elapsedMonths: k };
}
