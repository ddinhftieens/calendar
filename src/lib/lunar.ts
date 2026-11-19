// Thuật toán âm lịch Việt Nam - Hồ Ngọc Đức (múi giờ GMT+7)
const TZ = 7;
const PI = Math.PI;
const INT = Math.floor;

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd: number): [number, number, number] {
  let a: number, b: number, c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const day = e - INT((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * INT(m / 10);
  const year = b * 100 + d - 4800 + INT(m / 10);
  return [day, month, year];
}

function newMoon(k: number): number {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - PI * 2 * INT(L / (PI * 2));
  return L;
}

// Cache theo k: mỗi tháng âm chỉ tính 1 lần (tránh tính lại hàng chục nghìn lần khi vẽ lưới lịch)
const newMoonCache = new Map<number, number>();
function getNewMoonDay(k: number): number {
  let v = newMoonCache.get(k);
  if (v === undefined) {
    v = INT(newMoon(k) + 0.5 + TZ / 24);
    if (newMoonCache.size > 5000) newMoonCache.clear(); // giới hạn bộ nhớ
    newMoonCache.set(k, v);
  }
  return v;
}
const getSunLongitude = (d: number) => INT((sunLongitude(d - 0.5 - TZ / 24) / PI) * 6);

const m11Cache = new Map<number, number>();
function getLunarMonth11(yy: number): number {
  const hit = m11Cache.get(yy);
  if (hit !== undefined) return hit;
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k);
  if (getSunLongitude(nm) >= 9) nm = getNewMoonDay(k - 1);
  m11Cache.set(yy, nm);
  return nm;
}

const leapCache = new Map<number, number>();
function getLeapMonthOffset(a11: number): number {
  const hit = leapCache.get(a11);
  if (hit !== undefined) return hit;
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last: number, i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i));
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i));
  } while (arc !== last && i < 14);
  leapCache.set(a11, i - 1);
  return i - 1;
}

export interface LunarDate { day: number; month: number; year: number; leap: boolean; jd: number }

export function solarToLunar(dd: number, mm: number, yy: number): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
  let a11 = getLunarMonth11(yy), b11 = a11, lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = getLeapMonthOffset(a11);
    if (diff >= leapDiff) {
      lunarMonth = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap, jd: dayNumber };
}

/** Trả về [d,m,y] dương lịch, hoặc null nếu tháng nhuận không tồn tại */
export function lunarToSolar(ld: number, lm: number, ly: number, leap: boolean): [number, number, number] | null {
  let a11: number, b11: number;
  if (lm < 11) {
    a11 = getLunarMonth11(ly - 1);
    b11 = getLunarMonth11(ly);
  } else {
    a11 = getLunarMonth11(ly);
    b11 = getLunarMonth11(ly + 1);
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lm - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && lm !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) return null;
  const monthStart = getNewMoonDay(k + off);
  return jdToDate(monthStart + ld - 1);
}

/** Số ngày của tháng âm */
export function lunarMonthLength(lm: number, ly: number, leap: boolean): number {
  const d30 = lunarToSolar(30, lm, ly, leap);
  if (!d30) return 30;
  return solarToLunar(d30[0], d30[1], d30[2]).day === 30 ? 30 : 29;
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

const ZODIAC_FILES = [
  '01-ty.jpg', '02-suu.png', '03-dan.png', '04-mao.png',
  '05-thin.jpg', '06-ty.png', '07-ngo.png', '08-mui.png',
  '09-than.jpg', '10-dau.png', '11-tuat.png', '12-pig.png',
];
export const yearZodiacImage = (y: number) => `${import.meta.env.BASE_URL}zodiac/${ZODIAC_FILES[(y + 8) % 12]}`;
export const dayZodiacImage = (jd: number) => `${import.meta.env.BASE_URL}zodiac/${ZODIAC_FILES[(jd + 1) % 12]}`;

export const yearCanChi = (y: number) => `${CAN[(y + 6) % 10]} ${CHI[(y + 8) % 12]}`;
export const dayCanChi = (jd: number) => `${CAN[(jd + 9) % 10]} ${CHI[(jd + 1) % 12]}`;
export const monthCanChi = (m: number, y: number) => `${CAN[(y * 12 + m + 3) % 10]} ${CHI[(m + 1) % 12]}`;

const TIET_KHI = ['Xuân phân', 'Thanh minh', 'Cốc vũ', 'Lập hạ', 'Tiểu mãn', 'Mang chủng', 'Hạ chí', 'Tiểu thử',
  'Đại thử', 'Lập thu', 'Xử thử', 'Bạch lộ', 'Thu phân', 'Hàn lộ', 'Sương giáng', 'Lập đông', 'Tiểu tuyết',
  'Đại tuyết', 'Đông chí', 'Tiểu hàn', 'Đại hàn', 'Lập xuân', 'Vũ thủy', 'Kinh trập'];
export const tietKhi = (jd: number) => TIET_KHI[INT((sunLongitude(jd + 0.5 - TZ / 24) / PI) * 12)];

// Giờ hoàng đạo
const GIO_HD = ['110100101100', '001101001011', '110011010010', '101100110100', '001011001101', '010010110011'];
export function gioHoangDao(jd: number): string[] {
  const chiOfDay = (jd + 1) % 12;
  const pattern = GIO_HD[chiOfDay % 6];
  const res: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (pattern[i] === '1') res.push(`${CHI[i]} (${(i * 2 + 23) % 24}-${(i * 2 + 1) % 24}h)`);
  }
  return res;
}
