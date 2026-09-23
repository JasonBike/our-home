import { createServer } from 'node:http';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const dataDir = join(root, 'data');
const storeFile = join(dataDir, 'store.json');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8788);
const sessions = new Map();
const loginAttempts = new Map();
const sessionAge = 7 * 24 * 60 * 60 * 1000;
let store = { version: 1, users: {} };

const json = (res, status, value, headers = {}) => {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
};
const fail = (res, status, error) => json(res, status, { error });
const now = () => new Date().toISOString();
const b64 = value => Buffer.from(value).toString('base64url');
const fromB64 = value => Buffer.from(value, 'base64url');

async function loadStore() {
  await mkdir(dataDir, { recursive: true });
  try { store = JSON.parse(await readFile(storeFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await saveStore(); }
  if (!store.users || typeof store.users !== 'object') throw new Error('数据文件格式错误');
}
async function saveStore() {
  await mkdir(dataDir, { recursive: true });
  const temporary = `${storeFile}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(store), { mode: 0o600 });
  await rename(temporary, storeFile);
}
function readCookie(request, name) {
  const cookies = request.headers.cookie || '';
  return cookies.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}
function setSession(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionAge / 1000}${secure}`);
}
function clearSession(res) { res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); }
function passwordRecord(password, salt = randomBytes(16)) { return { salt: b64(salt), hash: b64(scryptSync(password, salt, 64)) }; }
function passwordMatches(password, record) {
  const actual = scryptSync(password, fromB64(record.salt), 64);
  const expected = fromB64(record.hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function dataKey(password, salt) { return scryptSync(password, fromB64(salt), 32); }
function encrypt(key, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { iv: b64(iv), tag: b64(cipher.getAuthTag()), ciphertext: b64(ciphertext) };
}
function decrypt(key, value) {
  const decipher = createDecipheriv('aes-256-gcm', key, fromB64(value.iv));
  decipher.setAuthTag(fromB64(value.tag));
  return JSON.parse(Buffer.concat([decipher.update(fromB64(value.ciphertext)), decipher.final()]).toString('utf8'));
}
function userView(user) { return { id: user.id, username: user.username }; }
function sessionUser(request) {
  const token = readCookie(request, 'session');
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); return null; }
  session.expiresAt = Date.now() + sessionAge;
  return { token, session, user: store.users[session.userId] };
}
async function body(request) {
  let text = '';
  for await (const chunk of request) { text += chunk; if (text.length > 2_000_000) throw new Error('请求过大'); }
  try { return text ? JSON.parse(text) : {}; } catch { throw new Error('请求格式错误'); }
}
function validateCredentials(input) {
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (!/^[^\s]{2,64}$/.test(username)) throw new Error('账号名需要 2～64 个非空格字符');
  if (password.length < 8 || password.length > 200) throw new Error('密码需要 8～200 个字符');
  return { username, password };
}
function loginKey(request, username) { return `${request.socket.remoteAddress || 'unknown'}:${username}`; }
function checkLoginRate(key) {
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.until > Date.now() && attempt.count >= 5) throw new Error('登录尝试过多，请稍后再试');
  if (attempt && attempt.until <= Date.now()) loginAttempts.delete(key);
}
function recordLoginFailure(key) {
  const current = loginAttempts.get(key);
  if (!current || current.until <= Date.now()) loginAttempts.set(key, { count: 1, until: Date.now() + 60_000 });
  else current.count += 1;
}
function profileView(key, encrypted) {
  const profile = decrypt(key, encrypted);
  return { id: profile.id, name: profile.name, createdAt: profile.createdAt, updatedAt: profile.updatedAt };
}
function allProfiles(auth) { return Object.values(auth.user.profiles || {}).map(value => profileView(auth.session.key, value)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
async function requireAuth(request, res) {
  const auth = sessionUser(request);
  if (!auth || !auth.user) { fail(res, 401, '未登录'); return null; }
  return auth;
}
function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('计划格式错误');
  const serialized = JSON.stringify(plan);
  if (serialized.length > 500_000) throw new Error('计划内容过大');
  return plan;
}
async function apiHandler(request, res, url) {
  const path = url.pathname.slice('/api'.length) || '/';
  try {
    if (path === '/auth/register' && request.method === 'POST') {
      const { username, password } = validateCredentials(await body(request));
      if (Object.values(store.users).some(user => user.username === username)) return fail(res, 409, '这个账号已经存在');
      const passwordInfo = passwordRecord(password);
      const user = { id: randomUUID(), username, passwordSalt: passwordInfo.salt, passwordHash: passwordInfo.hash, dataSalt: b64(randomBytes(16)), profiles: {} };
      store.users[user.id] = user;
      const token = b64(randomBytes(32));
      sessions.set(token, { userId: user.id, key: dataKey(password, user.dataSalt), expiresAt: Date.now() + sessionAge });
      await saveStore(); setSession(res, token); return json(res, 201, { user: userView(user), profiles: [] });
    }
    if (path === '/auth/login' && request.method === 'POST') {
      const { username, password } = validateCredentials(await body(request));
      const attemptKey = loginKey(request, username); checkLoginRate(attemptKey);
      const user = Object.values(store.users).find(item => item.username === username);
      if (!user || !passwordMatches(password, { salt: user.passwordSalt, hash: user.passwordHash })) { recordLoginFailure(attemptKey); return fail(res, 401, '账号或密码不正确'); }
      loginAttempts.delete(attemptKey);
      const token = b64(randomBytes(32));
      sessions.set(token, { userId: user.id, key: dataKey(password, user.dataSalt), expiresAt: Date.now() + sessionAge });
      setSession(res, token); const session = sessions.get(token); return json(res, 200, { user: userView(user), profiles: Object.values(user.profiles || {}).map(value => profileView(session.key, value)) });
    }
    if (path === '/auth/logout' && request.method === 'POST') { const token = readCookie(request, 'session'); if (token) sessions.delete(token); clearSession(res); return json(res, 200, { ok: true }); }
    const auth = await requireAuth(request, res); if (!auth) return;
    if (path === '/me' && request.method === 'GET') return json(res, 200, { user: userView(auth.user), profiles: allProfiles(auth) });
    if (path === '/profiles' && request.method === 'GET') return json(res, 200, { profiles: allProfiles(auth) });
    if (path === '/profiles' && request.method === 'POST') {
      const input = await body(request); const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (!name || name.length > 40) return fail(res, 400, '配置名称需要 1～40 个字符');
      const profile = { id: randomUUID(), name, plan: validatePlan(input.plan || {}), createdAt: now(), updatedAt: now() };
      auth.user.profiles[profile.id] = encrypt(auth.session.key, profile); await saveStore(); return json(res, 201, { profile });
    }
    const match = path.match(/^\/profiles\/([^/]+)$/);
    if (match) {
      const profileId = decodeURIComponent(match[1]); const encrypted = auth.user.profiles[profileId];
      if (!encrypted) return fail(res, 404, '配置不存在');
      if (request.method === 'GET') return json(res, 200, { profile: decrypt(auth.session.key, encrypted) });
      if (request.method === 'PUT') {
        const input = await body(request); const current = decrypt(auth.session.key, encrypted); const name = typeof input.name === 'string' ? input.name.trim() : current.name;
        if (!name || name.length > 40) return fail(res, 400, '配置名称需要 1～40 个字符');
        const profile = { ...current, name, plan: validatePlan(input.plan || current.plan), updatedAt: now() };
        auth.user.profiles[profileId] = encrypt(auth.session.key, profile); await saveStore(); return json(res, 200, { profile });
      }
      if (request.method === 'DELETE') { delete auth.user.profiles[profileId]; await saveStore(); return json(res, 200, { ok: true }); }
    }
    return fail(res, 404, '接口不存在');
  } catch (error) { return fail(res, 400, error.message || '请求失败'); }
}
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
function serveStatic(request, res, url) {
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = resolve(root, `.${normalize(requested)}`);
  if ((file !== root && !file.startsWith(`${root}/`)) || file === dataDir || file.startsWith(`${dataDir}/`)) return fail(res, 403, '禁止访问');
  try { const stream = createReadStream(file); stream.on('error', error => { if (error.code === 'ENOENT') fail(res, 404, '页面不存在'); else fail(res, 500, '读取页面失败'); }); res.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); stream.pipe(res); }
  catch { fail(res, 404, '页面不存在'); }
}
await loadStore();
createServer((request, res) => { const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`); if (url.pathname.startsWith('/api/')) apiHandler(request, res, url); else if (request.method === 'GET' || request.method === 'HEAD') serveStatic(request, res, url); else fail(res, 405, '方法不支持'); }).listen(port, host, () => console.log(`our-home listening on http://${host}:${port}`));
