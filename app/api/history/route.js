import { getSheets, SHEET_ID } from "@/lib/googleSheets";

export async function GET(request) {
  try {
    const sheets = await getSheets();
    const { searchParams } = new URL(request.url);
    const tanggal = searchParams.get("tanggal");

    // Dibaca sampai kolom N (bukan K lagi) supaya kolom "divisi" yang baru
    // ditambahkan di api/bon-pm/route.js ikut terbaca.
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "BON_PM!A2:N10000",
    });

    const rows = response.data.values || [];

    const filtered = rows
      .filter((row) => {
        if (!tanggal || !row[1]) return false;
        const tglSheet = row[1];
        const [d, m, y] = tglSheet.split("/");
        const isoTgl = `${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`;
        return isoTgl === tanggal;
      })
      .map((row) => ({
        no_bon: row[0] || "",
        tanggal: row[1] || "",
        nama_pembuat: row[2] || "",
        shift: row[3] || "",
        line: row[4] || "",
        sku_produk: row[5] || "",
        nama_produk: row[6] || "",
        material_code: row[7] || "",
        nama_pm: row[8] || "",
        qty_bon: row[9] || "",
        uom: row[10] || "",
        tujuan: row[11] || "",
        keterangan: row[12] || "",
        // BON yang disimpan sebelum kolom divisi ditambahkan akan kosong di
        // kolom N; ditandai "-" (Tidak Diketahui) supaya tetap muncul rapi
        // di grouping/filter, bukan hilang atau error.
        divisi: row[13] || "-",
      }));

    // DEBUG SEMENTARA: cek di Vercel Function Logs (Dashboard > Project >
    // Deployments > deployment aktif > Functions > /api/history) untuk
    // memastikan kolom N (row[13]) benar-benar terbaca berisi nama divisi,
    // bukan selalu kosong/"-". Hapus log ini setelah masalah terkonfirmasi
    // selesai.
    console.log(
      "[api/history] contoh 3 baris pertama (no_bon, divisi mentah):",
      rows.slice(0, 3).map((r) => ({ no_bon: r[0], divisi_mentah: r[13] }))
    );

    return new Response(JSON.stringify({ success: true, data: filtered }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}