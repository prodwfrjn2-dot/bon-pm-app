import { getSheets, SHEET_ID } from "@/lib/googleSheets";

export async function GET(request) {
  try {
    const sheets = await getSheets();
    const { searchParams } = new URL(request.url);
    const divisi = searchParams.get("divisi");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Produk!A2:C100",
    });

    const produkRows = response.data.values || [];
    let produk = produkRows.map((row) => ({
      sku: row[0],
      nama: row[1],
      divisi: row[2] || "",
    }));

    // Debug: kembalikan juga info divisi yang ada
    const divisiList = [...new Set(produk.map((p) => p.divisi))];

    if (divisi) {
      produk = produk.filter((p) => p.divisi.trim() === divisi.trim());
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: produk,
      debug: { divisiParam: divisi, divisiList }
    }), {
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