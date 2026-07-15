import { getSheets, SHEET_ID } from "@/lib/googleSheets";

// Mengambil daftar bahan Plastik dari sheet "Plastik".
// Bahan ini TIDAK terikat ke SKU produk manapun (tidak pakai BOM),
// makanya disimpan di sheet terpisah dan hanya dipakai saat
// Tujuan = "Plastik" dipilih di form.
// Struktur kolom sheet "Plastik": A=kode, B=nama, C=uom (baris data mulai dari baris 2)
export async function GET() {
  try {
    const sheets = await getSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Plastik!A2:C100",
    });

    const rows = response.data.values || [];
    const data = rows
      .filter((row) => row[0]) // buang baris kosong
      .map((row) => ({
        material_code: row[0],
        nama_pm: row[1],
        uom: row[2],
      }));

    return new Response(JSON.stringify({ success: true, data }), {
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