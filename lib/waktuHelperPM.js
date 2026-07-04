// lib/waktuHelperPM.js
// Helper waktu khusus untuk BON PM. Berbeda dari BON RM: di sini TIDAK ADA
// batas jam 20:00 sama sekali. Revisi (edit-bon) hanya dibatasi harus di
// HARI YANG SAMA dengan tanggal BON. Catat Pengiriman & input BON baru
// tidak dibatasi apa pun.

/**
 * Tanggal hari ini dalam format YYYY-MM-DD, dihitung dari WIB (Asia/Jakarta)
 * supaya konsisten di server mana pun aplikasi di-deploy.
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
 * masih boleh DIREVISI: hanya boleh di hari yang sama dengan tanggal BON.
 * TIDAK ADA batas jam. Tidak dipakai untuk Catat Pengiriman maupun input
 * BON baru — keduanya tetap bebas tanpa batasan.
 *
 * Mengembalikan { boleh: boolean, alasan?: string }
 */
export function validasiBolehRevisiPM(tanggalBonId) {
  const tanggalSekarangISO = getTanggalWIBSekarang();
  const tanggalBonISO = tanggalIdKeISO(tanggalBonId);

  if (!tanggalBonISO) {
    return { boleh: false, alasan: "Format tanggal BON tidak valid." };
  }

  if (tanggalBonISO !== tanggalSekarangISO) {
    return {
      boleh: false,
      alasan: "Revisi hanya bisa dilakukan pada hari yang sama dengan tanggal BON.",
    };
  }

  return { boleh: true };
}