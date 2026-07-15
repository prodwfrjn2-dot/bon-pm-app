import { getSheets, SHEET_ID } from "@/lib/googleSheets";
import { validasiBolehRevisiPM } from "@/lib/waktuHelperPM";

export async function POST(request) {
  try {
    const sheets = await getSheets();
    const body = await request.json();
    const { no_bon, material_code, nama_pm, qty_lama, qty_baru, nama_editor, password } = body;

    // 1. Validasi nama editor/revisitor
    if (!nama_editor || nama_editor.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "Nama editor wajib diisi!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Validasi input password wajib diisi
    if (!password || password.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "Password Revisi wajib diisi!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Cek password di sheet Users KOLOM C (Password Revisi)
    const usersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Users!C2:C1000",
    });

    // Filter baris kosong agar tidak jadi celah keamanan
    const passwords = (usersRes.data.values || [])
      .map((row) => row[0])
      .filter((pass) => pass && pass.trim() !== "");

    if (!passwords.includes(password.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: "Password Revisi salah!" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Ambil data BON & Pengiriman
    const [bonRes, kirimRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "BON_PM!A2:K10000",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "Pengiriman_BON!A2:F10000",
      }),
    ]);

    const bonRows = bonRes.data.values || [];
    const bonRow = bonRows.find(
      (row) => row[0] === no_bon && row[7] === material_code
    );

    if (!bonRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Item tidak ditemukan!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Revisi hanya boleh di hari yang sama dengan tanggal BON (tanpa batas jam).
    const tanggalBon = bonRow[1]; // kolom B = tanggal
    const cekWaktu = validasiBolehRevisiPM(tanggalBon);
    if (!cekWaktu.boleh) {
      return new Response(
        JSON.stringify({ success: false, error: cekWaktu.alasan }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const kirimRows = kirimRes.data.values || [];
    const kirimanItem = kirimRows.filter(
      (row) => row[0] === no_bon && row[1] === material_code
    );
    const totalKirim = kirimanItem.reduce(
      (sum, row) => sum + Number(row[3] || 0),
      0
    );

    // 6. Qty selalu boleh diedit (naik/turun bebas) selama masih hari yang
    //    sama dengan tanggal BON — TIDAK ADA full-lock walau sudah lunas.
    //    Satu-satunya batasan: qty baru tidak boleh kurang dari total yang
    //    sudah tercatat dikirim di Pengiriman_BON.
    const qtyBaruNum = Number(qty_baru);
    if (Number.isNaN(qtyBaruNum)) {
      return new Response(
        JSON.stringify({ success: false, error: "Qty baru harus berupa angka." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (totalKirim > 0 && qtyBaruNum < totalKirim) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Qty tidak boleh kurang dari jumlah yang sudah dikirim (${totalKirim}).`,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const waktu = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Edit_BON!A:G",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[no_bon, "EDIT_QTY", nama_pm, qty_lama, qty_baru, waktu, nama_editor]],
      },
    });

    // Update qty di sheet BON_PM
    const startRow = 2;
    const updates = [];

    bonRows.forEach((row, i) => {
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
    // FIX QUOTA: no_bon kosong/tidak dikirim → kembalikan SEMUA baris,
    // supaya History cukup 1x fetch untuk semua BON (bukan per BON).
    const filtered = rows
      .filter((row) => !no_bon || row[0] === no_bon)
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