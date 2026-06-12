import { getSheets, SHEET_ID } from "@/lib/googleSheets";

export async function GET() {
  try {
    const sheets = await getSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Produk!A2:B100",
    });

    const produkRows = response.data.values || [];
    const produk = produkRows.map((row) => ({
      sku: row[0],
      nama: row[1],
    }));

    return new Response(JSON.stringify({ success: true, data: produk }), {
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