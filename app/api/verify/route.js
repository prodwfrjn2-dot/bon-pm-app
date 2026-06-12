import { getSheets, SHEET_ID } from "@/lib/googleSheets";

export async function POST(request) {
  try {
    const sheets = await getSheets();
    const body = await request.json();
    const { username, password, tipe, no_bon } = body;

    // Cek user di sheet Users
    const usersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Users!A2:C1000",
    });

    const users = usersRes.data.values || [];
    const user = users.find(
      (row) => row[0] === username && row[1] === password
    );

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Username atau password salah!" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const namaVerif = user[2];
    const waktuVerif = new Date().toLocaleString("id-ID");

    // Ambil semua data BON_PM
    const bonRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "BON_PM!A2:Q10000",
    });

    const rows = bonRes.data.values || [];
    const startRow = 2;
    const updates = [];

    rows.forEach((row, i) => {
      if (row[0] === no_bon) {
        const rowNum = startRow + i;
        if (tipe === "fisik") {
          updates.push({
            range: `BON_PM!N${rowNum}:O${rowNum}`,
            values: [[namaVerif, waktuVerif]],
          });
        } else if (tipe === "sap") {
          updates.push({
            range: `BON_PM!P${rowNum}:Q${rowNum}`,
            values: [[namaVerif, waktuVerif]],
          });
        }
      }
    });

    if (updates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No BON tidak ditemukan!" }),
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
      JSON.stringify({ success: true, nama: namaVerif, waktu: waktuVerif }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}