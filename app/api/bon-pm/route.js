import { getSheets, SHEET_ID } from "@/lib/googleSheets";
import { getShiftSekarangPM } from "@/lib/waktuHelperPM";

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

export async function POST(request) {
  try {
    const sheets = await getSheets();
    const body = await request.json();
    const { no_bon, tanggal, nama_pembuat, line, tujuan, keterangan, sku_produk, divisi, items } = body;

    // Shift ditentukan otomatis dari jam submit (WIB), bukan dipilih manual
    // oleh user. Rentang jam berbeda khusus hari Sabtu.
    const shift = getShiftSekarangPM();

    // DEBUG SEMENTARA: log ke Vercel Function Logs supaya bisa dipastikan
    // apakah field `divisi` benar-benar terkirim dari frontend saat submit.
    // Cek di Vercel Dashboard > Project > Deployments > (deployment aktif)
    // > Functions > /api/bon-pm setelah submit BON baru.
    console.log("[api/bon-pm] body diterima:", JSON.stringify(body));
    console.log("[api/bon-pm] divisi diterima:", divisi);

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
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "BON_PM!A:N",
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

    return new Response(JSON.stringify({ success: true, message: "BON PM berhasil disimpan!", shift }), {
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