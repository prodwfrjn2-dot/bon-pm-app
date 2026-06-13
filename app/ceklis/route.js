import { getSheets, SHEET_ID } from "@/lib/googleSheets";

export async function GET(request) {
  try {
    const sheets = await getSheets();
    const { searchParams } = new URL(request.url);
    const no_bon = searchParams.get("no_bon");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Ceklis_BON!A2:D10000",
    });

    const rows = response.data.values || [];
    const filtered = rows
      .filter((row) => row[0] === no_bon)
      .map((row) => ({
        no_bon: row[0] || "",
        material_code: row[1] || "",
        jam_ceklis: row[2] || "",
        status: row[3] || "",
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

export async function POST(request) {
  try {
    const sheets = await getSheets();
    const body = await request.json();
    const { no_bon, material_code, password } = body;

    // Cek password di sheet Users kolom B
    const usersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Users!B2:B1000",
    });
    const passwords = (usersRes.data.values || []).map((row) => row[0]);
    if (!passwords.includes(password)) {
      return new Response(
        JSON.stringify({ success: false, error: "Password salah!" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Cek apakah item ini sudah diceklis
    const ceklisRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Ceklis_BON!A2:D10000",
    });
    const rows = ceklisRes.data.values || [];
    const sudahAda = rows.find(
      (row) => row[0] === no_bon && row[1] === material_code
    );
    if (sudahAda) {
      return new Response(
        JSON.stringify({ success: false, error: "Item ini sudah diceklis!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const jam_ceklis = new Date().toLocaleString("id-ID");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Ceklis_BON!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[no_bon, material_code, jam_ceklis, "✓"]],
      },
    });

    return new Response(
      JSON.stringify({ success: true, jam_ceklis }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}