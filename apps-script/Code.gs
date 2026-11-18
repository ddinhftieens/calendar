/**
 * LỊCH SỰ KIỆN - Google Apps Script backend
 * 1. Tạo Google Sheet mới → Extensions (Tiện ích mở rộng) → Apps Script → dán toàn bộ file này.
 * 2. Chạy hàm `setup` một lần (cấp quyền) → tạo sheet + trigger gửi cảnh báo hằng ngày lúc 7h.
 * 3. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone → copy URL /exec.
 */
const SHEET_EVENTS = 'Events';
const SHEET_TYPES = 'Types';
const SHEET_LOG = 'NotifyLog';
const HEADERS = ['id', 'title', 'typeId', 'calendar', 'day', 'month', 'year', 'leap', 'time', 'repeat',
  'reminders', 'notifyEmail', 'note', 'updatedAt'];
const REMIND_HOUR = 7;
const TZ_NAME = 'Asia/Ho_Chi_Minh';

// ================= WEB API =================
function doGet() {
  return json_({ ok: true, data: listAll_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const req = JSON.parse(e.postData.contents);
    switch (req.action) {
      case 'list': return json_({ ok: true, data: listAll_() });
      case 'saveEvent': saveEvent_(req.event); return json_({ ok: true, data: true });
      case 'deleteEvent': deleteEvent_(req.id); return json_({ ok: true, data: true });
      case 'saveTypes': saveTypes_(req.types); return json_({ ok: true, data: true });
      case 'testEmail':
        MailApp.sendEmail(req.email, 'Lịch Sự Kiện - Kiểm tra email', 'Bạn sẽ nhận cảnh báo sự kiện tại địa chỉ này.');
        return json_({ ok: true, data: true });
      default: return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function sh_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    if (headers) { s.appendRow(headers); s.setFrozenRows(1); s.getRange(1, 1, 1, headers.length).setFontWeight('bold'); }
  }
  return s;
}

function readEvents_() {
  const s = sh_(SHEET_EVENTS, HEADERS);
  const values = s.getDataRange().getValues();
  return values.slice(1).filter(r => r[0]).map(r => ({
    id: String(r[0]), title: String(r[1]), typeId: String(r[2]), calendar: String(r[3]) || 'solar',
    day: Number(r[4]), month: Number(r[5]), year: Number(r[6]), leap: r[7] === true || r[7] === 'TRUE',
    time: fmtTime_(r[8]), repeat: String(r[9]) || 'yearly',
    reminders: String(r[10]).split(',').filter(x => x !== '').map(Number),
    notifyEmail: String(r[11]), note: String(r[12]), updatedAt: Number(r[13]) || 0,
  }));
}

function fmtTime_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ_NAME, 'HH:mm');
  return String(v || '');
}

function listAll_() {
  const t = sh_(SHEET_TYPES, ['json']).getRange('A2').getValue();
  return { events: readEvents_(), types: t ? JSON.parse(t) : null };
}

function toRow_(ev) {
  return [ev.id, ev.title, ev.typeId, ev.calendar, ev.day, ev.month, ev.year, !!ev.leap, "'" + (ev.time || ''),
    ev.repeat, (ev.reminders || []).join(','), ev.notifyEmail || '', ev.note || '', ev.updatedAt || Date.now()];
}

function saveEvent_(ev) {
  const s = sh_(SHEET_EVENTS, HEADERS);
  const ids = s.getRange(1, 1, s.getLastRow(), 1).getValues().map(r => String(r[0]));
  const idx = ids.indexOf(String(ev.id));
  if (idx > 0) s.getRange(idx + 1, 1, 1, HEADERS.length).setValues([toRow_(ev)]);
  else s.appendRow(toRow_(ev));
}

function deleteEvent_(id) {
  const s = sh_(SHEET_EVENTS, HEADERS);
  const ids = s.getRange(1, 1, s.getLastRow(), 1).getValues().map(r => String(r[0]));
  const idx = ids.indexOf(String(id));
  if (idx > 0) s.deleteRow(idx + 1);
}

function saveTypes_(types) {
  sh_(SHEET_TYPES, ['json']).getRange('A2').setValue(JSON.stringify(types));
}

// ================= SETUP & CẢNH BÁO =================
function setup() {
  sh_(SHEET_EVENTS, HEADERS);
  sh_(SHEET_TYPES, ['json']);
  sh_(SHEET_LOG, ['date', 'eventId', 'daysBefore', 'email']);
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'sendReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(REMIND_HOUR).inTimezone(TZ_NAME).create();
}

/** Chạy hằng ngày: gửi email cho các sự kiện còn N ngày (N thuộc reminders) */
function sendReminders() {
  const now = new Date(Utilities.formatDate(new Date(), TZ_NAME, "yyyy/MM/dd HH:mm:ss"));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = Utilities.formatDate(today, TZ_NAME, 'yyyy-MM-dd');
  const log = sh_(SHEET_LOG, ['date', 'eventId', 'daysBefore', 'email']);
  const sent = new Set(log.getDataRange().getValues().map(r => r[0] instanceof Date
    ? Utilities.formatDate(r[0], TZ_NAME, 'yyyy-MM-dd') + '|' + r[1] + '|' + r[2] : r[0] + '|' + r[1] + '|' + r[2]));
  const t = sh_(SHEET_TYPES, ['json']).getRange('A2').getValue();
  const types = t ? JSON.parse(t) : [];
  const typeName = id => { const x = types.find(y => y.id === id); return x ? x.icon + ' ' + x.name : ''; };

  const groups = {}; // email -> lines
  readEvents_().forEach(ev => {
    if (!ev.notifyEmail || !ev.reminders.length) return;
    const occ = nextOccurrence_(ev, today);
    if (!occ) return;
    const diff = Math.round((new Date(occ.getFullYear(), occ.getMonth(), occ.getDate()) - today) / 86400000);
    if (ev.reminders.indexOf(diff) < 0) return;
    const key = todayKey + '|' + ev.id + '|' + diff;
    if (sent.has(key)) return;
    const when = diff === 0 ? 'HÔM NAY' : 'còn ' + diff + ' ngày';
    const dateStr = Utilities.formatDate(occ, TZ_NAME, 'dd/MM/yyyy') + (ev.time ? ' lúc ' + ev.time : '');
    const lunarStr = ev.calendar === 'lunar' ? ' (âm lịch ' + ev.day + '/' + ev.month + ')' : '';
    (groups[ev.notifyEmail] = groups[ev.notifyEmail] || []).push({
      diff, html: '<li><b>' + ev.title + '</b> - ' + typeName(ev.typeId) + '<br>' + dateStr + lunarStr +
        ' — <b style="color:#7c3aed">' + when + '</b>' + (ev.note ? '<br><i>' + ev.note + '</i>' : '') + '</li>',
    });
    log.appendRow([todayKey, ev.id, diff, ev.notifyEmail]);
  });

  Object.keys(groups).forEach(email => {
    const items = groups[email].sort((a, b) => a.diff - b.diff);
    const hasToday = items.some(i => i.diff === 0);
    MailApp.sendEmail({
      to: email,
      subject: (hasToday ? 'Hôm nay có sự kiện' : 'Sự kiện sắp diễn ra') + ' - Lịch Sự Kiện',
      htmlBody: '<div style="font-family:Arial,sans-serif"><h2 style="color:#7c3aed">Lịch Sự Kiện nhắc bạn</h2><ul>' +
        items.map(i => i.html).join('') + '</ul></div>',
    });
  });
}

function nextOccurrence_(ev, today) {
  const p = (ev.time || '00:00').split(':').map(Number);
  const mk = (d, m, y) => new Date(y, m - 1, d, p[0] || 0, p[1] || 0);
  if (ev.calendar === 'solar') {
    if (ev.repeat === 'none') { const d = mk(ev.day, ev.month, ev.year); return d >= today ? d : null; }
    if (ev.repeat === 'monthly') {
      for (let i = 0; i < 14; i++) {
        const y = today.getFullYear(), m = today.getMonth() + 1 + i;
        const d = new Date(y, m - 1, Math.min(ev.day, new Date(y, m, 0).getDate()), p[0] || 0, p[1] || 0);
        if (d >= today) return d;
      }
      return null;
    }
    for (let y = today.getFullYear(); y <= today.getFullYear() + 1; y++) {
      const d = mk(Math.min(ev.day, new Date(y, ev.month, 0).getDate()), ev.month, y);
      if (d >= today) return d;
    }
    return null;
  }
  const tl = solarToLunar(today.getDate(), today.getMonth() + 1, today.getFullYear());
  const conv = (d, m, y, leap) => {
    const s = lunarToSolar(Math.min(d, lunarMonthLength(m, y, leap)), m, y, leap) || lunarToSolar(Math.min(d, 29), m, y, false);
    return s ? mk(s[0], s[1], s[2]) : null;
  };
  if (ev.repeat === 'none') { const d = conv(ev.day, ev.month, ev.year, ev.leap); return d && d >= today ? d : null; }
  if (ev.repeat === 'monthly') {
    let m = tl.month, y = tl.year;
    for (let i = 0; i < 14; i++) { const d = conv(ev.day, m, y, false); if (d && d >= today) return d; m++; if (m > 12) { m = 1; y++; } }
    return null;
  }
  for (let y = tl.year - 1; y <= tl.year + 2; y++) { const d = conv(ev.day, ev.month, y, false); if (d && d >= today) return d; }
  return null;
}

// ================= ÂM LỊCH (Hồ Ngọc Đức, GMT+7) =================
const TZ = 7, INT = Math.floor, PI = Math.PI;
function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}
function jdToDate(jd) {
  let a, b, c;
  if (jd > 2299160) { a = jd + 32044; b = INT((4 * a + 3) / 146097); c = a - INT((b * 146097) / 4); }
  else { b = 0; c = jd + 32082; }
  const d = INT((4 * c + 3) / 1461), e = c - INT((1461 * d) / 4), m = INT((5 * e + 2) / 153);
  return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)];
}
function newMoon(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr) - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}
function sunLongitude(jdn) {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr; L = L - PI * 2 * INT(L / (PI * 2)); return L;
}
function getNewMoonDay(k) { return INT(newMoon(k) + 0.5 + TZ / 24); }
function getSunLongitude(d) { return INT((sunLongitude(d - 0.5 - TZ / 24) / PI) * 6); }
function getLunarMonth11(yy) {
  const k = INT((jdFromDate(31, 12, yy) - 2415021) / 29.530588853);
  let nm = getNewMoonDay(k); if (getSunLongitude(nm) >= 9) nm = getNewMoonDay(k - 1); return nm;
}
function getLeapMonthOffset(a11) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last, i = 1, arc = getSunLongitude(getNewMoonDay(k + i));
  do { last = arc; i++; arc = getSunLongitude(getNewMoonDay(k + i)); } while (arc !== last && i < 14);
  return i - 1;
}
function solarToLunar(dd, mm, yy) {
  const dayNumber = jdFromDate(dd, mm, yy), k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1); if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
  let a11 = getLunarMonth11(yy), b11 = a11, lunarYear;
  if (a11 >= monthStart) { lunarYear = yy; a11 = getLunarMonth11(yy - 1); }
  else { lunarYear = yy + 1; b11 = getLunarMonth11(yy + 1); }
  const day = dayNumber - monthStart + 1, diff = INT((monthStart - a11) / 29);
  let leap = false, month = diff + 11;
  if (b11 - a11 > 365) { const ld = getLeapMonthOffset(a11); if (diff >= ld) { month = diff + 10; if (diff === ld) leap = true; } }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) lunarYear -= 1;
  return { day, month, year: lunarYear, leap };
}
function lunarToSolar(ld, lm, ly, leap) {
  let a11, b11;
  if (lm < 11) { a11 = getLunarMonth11(ly - 1); b11 = getLunarMonth11(ly); }
  else { a11 = getLunarMonth11(ly); b11 = getLunarMonth11(ly + 1); }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lm - 11; if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11); let leapMonth = leapOff - 2; if (leapMonth < 0) leapMonth += 12;
    if (leap && lm !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) return null;
  return jdToDate(getNewMoonDay(k + off) + ld - 1);
}
function lunarMonthLength(lm, ly, leap) {
  const d30 = lunarToSolar(30, lm, ly, leap); if (!d30) return 30;
  return solarToLunar(d30[0], d30[1], d30[2]).day === 30 ? 30 : 29;
}
