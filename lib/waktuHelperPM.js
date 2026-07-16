// lib/waktuHelperPM.js
// Helper waktu khusus untuk BON PM. Berbeda dari BON RM: di sini TIDAK ADA
// batas jam 20:00 sama sekali. Revisi (edit-bon) hanya dibatasi harus di
// HARI YANG SAMA dengan tanggal BON. Catat Pengiriman & input BON baru
// tidak dibatasi apa pun.
//
// PENTING: "hari" di sini bukan hari kalender (rollover jam 00:00), tapi
// "hari bisnis" yang rollover di jam 07:00 WIB (awal Shift 1). Shift 3
// berjalan dari jam 23:00 sampai jam 07:00 pagi berikutnya, jadi BON yang
// dibuat misalnya jam 02:00 dini hari tetap harus tercatat dengan tanggal
// HARI SEBELUMNYA (tanggal shift itu dimulai), bukan tanggal kalender saat
// disubmit. Semua fungsi "tanggal bisnis" di bawah ini mengikuti aturan
// tersebut.

/**
 * Tanggal hari ini dalam format YYYY-MM-DD, dihitung dari WIB (Asia/Jakarta)
 * supaya konsisten di server mana pun aplikasi di-deploy. Ini tanggal
 * KALENDER biasa (rollover jam 00:00) — dipakai sebagai basis perhitungan
 * tanggal bisnis di bawah, bukan dipakai langsung untuk BON.
 */
function getTanggalWIBSekarang() {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }); // YYYY-MM-DD
}

/**
 * Mengubah string tanggal format "DD/MM/YYYY" (format toLocaleDateString("id-ID"))
 * menjadi "YYYY-MM-DD" agar bisa dibandingkan dengan tanggal hari ini.
 */
function tanggalIdKeISO(tanggalId) {
  if (!tanggalId) return null;
  const parts = tanggalId.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Tanggal BISNIS saat ini dalam format ISO "YYYY-MM-DD", dengan rollover
 * jam 07:00 WIB (bukan jam 00:00). Kalau jam sekarang masih sebelum 07:00,
 * dianggap masih "tanggal kemarin" (kelanjutan Shift 3 semalam).
 */
function getTanggalBisnisISO() {
  const now = new Date();
  const jamStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false }); // HH:MM:SS
  const [jam, menit] = jamStr.split(":").map(Number);
  const totalMenit = jam * 60 + menit;
  const S1_START = 7 * 60; // 07:00 — batas pergantian tanggal bisnis

  const tanggalKalenderISO = getTanggalWIBSekarang();

  if (totalMenit < S1_START) {
    // Masih sebelum jam 07:00 → tanggal bisnis = tanggal kalender - 1 hari
    const [y, m, d] = tanggalKalenderISO.split("-").map(Number);
    const kemarin = new Date(Date.UTC(y, m - 1, d));
    kemarin.setUTCDate(kemarin.getUTCDate() - 1);
    const yy = kemarin.getUTCFullYear();
    const mm = String(kemarin.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(kemarin.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  return tanggalKalenderISO;
}

/**
 * Tanggal bisnis BON PM dalam format id-ID (DD/MM/YYYY) — format yang sama
 * dengan yang disimpan di kolom "tanggal" sheet BON_PM. WAJIB dipakai di
 * server saat submit BON PM (bukan tanggal kalender dari client) supaya
 * Shift 3 dini hari tetap tercatat di tanggal dia MULAI, konsisten dengan
 * getShiftSekarangPM(), dan tidak bisa dimanipulasi lewat jam perangkat
 * client.
 */
export function getTanggalBonPM() {
  const iso = getTanggalBisnisISO();
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Menentukan shift otomatis berdasarkan jam & HARI saat ini (WIB).
 * Senin-Jumat & Minggu: Shift 1 07:00-15:00, Shift 2 15:00-23:00, Shift 3 23:00-07:00.
 * Sabtu (jam kerja lebih singkat): Shift 1 07:00-12:00, Shift 2 12:00-17:00, Shift 3 17:00-22:00.
 * Di luar rentang Sabtu (22:00-07:00) dan di luar rentang normal (tidak ada,
 * karena Shift 3 normal menutup 23:00-07:00) dianggap tetap Shift 3.
 */
export function getShiftSekarangPM() {
  const now = new Date();
  const hari = now.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }); // "Sat", "Sun", dst
  const jamStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false }); // HH:MM:SS
  const [jam, menit] = jamStr.split(":").map(Number);
  const totalMenit = jam * 60 + menit;

  const isSabtu = hari === "Sat";

  if (isSabtu) {
    const S1_START = 7 * 60;   // 07:00
    const S2_START = 12 * 60;  // 12:00
    const S3_START = 17 * 60;  // 17:00
    if (totalMenit >= S1_START && totalMenit < S2_START) return "Shift 1";
    if (totalMenit >= S2_START && totalMenit < S3_START) return "Shift 2";
    return "Shift 3"; // 17:00 - 07:00 (termasuk dini hari sampai jam 07:00)
  }

  // Senin-Jumat & Minggu: rentang normal
  const S1_START = 7 * 60;   // 07:00
  const S2_START = 15 * 60;  // 15:00
  const S3_START = 23 * 60;  // 23:00
  if (totalMenit >= S1_START && totalMenit < S2_START) return "Shift 1";
  if (totalMenit >= S2_START && totalMenit < S3_START) return "Shift 2";
  return "Shift 3"; // 23:00 - 07:00
}

/**
 * Label keterangan rentang jam untuk setiap shift, mengikuti hari saat ini.
 * Dipakai untuk menampilkan info di UI, misal "Shift 1 (07:00-12:00)" saat Sabtu.
 */
export function getKeteranganShiftPM() {
  const now = new Date();
  const hari = now.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", weekday: "short" });
  const isSabtu = hari === "Sat";

  if (isSabtu) {
    return {
      "Shift 1": "07:00 - 12:00",
      "Shift 2": "12:00 - 17:00",
      "Shift 3": "17:00 - 22:00",
    };
  }
  return {
    "Shift 1": "07:00 - 15:00",
    "Shift 2": "15:00 - 23:00",
    "Shift 3": "23:00 - 07:00",
  };
}

/**
 * Validasi apakah BON PM dengan tanggal tertentu (format id-ID: DD/MM/YYYY)
 * masih boleh DIREVISI: hanya boleh di HARI BISNIS yang sama dengan tanggal
 * BON (rollover jam 07:00, lihat getTanggalBisnisISO). TIDAK ADA batas jam
 * lain selain itu. Tidak dipakai untuk Catat Pengiriman maupun input BON
 * baru — keduanya tetap bebas tanpa batasan.
 *
 * Mengembalikan { boleh: boolean, alasan?: string }
 */
export function validasiBolehRevisiPM(tanggalBonId) {
  const tanggalBisnisISO = getTanggalBisnisISO();
  const tanggalBonISO = tanggalIdKeISO(tanggalBonId);

  if (!tanggalBonISO) {
    return { boleh: false, alasan: "Format tanggal BON tidak valid." };
  }

  if (tanggalBonISO !== tanggalBisnisISO) {
    return {
      boleh: false,
      alasan: "Revisi hanya bisa dilakukan pada hari yang sama dengan tanggal BON (hari bisnis berganti jam 07:00).",
    };
  }

  return { boleh: true };
}