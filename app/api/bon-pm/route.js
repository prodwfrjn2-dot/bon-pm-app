import { getSheets, SHEET_ID } from "@/lib/googleSheets";
import { getShiftSekarangPM, getTanggalBonPM } from "@/lib/waktuHelperPM";

export async function GET(request) {
  try {
    const sheets = await getSheets();
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Produk_BOM!A2:E1000",
    });

    const rows = response.data.values || [];
    const bom = rows
      .filter((row) => row[0] === sku)
      .map((row) => ({
        material_code: row[2],
        nama_pm: row[3],
        uom: row[4],
      }));

    return new Response(JSON.stringify({ success: true, data: bom }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Generate no_bon di SERVER dan pastikan belum ada di sheet BON_PM sebelum
// dipakai. Ini menggantikan generate di client yang cuma pakai 3 digit
// acak per hari — terlalu kecil, gampang tabrakan kalau ada beberapa
// submission di hari yang sama (itu penyebab item Plastik & item BOM
// produk tercampur jadi satu card di History, seperti kasus BON Ansori).
async function generateNoBonUnik(existingNoBonSet) {
  const now = new Date();
  const tglStr = now
    .toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
    .replace(/-/g, ""); // YYYYMMDD, aman dari masalah format
  const jamStr = now
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false })
    .replace(/:/g, ""); // HHMMSS

  let noBon;
  let attempt = 0;
  do {
    const rand = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");
    noBon = `BON-${tglStr}-${jamStr}-${rand}`;
    attempt++;
  } while (existingNoBonSet.has(noBon) && attempt < 20);

  return noBon;
}

export async function POST(request) {
  try {
    const sheets = await getSheets();
    const body = await request.json();
    const { jam, nama_pembuat, line, tujuan, keterangan, sku_produk, divisi, items } = body;
    // no_bon TIDAK lagi diambil dari client — dibuat & dijamin unik di sini.

    // Shift ditentukan otomatis dari jam submit (WIB), bukan dipilih manual
    // oleh user. Rentang jam berbeda khusus hari Sabtu.
    const shift = getShiftSekarangPM();

    // Tanggal BON JUGA dihitung ulang di server, bukan dipakai mentah dari
    // body (client). Ini "tanggal bisnis" dengan rollover jam 07:00 (awal
    // Shift 1) — bukan rollover jam 00:00 seperti tanggal kalender biasa.
    // Kenapa: Shift 3 berjalan 23:00-07:00, jadi BON yang dibuat misalnya
    // jam 02:00 dini hari harus tetap tercatat di tanggal HARI SEBELUMNYA
    // (tanggal shift itu dimulai), konsisten dengan getShiftSekarangPM(),
    // dan tidak bisa dimanipulasi lewat jam perangkat client.
    const tanggal = getTanggalBonPM();

    // Ambil semua no_bon yang sudah ada supaya bisa dicek tabrakannya
    // sebelum dipakai untuk submission baru ini.
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "BON_PM!A2:A100000",
    });
    const existingNoBonSet = new Set((existingRes.data.values || []).flat());

    const no_bon = await generateNoBonUnik(existingNoBonSet);

    // UOM "KG" HANYA berlaku untuk bahan Plastik (nama diawali "PLS") DAN
    // divisinya Formulasi/Central Kitchen. Item PLS yang sama dipilih dari
    // divisi lain (mis. Wafer Flat via Tujuan=Plastik) tetap pakai UOM
    // aslinya (PCS). Override dilakukan per-item di sini (server, saat
    // simpan) supaya konsisten otomatis di History & PDF, karena keduanya
    // membaca UOM langsung dari data yang tersimpan di sheet BON_PM.
    const isBahanPlastik = (nama) => (nama || "").trim().toUpperCase().startsWith("PLS");
    const DIVISI_UOM_KG = ["Formulasi", "Central Kitchen"];
    const pakaiKg = DIVISI_UOM_KG.includes(divisi);

    const bonRows = items.map((item) => [
      no_bon,
      tanggal,
      nama_pembuat,
      shift,
      line,
      sku_produk,
      body.nama_produk,
      item.material_code,
      item.nama_pm,
      item.qty_bon,
      pakaiKg && isBahanPlastik(item.nama_pm) ? "KG" : item.uom,
      tujuan,
      keterangan,
      divisi || "-",
      jam || "",
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "BON_PM!A:O",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: bonRows },
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Laporan!A:G",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[no_bon, tanggal, nama_pembuat, shift, sku_produk, body.nama_produk, items.length]],
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "BON PM berhasil disimpan!", shift, tanggal, no_bon }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}