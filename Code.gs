/**
 * CẬP NHẬT DANH SÁCH SHOP CHO WEB CHẤM (chỉ 1 việc, 1 lần/ngày lúc 22h)
 * Gắn vào file "HCM PHÂN BỔ" (Tiện ích mở rộng → Apps Script).
 *
 * Đọc sheet PHÂN BỔ (Mã ST, Tên, Ngày khai trương, RSM, QLTP) + sheet CAU_HINH_WEB (ngày mốc tháng)
 * → ghi lên web. Không ghi dữ liệu chấm về Sheet: toàn bộ dữ liệu chấm nằm trên web.
 */

const CFG = {
  PROJECT_ID: 'DIEN_PROJECT_ID',                                // Firebase project ID
  PHAN_BO_ID: '14P_brZ69ZPMVbGKDWFZo2almkLQv_dw-e2I_Zhxufa8',   // file HCM PHÂN BỔ
  PHAN_BO_SHEET: 'PHÂN BỔ',
  TZ: 'Asia/Ho_Chi_Minh'
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Web chấm')
    .addItem('Cập nhật danh sách shop + ngày mốc lên web', 'syncShops')
    .addItem('Cài lịch tự động 22h (chạy 1 lần)', 'setupTriggers')
    .addToUi();
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncShops').timeBased().atHour(22).nearMinute(5).everyDays(1).inTimezone(CFG.TZ).create();
  readMoc_();   // tạo sheet CAU_HINH_WEB nếu chưa có
}

function syncShops() {
  const ss = SpreadsheetApp.openById(CFG.PHAN_BO_ID);
  const sh = ss.getSheetByName(CFG.PHAN_BO_SHEET);
  const n = sh.getLastRow() - 1;
  const rows = [];
  (n > 0 ? sh.getRange(2, 1, n, 5).getValues() : []).forEach(r => {
    const mst = String(r[0]).trim();
    if (mst) rows.push([mst, String(r[1]).trim(), toIsoDate_(r[2]), String(r[3]).trim(), String(r[4]).trim()]);
  });
  if (!rows.length) throw new Error('Sheet PHÂN BỔ không có dữ liệu — không cập nhật để tránh xoá danh sách trên web.');
  const moc = readMoc_();
  const url = 'https://firestore.googleapis.com/v1/projects/' + CFG.PROJECT_ID + '/databases/(default)/documents/config/shops';
  const body = { fields: {
    data: { stringValue: JSON.stringify({ cot: ['mst', 'ten', 'khaiTruong', 'rsm', 'qltp'], rows: rows }) },
    moc: { stringValue: JSON.stringify(moc) },
    soShop: { integerValue: String(rows.length) },
    capNhat: { timestampValue: new Date().toISOString() }
  } };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = UrlFetchApp.fetch(url, {
      method: 'patch', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body),
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': CFG.PROJECT_ID }
    });
    const code = res.getResponseCode();
    if (code < 300) { console.log('Đã cập nhật ' + rows.length + ' shop, mốc ' + JSON.stringify(moc)); return; }
    if (code !== 429 && code < 500) throw new Error('Lỗi ' + code + ': ' + res.getContentText().slice(0, 400));
    Utilities.sleep(2000 * attempt);
  }
  throw new Error('Máy chủ không phản hồi sau 3 lần thử');
}

function readMoc_() {
  const ss = SpreadsheetApp.openById(CFG.PHAN_BO_ID);
  let sh = ss.getSheetByName('CAU_HINH_WEB');
  if (!sh) {
    sh = ss.insertSheet('CAU_HINH_WEB');
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange(1, 1, 3, 3).setValues([
      ['Tháng (yyyy-MM)', 'Ngày mốc báo cáo', 'Ghi chú'],
      ['2026-10', '16/10/2026', 'Tháng 10 tính từ 16/10 đến cuối tháng'],
      ['2026-11', '01/11/2026', '']]);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  const out = {}, n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, 2).getValues().forEach(r => {
    const ym = r[0] instanceof Date ? Utilities.formatDate(r[0], CFG.TZ, 'yyyy-MM') : String(r[0]).trim();
    const d = toIsoDate_(r[1]);
    if (/^\d{4}-\d{2}$/.test(ym) && d) out[ym] = d;
  });
  return out;
}

function toIsoDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd');
  if (typeof v === 'number' && v > 20000) return Utilities.formatDate(new Date(Date.UTC(1899, 11, 30) + v * 864e5), 'UTC', 'yyyy-MM-dd');
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  if (/^\d{5}$/.test(s)) return toIsoDate_(Number(s));
  return '';
}
