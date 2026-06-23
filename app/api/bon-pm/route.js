import { getSheets, SHEET_ID } from "@/lib/googleSheets";

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
    const { no_bon, tanggal, nama_pembuat, shift, line, tujuan, keterangan, sku_produk, items } = body;

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
      item.uom,
      tujuan,
      keterangan,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "BON_PM!A:M",
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

    return new Response(JSON.stringify({ success: true, message: "BON PM berhasil disimpan!" }), {
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