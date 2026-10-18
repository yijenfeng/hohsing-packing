/**
 * 合欣包裝進度：Google 試算表後端（Apps Script 網頁應用程式）
 *
 * 安裝：見 README.md「設定資料來源」。
 * 通關密碼放在「專案設定 → 指令碼屬性」的 PASSCODE，不寫在程式裡。
 *
 * 規則：
 * - 讀取（GET ?action=all）不需要密碼。
 * - 所有寫入都要帶正確的 PASSCODE。
 * - 「記錄進度」(entries) 只能新增和更新（更正／作廢／復原），程式沒有刪除功能。
 * - 每一次寫入都另外寫一行到「異動紀錄」工作表。
 */

const ENTRY_COLS = ['id', 'date', 'who', 'kind', 'order', 'item', 'qty', 'void', 'at', 'by',
  'editedAt', 'voidAt', 'voidBy', 'restoredAt', 'restoredBy', 'history'];
const ENTRY_EDITABLE = ['date', 'who', 'qty', 'void', 'editedAt', 'voidAt', 'voidBy', 'restoredAt', 'restoredBy', 'history'];
const DOC_COLLECTIONS = { overrides: '改派', seq: '順序', materials: '料齊' };
const SHEET_ENTRIES = '記錄進度';
const SHEET_LOG = '異動紀錄';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'all';
  if (action !== 'all') return json_({ ok: false, error: 'unknown_action' });
  const out = { ok: true, entries: readEntries_() };
  Object.keys(DOC_COLLECTIONS).forEach(function (c) { out[c] = readDocs_(c); });
  return json_(out);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  const pass = PropertiesService.getScriptProperties().getProperty('PASSCODE');
  if (!pass) return json_({ ok: false, error: 'not_configured' });
  if (String(body.pass || '') !== pass) return json_({ ok: false, error: 'bad_passcode' });
  if (body.action === 'check') return json_({ ok: true });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let res;
    if (body.collection === 'entries') res = writeEntry_(body);
    else if (DOC_COLLECTIONS[body.collection]) res = writeDoc_(body);
    else res = { ok: false, error: 'unknown_collection' };
    if (res.ok) log_(body, res.id);
    return json_(res);
  } finally {
    lock.releaseLock();
  }
}

/* ---------- entries ---------- */
function entriesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ENTRIES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_ENTRIES, 0);
    sh.getRange(1, 1, 1, ENTRY_COLS.length).setValues([ENTRY_COLS]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), ENTRY_COLS.length).setNumberFormat('@');
    sh.setFrozenRows(1);
  }
  return sh;
}
function readEntries_() {
  const sh = entriesSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const vals = sh.getRange(2, 1, n, ENTRY_COLS.length).getDisplayValues();
  return vals.filter(function (r) { return r[0]; }).map(rowToEntry_);
}
function rowToEntry_(r) {
  const o = {};
  ENTRY_COLS.forEach(function (c, i) { if (r[i] !== '') o[c] = r[i]; });
  o.qty = Number(o.qty) || 0;
  o.void = o.void === 'TRUE' || o.void === 'true';
  if (o.history) { try { o.history = JSON.parse(o.history); } catch (err) { delete o.history; } }
  return o;
}
function entryToRow_(o) {
  return ENTRY_COLS.map(function (c) {
    const v = o[c];
    if (v === undefined || v === null) return '';
    if (c === 'history') return JSON.stringify(v);
    if (c === 'void') return v ? 'TRUE' : '';
    return String(v);
  });
}
function writeEntry_(body) {
  const sh = entriesSheet_();
  const d = body.data || {};
  if (body.action === 'add') {
    if (!d.date || !d.order || !d.item || !(Number(d.qty) > 0)) return { ok: false, error: 'bad_request' };
    const o = {};
    ['date', 'who', 'kind', 'order', 'item', 'qty', 'at', 'by'].forEach(function (c) { if (d[c] !== undefined) o[c] = d[c]; });
    o.id = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, ENTRY_COLS.length).setNumberFormat('@').setValues([entryToRow_(o)]);
    return { ok: true, id: o.id };
  }
  if (body.action === 'update') {
    const row = findRow_(sh, body.id);
    if (!row) return { ok: false, error: 'not_found' };
    const cur = rowToEntry_(sh.getRange(row, 1, 1, ENTRY_COLS.length).getDisplayValues()[0]);
    ENTRY_EDITABLE.forEach(function (c) { if (d[c] !== undefined) cur[c] = d[c]; });
    if (!(Number(cur.qty) > 0)) return { ok: false, error: 'bad_request' };
    sh.getRange(row, 1, 1, ENTRY_COLS.length).setNumberFormat('@').setValues([entryToRow_(cur)]);
    return { ok: true, id: body.id };
  }
  return { ok: false, error: 'not_allowed' }; // no delete for entries
}

/* ---------- overrides / seq / materials ---------- */
function docSheet_(c) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = DOC_COLLECTIONS[c];
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, 3).setValues([['id', 'json', 'updatedAt']]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), 3).setNumberFormat('@');
    sh.setFrozenRows(1);
  }
  return sh;
}
function readDocs_(c) {
  const sh = docSheet_(c);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 2).getDisplayValues().filter(function (r) { return r[0]; }).map(function (r) {
    let o = {};
    try { o = JSON.parse(r[1]); } catch (err) { }
    o.id = r[0];
    return o;
  });
}
function writeDoc_(body) {
  const sh = docSheet_(body.collection);
  if (!body.id || !/^[A-Za-z0-9_\-.~:@+|]{1,200}$/.test(body.id)) return { ok: false, error: 'bad_request' };
  const row = findRow_(sh, body.id);
  if (body.action === 'delete') {
    if (row) sh.deleteRow(row);
    return { ok: true, id: body.id };
  }
  if (body.action === 'set') {
    const vals = [[body.id, JSON.stringify(body.data || {}), new Date().toISOString()]];
    const r = row || sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, 3).setNumberFormat('@').setValues(vals);
    return { ok: true, id: body.id };
  }
  return { ok: false, error: 'not_allowed' };
}

/* ---------- helpers ---------- */
function findRow_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1 || !id) return 0;
  const ids = sh.getRange(2, 1, n, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === String(id)) return i + 2;
  return 0;
}
function log_(body, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_LOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LOG);
    sh.getRange(1, 1, 1, 5).setValues([['time', 'action', 'collection', 'id', 'data']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), body.action, body.collection, id || body.id || '', JSON.stringify(body.data || {})]);
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** 第一次安裝時在編輯器執行一次：建立工作表並檢查密碼是否已設定。 */
function setup() {
  entriesSheet_();
  Object.keys(DOC_COLLECTIONS).forEach(docSheet_);
  const pass = PropertiesService.getScriptProperties().getProperty('PASSCODE');
  Logger.log(pass ? '工作表已建立，PASSCODE 已設定。' : '工作表已建立。請到「專案設定 → 指令碼屬性」新增 PASSCODE。');
}
