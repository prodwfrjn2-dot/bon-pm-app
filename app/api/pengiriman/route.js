import { getSheets, SHEET_ID } from "@/lib/googleSheets";

export async function GET(request) {
  try {
    const sheets = await getSheets();
    const { searchParams } = new URL(request.url);
    const no_bon = searchParams.get("no_bon");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Pengiriman_BON!A2:F10000",
    });

    const rows = response.data.values || [];
    const filtered = rows
      .filter((row) => row[0] === no_bon)
      .map((row) => ({
        no_bon: row[0] || "",
        material_code: row[1] || "",
        nama_pm: row[2] || "",
        qty_kirim: row[3] || "",
        jam_kirim: row[4] || "",
        nama_pembuat: row[5] || "",
      }));

    return new Response(JSON.stringify({ success: true, data: filtered }), {
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
    const { no_bon, material_code, nama_pm, qty_kirim, nama_pembuat, password, qty_bon } = body;

    // Validasi nama pengirim
    if (!nama_pembuat || nama_pembuat.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "Nama pengirim wajib diisi!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

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

    // Hitung total sudah terkirim untuk item ini
    const kirimRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Pengiriman_BON!A2:F10000",
    });
    const kirimRows = kirimRes.data.values || [];
    const totalSudahKirim = kirimRows
      .filter((row) => row[0] === no_bon && row[1] === material_code)
      .reduce((sum, row) => sum + Number(row[3] || 0), 0);

    const sisaQty = Number(qty_bon) - totalSudahKirim;
    if (Number(qty_kirim) > sisaQty) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Qty melebihi sisa BON! Sisa: ${sisaQty}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate jam WIB
    const jam_kirim = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Pengiriman_BON!A:F",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[no_bon, material_code, nama_pm, qty_kirim, jam_kirim, nama_pembuat]],
      },
    });

    return new Response(
      JSON.stringify({ success: true, jam_kirim }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}