import { getSheets, SHEET_ID } from "@/lib/googleSheets";

export async function POST(request) {
  try {
    const sheets = await getSheets();
    const body = await request.json();
    const { no_bon, material_code, nama_pm, qty_lama, qty_baru, nama_editor } = body;

    const waktu = new Date().toLocaleString("id-ID");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Edit_BON!A:G",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[no_bon, "EDIT_QTY", nama_pm, qty_lama, qty_baru, waktu, nama_editor]],
      },
    });

    // Update qty di sheet BON_PM
    const bonRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "BON_PM!A2:K10000",
    });

    const rows = bonRes.data.values || [];
    const startRow = 2;
    const updates = [];

    rows.forEach((row, i) => {
      if (row[0] === no_bon && row[7] === material_code) {
        const rowNum = startRow + i;
        updates.push({
          range: `BON_PM!J${rowNum}`,
          values: [[qty_baru]],
        });
      }
    });

    if (updates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Item tidak ditemukan!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    });

    return new Response(
      JSON.stringify({ success: true, waktu }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET(request) {
  try {
    const sheets = await getSheets();
    const { searchParams } = new URL(request.url);
    const no_bon = searchParams.get("no_bon");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Edit_BON!A2:G10000",
    });

    const rows = response.data.values || [];
    const filtered = rows
      .filter((row) => row[0] === no_bon)
      .map((row) => ({
        no_bon: row[0] || "",
        tipe: row[1] || "",
        nama_pm: row[2] || "",
        qty_lama: row[3] || "",
        qty_baru: row[4] || "",
        waktu: row[5] || "",
        nama_editor: row[6] || "",
      }));

    return new Response(
      JSON.stringify({ success: true, data: filtered }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}