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
    // FIX QUOTA: no_bon kosong/tidak dikirim → kembalikan SEMUA baris,
    // supaya History cukup 1x fetch untuk semua BON (bukan per BON).
    const filtered = rows
      .filter((row) => !no_bon || row[0] === no_bon)
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

    // 1. Validasi input password wajib diisi
    if (!password || password.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "Password Ceklis wajib diisi!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Cek password di sheet Users KOLOM D (Password Ceklis)
    const usersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Users!D2:D1000",
    });
    
    // Filter baris kosong agar tidak jadi celah keamanan
    const passwords = (usersRes.data.values || [])
      .map((row) => row[0])
      .filter((pass) => pass && pass.trim() !== "");

    if (!passwords.includes(password.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: "Password Ceklis salah!" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Cek apakah item ini sudah diceklis
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

    // 4. Generate waktu WIB Jakarta yang konsisten
    const jam_ceklis = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

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