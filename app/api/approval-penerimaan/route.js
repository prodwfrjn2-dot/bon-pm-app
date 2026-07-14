import { getSheets, SHEET_ID } from "@/lib/googleSheets";

// Sheet baru: Approval_Penerimaan_BON
// Kolom: A no_bon | B material_code | C status (Approved/Rejected) |
//        D alasan_reject | E nama_approver | F waktu_approval

export async function GET(request) {
  try {
    const sheets = await getSheets();
    const { searchParams } = new URL(request.url);
    const no_bon = searchParams.get("no_bon");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Approval_Penerimaan_BON!A2:F10000",
    });

    const rows = response.data.values || [];
    const filtered = rows
      .filter((row) => row[0] === no_bon)
      .map((row) => ({
        no_bon: row[0] || "",
        material_code: row[1] || "",
        status: row[2] || "",
        alasan_reject: row[3] || "",
        nama_approver: row[4] || "",
        waktu_approval: row[5] || "",
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
    const { no_bon, material_code, status, alasan_reject, nama_approver, password } = body;

    // 1. Validasi status hanya boleh Approved / Rejected
    if (status !== "Approved" && status !== "Rejected") {
      return new Response(
        JSON.stringify({ success: false, error: "Status approval tidak valid!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Kalau reject, alasan wajib diisi
    if (status === "Rejected" && (!alasan_reject || alasan_reject.trim() === "")) {
      return new Response(
        JSON.stringify({ success: false, error: "Alasan penolakan wajib diisi!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Validasi nama approver wajib diisi
    if (!nama_approver || nama_approver.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "Nama Supervisor wajib diisi!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Validasi input password wajib diisi
    if (!password || password.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "Password wajib diisi!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Cek password di sheet Users KOLOM D (sama dengan password Ceklis,
    //    sesuai permintaan: approval memakai password yang sudah ada)
    const usersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Users!D2:D1000",
    });

    const passwords = (usersRes.data.values || [])
      .map((row) => row[0])
      .filter((pass) => pass && pass.trim() !== "");

    if (!passwords.includes(password.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: "Password salah!" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 6. Ambil data approval yang sudah ada untuk item ini
    const approvalRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Approval_Penerimaan_BON!A2:F10000",
    });
    const rows = approvalRes.data.values || [];
    const existingIndex = rows.findIndex(
      (row) => row[0] === no_bon && row[1] === material_code
    );

    // Item yang sudah Approved tidak boleh diubah lagi. Item yang Rejected
    // BOLEH ditimpa (misal setelah pengirim mengirim ulang / memperbaiki),
    // supaya alur "reject -> perbaikan -> approve lagi" tetap berjalan.
    if (existingIndex !== -1 && rows[existingIndex][2] === "Approved") {
      return new Response(
        JSON.stringify({ success: false, error: "Item ini sudah di-approve sebelumnya!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const waktu_approval = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const rowValues = [
      no_bon,
      material_code,
      status,
      status === "Rejected" ? alasan_reject.trim() : "",
      nama_approver,
      waktu_approval,
    ];

    if (existingIndex !== -1) {
      // Update baris reject sebelumnya (baris ke existingIndex+2 karena data mulai A2)
      const rowNumber = existingIndex + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Approval_Penerimaan_BON!A${rowNumber}:F${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowValues] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "Approval_Penerimaan_BON!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowValues] },
      });
    }

    return new Response(
      JSON.stringify({ success: true, waktu_approval, status }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}