"use client";
import { useState, useEffect } from "react";

// Keterangan rentang jam shift, berbeda di hari Sabtu. Dihitung di client
// hanya untuk KETERANGAN/INFO (bukan validasi keras) — shift yang sebenarnya
// tersimpan dihitung di server (lib/waktuHelperPM.js) saat submit BON.
function getKeteranganShiftPMClient() {
  const now = new Date();
  const hari = now.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", weekday: "short" });
  const isSabtu = hari === "Sat";
  if (isSabtu) {
    return { "Shift 1": "07:00 - 12:00", "Shift 2": "12:00 - 17:00", "Shift 3": "17:00 - 22:00" };
  }
  return { "Shift 1": "07:00 - 15:00", "Shift 2": "15:00 - 23:00", "Shift 3": "23:00 - 07:00" };
}

// Prediksi shift saat ini di client, hanya untuk ditampilkan sebagai info
// sebelum submit ("Shift saat ini: Shift 2 (15:00-23:00)"). Nilai final yang
// tersimpan tetap dihitung ulang di server supaya konsisten & tidak bisa
// dimanipulasi lewat jam perangkat client.
function getShiftSekarangPMClient() {
  const now = new Date();
  const hari = now.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", weekday: "short" });
  const jamStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false });
  const [jam, menit] = jamStr.split(":").map(Number);
  const totalMenit = jam * 60 + menit;
  const isSabtu = hari === "Sat";

  if (isSabtu) {
    if (totalMenit >= 7 * 60 && totalMenit < 12 * 60) return "Shift 1";
    if (totalMenit >= 12 * 60 && totalMenit < 17 * 60) return "Shift 2";
    return "Shift 3";
  }
  if (totalMenit >= 7 * 60 && totalMenit < 15 * 60) return "Shift 1";
  if (totalMenit >= 15 * 60 && totalMenit < 23 * 60) return "Shift 2";
  return "Shift 3";
}

// Cek apakah tanggal BON (format DD/MM/YYYY) sama dengan hari ini (WIB).
// Dipakai HANYA untuk membatasi Revisi (edit-bon). Tidak ada batas jam sama
// sekali di BON PM — Catat Pengiriman & input BON baru tetap bebas.
function isHariIniClient(tanggalBonId) {
  const now = new Date();
  const tanggalSekarangISO = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  if (!tanggalBonId) return false;
  const parts = tanggalBonId.split("/");
  if (parts.length !== 3) return false;
  const [d, m, y] = parts;
  const tanggalBonISO = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return tanggalBonISO === tanggalSekarangISO;
}

export default function Home() {
  const [divisi, setDivisi] = useState("");
  const [produkList, setProdukList] = useState([]);
  const [selectedSku, setSelectedSku] = useState("");
  const [selectedNama, setSelectedNama] = useState("");
  const [bomList, setBomList] = useState([]);
  const [namaPembuat, setNamaPembuat] = useState("");
  const [line, setLine] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [qtyMap, setQtyMap] = useState({});
  const [selectedTapes, setSelectedTapes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("");
  const [history, setHistory] = useState([]);
  const [filterTanggal, setFilterTanggal] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [filterLine, setFilterLine] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [modalKirim, setModalKirim] = useState(null);
  const [qtyKirim, setQtyKirim] = useState("");
  const [namaKirim, setNamaKirim] = useState("");
  const [passwordKirim, setPasswordKirim] = useState("");
  const [kirimLoading, setKirimLoading] = useState(false);
  const [kirimPesan, setKirimPesan] = useState("");
  const [riwayatKirim, setRiwayatKirim] = useState({});

  const [modalCeklis, setModalCeklis] = useState(null);
  const [passwordCeklis, setPasswordCeklis] = useState("");
  const [ceklisLoading, setCeklisLoading] = useState(false);
  const [ceklisPesan, setCeklisPesan] = useState("");
  const [statusCeklis, setStatusCeklis] = useState({});

  const [modalEdit, setModalEdit] = useState(null);
  const [qtyEdit, setQtyEdit] = useState("");
  const [namaEditor, setNamaEditor] = useState("");
  const [passwordEdit, setPasswordEdit] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editPesan, setEditPesan] = useState("");
  const [riwayatEdit, setRiwayatEdit] = useState({});

  useEffect(() => {
    if (!divisi) {
      setProdukList([]);
      setSelectedSku("");
      setSelectedNama("");
      setBomList([]);
      return;
    }
    fetch(`/api/produk?divisi=${encodeURIComponent(divisi)}`)
      .then((r) => r.json())
      .then((d) => {
        setProdukList(d.data || []);
        setSelectedSku("");
        setSelectedNama("");
        setBomList([]);
      });
  }, [divisi]);

  useEffect(() => {
    if (!selectedSku) return;
    fetch(`/api/bon-pm?sku=${selectedSku}`)
      .then((r) => r.json())
      .then((d) => {
        setBomList(d.data || []);
        setQtyMap({});
        setSelectedTapes([]);
      });
  }, [selectedSku]);

  useEffect(() => {
    fetchHistory(filterTanggal);
  }, [filterTanggal]);

  const fetchHistory = async (tanggal) => {
    setLoadingHistory(true);
    const res = await fetch(`/api/history?tanggal=${tanggal}`);
    const data = await res.json();
    const rows = data.data || [];
    setHistory(rows);
    setLoadingHistory(false);
    const noBonList = [...new Set(rows.map((r) => r.no_bon).filter(Boolean))];
    noBonList.forEach((no_bon) => {
      fetchRiwayatKirim(no_bon);
      fetchStatusCeklis(no_bon);
      fetchRiwayatEdit(no_bon);
    });
  };

  const fetchRiwayatKirim = async (no_bon) => {
    const res = await fetch(`/api/pengiriman?no_bon=${no_bon}`);
    const data = await res.json();
    setRiwayatKirim((prev) => ({ ...prev, [no_bon]: data.data || [] }));
  };

  const fetchStatusCeklis = async (no_bon) => {
    const res = await fetch(`/api/ceklis?no_bon=${no_bon}`);
    const data = await res.json();
    setStatusCeklis((prev) => ({ ...prev, [no_bon]: data.data || [] }));
  };

  const fetchRiwayatEdit = async (no_bon) => {
    const res = await fetch(`/api/edit-bon?no_bon=${no_bon}`);
    const data = await res.json();
    setRiwayatEdit((prev) => ({ ...prev, [no_bon]: data.data || [] }));
  };

  const isSudahCeklis = (no_bon, material_code) => {
    const list = statusCeklis[no_bon] || [];
    return list.find((c) => c.material_code === material_code);
  };

  const getTotalKirim = (no_bon, material_code) => {
    const riwayat = riwayatKirim[no_bon] || [];
    return riwayat
      .filter((r) => r.material_code === material_code)
      .reduce((sum, r) => sum + Number(r.qty_kirim), 0);
  };

  const isAdaEditSetelahKirim = (no_bon, material_code) => {
    const edits = (riwayatEdit[no_bon] || []).filter((r) => r.nama_pm === material_code);
    const kirims = (riwayatKirim[no_bon] || []).filter((r) => r.material_code === material_code);
    if (edits.length === 0) return false;
    if (kirims.length === 0) return false;
    // Cek apakah ada edit setelah pengiriman terakhir
    const lastKirim = kirims[kirims.length - 1]?.jam_kirim || "";
    const lastEdit = edits[edits.length - 1]?.waktu || "";
    return lastEdit > lastKirim;
  };

  const hasRiwayatEdit = (no_bon, nama_pm) => {
    const edits = riwayatEdit[no_bon] || [];
    return edits.some((r) => r.nama_pm === nama_pm);
  };

  // Definisi "sudah lunas" hanya dipakai untuk INFO tampilan (badge hijau di
  // history), BUKAN untuk mengunci tombol edit. Qty selalu boleh diedit
  // selama masih hari yang sama dengan tanggal BON — lihat isTerkunciEdit.
  const isSudahLunas = (item) => {
    const riwayat = riwayatKirim[item.no_bon] || [];
    const kirimanItem = riwayat.filter((r) => r.material_code === item.material_code);
    if (kirimanItem.length === 0) return false;

    const totalKirim = kirimanItem.reduce((sum, r) => sum + Number(r.qty_kirim || 0), 0);
    const sudahLunas = totalKirim >= Number(item.qty_bon);
    const adaJamKirim = kirimanItem.some((r) => r.jam_kirim && r.jam_kirim.trim() !== "");

    return sudahLunas && adaJamKirim;
  };

  // Revisi (edit) HANYA dibatasi oleh HARI: harus hari yang sama dengan
  // tanggal BON. Tidak ada lagi full-lock karena "sudah lunas" — qty tetap
  // boleh diedit naik/turun bebas, dengan syarat tidak kurang dari total
  // yang sudah dikirim (divalidasi di handleEdit & backend).
  const isTerkunciEdit = (item) => {
    return !isHariIniClient(item.tanggal);
  };

  const handleDivisiChange = (e) => {
    setDivisi(e.target.value);
    setQtyMap({});
    setSelectedTapes([]);
    setBomList([]);
  };

  const handleProdukChange = (e) => {
    const sku = e.target.value;
    const nama = produkList.find((p) => p.sku === sku)?.nama || "";
    setSelectedSku(sku);
    setSelectedNama(nama);
  };

  const handleQtyChange = (code, val) => {
    setQtyMap((prev) => ({ ...prev, [code]: val }));
  };

  const handleAddTape = (materialCode) => {
    if (!materialCode) return;
    const bahan = bomList.find((b) => b.material_code === materialCode);
    if (!bahan) return;
    if (selectedTapes.find((t) => t.material_code === materialCode)) return;
    setSelectedTapes((prev) => [...prev, { ...bahan, qty: "" }]);
  };

  const handleRemoveTape = (materialCode) => {
    setSelectedTapes((prev) => prev.filter((t) => t.material_code !== materialCode));
  };

  const handleTapeQty = (materialCode, val) => {
    setSelectedTapes((prev) =>
      prev.map((t) => (t.material_code === materialCode ? { ...t, qty: val } : t))
    );
  };

  const isOptional = (nama) => {
    const n = nama?.toUpperCase() || "";
    return n.includes("PACKING TAPE") || n.includes("TTR") || n.includes("CATRIDGE") || n.includes("THERMAL TRANSFER");
  };

  const packingTapes = bomList.filter((b) => isOptional(b.nama_pm));
  const nonTapes = bomList.filter((b) => !isOptional(b.nama_pm));

  const generateNoBon = () => {
    const now = new Date();
    const tgl = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `BON-${tgl}-${rand}`;
  };

  const handleSubmit = async () => {
    if (!divisi || !selectedSku || !namaPembuat || !line || !tujuan) {
      setPesan("⚠️ Lengkapi semua field terlebih dahulu!");
      return;
    }
    const items = [
      ...nonTapes.map((b) => ({
        material_code: b.material_code,
        nama_pm: b.nama_pm,
        qty_bon: qtyMap[b.material_code] || 0,
        uom: b.uom,
      })),
      ...selectedTapes.map((t) => ({
        material_code: t.material_code,
        nama_pm: t.nama_pm,
        qty_bon: t.qty || 0,
        uom: t.uom,
      })),
    ];
    setLoading(true); setPesan("");
    const res = await fetch("/api/bon-pm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        no_bon: generateNoBon(),
        tanggal: new Date().toLocaleDateString("id-ID"),
        nama_pembuat: namaPembuat,
        line, tujuan, keterangan,
        sku_produk: selectedSku,
        nama_produk: selectedNama,
        divisi,
        items,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setPesan("✅ BON PM berhasil disimpan!");
      setDivisi(""); setSelectedSku(""); setSelectedNama(""); setBomList([]);
      setNamaPembuat(""); setLine("");
      setTujuan(""); setKeterangan(""); setQtyMap({}); setSelectedTapes([]);
      fetchHistory(filterTanggal);
    } else {
      setPesan("❌ Gagal menyimpan: " + data.error);
    }
  };

  const handleOpenKirim = (item, group) => {
    setModalKirim({
      no_bon: item.no_bon,
      material_code: item.material_code,
      nama_pm: item.nama_pm,
      nama_pembuat: group.nama_pembuat,
      shift: group.shift,
      qty_bon: item.qty_bon,
      uom: item.uom,
    });
    setQtyKirim(""); setNamaKirim(""); setPasswordKirim(""); setKirimPesan("");
    fetchRiwayatKirim(item.no_bon);
  };

  const handleKirim = async () => {
    if (!namaKirim.trim()) { setKirimPesan("⚠️ Nama pengirim wajib diisi!"); return; }
    if (!passwordKirim) { setKirimPesan("⚠️ Password wajib diisi!"); return; }
    if (!qtyKirim || Number(qtyKirim) <= 0) { setKirimPesan("⚠️ Masukkan qty yang valid!"); return; }
    setKirimLoading(true); setKirimPesan("");
    const res = await fetch("/api/pengiriman", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        no_bon: modalKirim.no_bon,
        material_code: modalKirim.material_code,
        nama_pm: modalKirim.nama_pm,
        qty_kirim: Number(qtyKirim),
        nama_pembuat: namaKirim,
        password: passwordKirim,
        qty_bon: modalKirim.qty_bon,
      }),
    });
    const data = await res.json();
    setKirimLoading(false);
    if (data.success) {
      setKirimPesan(`✅ Terkirim ${qtyKirim} ${modalKirim.uom} pada ${data.jam_kirim}`);
      setQtyKirim(""); setNamaKirim(""); setPasswordKirim("");
      fetchRiwayatKirim(modalKirim.no_bon);
    } else {
      setKirimPesan("❌ " + data.error);
    }
  };

  const handleOpenCeklis = (item) => {
    setModalCeklis({ no_bon: item.no_bon, material_code: item.material_code, nama_pm: item.nama_pm });
    setPasswordCeklis(""); setCeklisPesan("");
  };

  const handleCeklis = async () => {
    if (!passwordCeklis) { setCeklisPesan("⚠️ Password wajib diisi!"); return; }
    setCeklisLoading(true); setCeklisPesan("");
    const res = await fetch("/api/ceklis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        no_bon: modalCeklis.no_bon,
        material_code: modalCeklis.material_code,
        password: passwordCeklis,
      }),
    });
    const data = await res.json();
    setCeklisLoading(false);
    if (data.success) {
      setCeklisPesan(`✅ Berhasil diceklis pada ${data.jam_ceklis}`);
      fetchStatusCeklis(modalCeklis.no_bon);
      setTimeout(() => { setModalCeklis(null); setPasswordCeklis(""); setCeklisPesan(""); }, 1500);
    } else {
      setCeklisPesan("❌ " + data.error);
    }
  };

  const handleOpenEdit = (item) => {
    // Guard tambahan: kalau item sudah lunas ATAU sudah lewat hari, jangan
    // buka modal sama sekali.
    if (isTerkunciEdit(item)) return;

    setModalEdit({
      no_bon: item.no_bon,
      material_code: item.material_code,
      nama_pm: item.nama_pm,
      qty_bon: item.qty_bon,
      uom: item.uom,
    });
    setQtyEdit(item.qty_bon);
    setNamaEditor("");
    setPasswordEdit("");
    setEditPesan("");
    fetchRiwayatEdit(item.no_bon);
  };

  const handleEdit = async () => {
    if (!namaEditor.trim()) { setEditPesan("⚠️ Nama editor wajib diisi!"); return; }
    if (!passwordEdit) { setEditPesan("⚠️ Password wajib diisi!"); return; }
    if (!qtyEdit || Number(qtyEdit) < 0) { setEditPesan("⚠️ Masukkan qty yang valid!"); return; }
    if (Number(qtyEdit) === Number(modalEdit.qty_bon)) { setEditPesan("⚠️ Qty sama, tidak ada perubahan!"); return; }

    // Qty selalu boleh diedit naik/turun bebas selama masih hari yang sama,
    // dengan satu batasan: tidak boleh kurang dari total yang sudah dikirim.
    const totalSudahKirim = getTotalKirim(modalEdit.no_bon, modalEdit.material_code);
    if (totalSudahKirim > 0 && Number(qtyEdit) < totalSudahKirim) {
      setEditPesan(`⚠️ Qty tidak boleh kurang dari jumlah yang sudah dikirim (${totalSudahKirim} ${modalEdit.uom}).`);
      return;
    }

    setEditLoading(true); setEditPesan("");
    const res = await fetch("/api/edit-bon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        no_bon: modalEdit.no_bon,
        material_code: modalEdit.material_code,
        nama_pm: modalEdit.nama_pm,
        qty_lama: modalEdit.qty_bon,
        qty_baru: Number(qtyEdit),
        nama_editor: namaEditor,
        password: passwordEdit,
      }),
    });
    const data = await res.json();
    setEditLoading(false);
    if (data.success) {
      setEditPesan(`✅ Qty diubah dari ${modalEdit.qty_bon} → ${qtyEdit}`);
      fetchRiwayatEdit(modalEdit.no_bon);
      fetchHistory(filterTanggal);
      setTimeout(() => { setModalEdit(null); setQtyEdit(""); setNamaEditor(""); setPasswordEdit(""); setEditPesan(""); }, 1500);
    } else {
      setEditPesan("❌ " + data.error);
    }
  };

  const handleDownloadPDF = () => {
    const grouped = history
      .filter((row) => filterLine === "" || row.line === filterLine)
      .reduce((acc, row) => {
        const key = `${row.shift}-Line${row.line}-${row.nama_pembuat}`;
        if (!acc[key]) acc[key] = { ...row, items: [] };
        acc[key].items.push(row);
        return acc;
      }, {});

    const tanggalFormatted = new Date(filterTanggal).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric"
    });

    let html = `
      <html><head><title>BON PM ${tanggalFormatted}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
        h2 { font-size: 14px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 16px; font-size: 11px; }
        .group { margin-bottom: 20px; page-break-inside: avoid; }
        .group-header { background: #1d4ed8; color: white; padding: 6px 10px; font-weight: bold; display: flex; justify-content: space-between; border-radius: 4px 4px 0 0; }
        .produk { background: #f3f4f6; padding: 4px 10px; font-size: 10px; color: #444; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #e5e7eb; text-align: left; padding: 4px 8px; font-size: 10px; }
        td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
        .ok { color: #16a34a; font-weight: bold; }
        .kurang { color: #ea580c; }
      </style></head><body>
      <h2>📋 Laporan BON PM - ${tanggalFormatted}</h2>
      <div class="subtitle">Dicetak pada: ${new Date().toLocaleString("id-ID")}</div>
    `;

    Object.entries(grouped).forEach(([key, group]) => {
      html += `
        <div class="group">
          <div class="group-header">
            <span>${group.shift} · Line ${group.line} · ${group.nama_pembuat}</span>
            <span>${group.tanggal}</span>
          </div>
          <div class="produk">${group.nama_produk}</div>
          <table>
            <thead><tr>
              <th>Nama PM</th><th>QTY BON</th><th>UOM</th>
              <th>Total Kirim</th><th>Status Kirim</th><th>Input Sistem</th>
            </tr></thead>
            <tbody>
      `;
      group.items.forEach((item) => {
        const totalKirim = getTotalKirim(item.no_bon, item.material_code);
        const sudahLunas = totalKirim >= Number(item.qty_bon);
        const sudahCeklis = isSudahCeklis(item.no_bon, item.material_code);
        html += `
          <tr>
            <td>${item.nama_pm}</td><td>${item.qty_bon}</td><td>${item.uom}</td>
            <td class="${sudahLunas ? "ok" : "kurang"}">${totalKirim}</td>
            <td class="${sudahLunas ? "ok" : "kurang"}">${sudahLunas ? "✓ Lunas" : "Belum Lunas"}</td>
            <td class="${sudahCeklis ? "ok" : "kurang"}">${sudahCeklis ? "✓ Sudah" : "Belum"}</td>
          </tr>
        `;
      });
      html += `</tbody></table></div>`;
    });
    html += `</body></html>`;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <main className="min-h-screen bg-gray-100 p-3 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Form BON PM */}
        <div className="bg-white rounded-xl shadow p-4 md:p-6">
          <h1 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
            📋 BON PM WAFER MI JAYANTI 2
          </h1>
          <div className="flex flex-col gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Divisi</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={divisi} onChange={handleDivisiChange}>
                <option value="">-- Pilih Divisi --</option>
                <option value="Wafer Flat">Wafer Flat</option>
                <option value="Wafer Stick">Wafer Stick</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nama Pembuat</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nama lengkap" value={namaPembuat} onChange={(e) => setNamaPembuat(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Shift (Otomatis)</label>
                <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700">
                  {getShiftSekarangPMClient()} <span className="text-gray-400">({getKeteranganShiftPMClient()[getShiftSekarangPMClient()]} WIB)</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Ditentukan otomatis dari jam saat ini. {new Date().toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }) === "Sat" ? "Hari Sabtu memakai jam kerja lebih singkat." : ""}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Line Produksi</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="No. Line" value={line} onChange={(e) => setLine(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tujuan</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={tujuan} onChange={(e) => setTujuan(e.target.value)}>
                <option value="">-- Pilih Tujuan --</option>
                <option value="Ekspor">Ekspor</option>
                <option value="Lokal">Lokal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Keterangan</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Opsional" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Pilih Produk</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={selectedSku} onChange={handleProdukChange} disabled={!divisi}>
              <option value="">{divisi ? "-- Pilih Produk --" : "-- Pilih Divisi Dulu --"}</option>
              {produkList.map((p) => (<option key={p.sku} value={p.sku}>{p.sku} - {p.nama}</option>))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Daftar Bahan PM (Otomatis dari BOM)</label>
            {packingTapes.length > 0 && (
              <select className="w-full border rounded-lg px-3 py-2 text-sm mb-3" onChange={(e) => { handleAddTape(e.target.value); e.target.value = ""; }} defaultValue="">
                <option value="">-- Tambah PM --</option>
                {packingTapes.filter((t) => !selectedTapes.find((s) => s.material_code === t.material_code)).map((t) => (<option key={t.material_code} value={t.material_code}>{t.nama_pm}</option>))}
              </select>
            )}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-2 py-2">Kode</th>
                    <th className="text-left px-2 py-2">Nama PM</th>
                    <th className="text-left px-2 py-2">UOM</th>
                    <th className="text-left px-2 py-2">QTY</th>
                  </tr>
                </thead>
                <tbody>
                  {nonTapes.length === 0 && selectedTapes.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-4 text-gray-400 text-xs">
                      {!divisi ? "Pilih divisi terlebih dahulu..." : !selectedSku ? "Silakan pilih produk terlebih dahulu..." : "Memuat data..."}
                    </td></tr>
                  ) : (
                    <>
                      {nonTapes.map((b) => (
                        <tr key={b.material_code} className="border-t">
                          <td className="px-2 py-2 text-xs">{b.material_code}</td>
                          <td className="px-2 py-2 text-xs">{b.nama_pm}</td>
                          <td className="px-2 py-2 text-xs">{b.uom}</td>
                          <td className="px-2 py-2"><input type="number" className="border rounded px-2 py-1 w-16 text-xs" placeholder="0" value={qtyMap[b.material_code] || ""} onChange={(e) => handleQtyChange(b.material_code, e.target.value)} /></td>
                        </tr>
                      ))}
                      {selectedTapes.map((t) => (
                        <tr key={t.material_code} className="border-t bg-blue-50">
                          <td className="px-2 py-2 text-xs">{t.material_code}</td>
                          <td className="px-2 py-2 text-xs flex items-center gap-1">
                            <button onClick={() => handleRemoveTape(t.material_code)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
                            {t.nama_pm}
                          </td>
                          <td className="px-2 py-2 text-xs">{t.uom}</td>
                          <td className="px-2 py-2"><input type="number" className="border rounded px-2 py-1 w-16 text-xs" placeholder="0" value={t.qty || ""} onChange={(e) => handleTapeQty(t.material_code, e.target.value)} /></td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {pesan && <div className="mb-3 p-3 rounded-lg bg-blue-50 text-blue-800 font-medium text-sm">{pesan}</div>}
          <button onClick={handleSubmit} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-base">
            {loading ? "Menyimpan..." : "💾 Simpan Nota BON PM"}
          </button>
        </div>

        {/* History BON PM */}
        <div className="bg-white rounded-xl shadow p-4 md:p-6">
          <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg md:text-xl font-bold">📊 History BON PM</h2>
            <div className="flex gap-2 flex-wrap">
              <select className="flex-1 border rounded-lg px-2 py-2 text-sm" value={filterLine} onChange={(e) => setFilterLine(e.target.value)}>
                <option value="">Semua Line</option>
                {[...new Set(history.map((r) => r.line))].filter(Boolean).sort().map((l) => (<option key={l} value={l}>Line {l}</option>))}
              </select>
              <input type="date" className="flex-1 border rounded-lg px-2 py-2 text-sm" value={filterTanggal} onChange={(e) => setFilterTanggal(e.target.value)} />
              {history.length > 0 && (
                <button onClick={handleDownloadPDF} className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-3 py-2 rounded-lg whitespace-nowrap">
                  📄 PDF
                </button>
              )}
            </div>
          </div>

          {loadingHistory ? (
            <p className="text-center text-gray-400 py-4 text-sm">Memuat data...</p>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-400 py-4 text-sm">Tidak ada data untuk tanggal ini.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(
                history
                  .filter((row) => filterLine === "" || row.line === filterLine)
                  .reduce((acc, row) => {
                    const key = `${row.shift}-Line${row.line}-${row.nama_pembuat}`;
                    if (!acc[key]) acc[key] = { ...row, items: [] };
                    acc[key].items.push(row);
                    return acc;
                  }, {})
              ).map(([key, group]) => (
                <div key={key} className="border rounded-lg overflow-hidden">
                  <div className="bg-blue-600 text-white px-3 py-2 text-sm font-medium flex justify-between">
                    <span>{group.shift} · Line {group.line} · {group.nama_pembuat}</span>
                    <span>{group.tanggal}</span>
                  </div>
                  <div className="px-3 py-1 bg-gray-50 text-xs text-gray-600 font-medium">{group.nama_produk}</div>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left px-2 py-1">Nama PM</th>
                        <th className="text-left px-2 py-1">BON</th>
                        <th className="text-left px-2 py-1">Krm</th>
                        <th className="text-left px-2 py-1">✏️</th>
                        <th className="text-left px-2 py-1">🚚</th>
                        <th className="text-left px-2 py-1">☑️</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item, i) => {
                        const totalKirim = getTotalKirim(item.no_bon, item.material_code);
                        const sudahLunas = totalKirim >= Number(item.qty_bon);
                        const ceklisInfo = isSudahCeklis(item.no_bon, item.material_code);
                        const adaEdit = hasRiwayatEdit(item.no_bon, item.nama_pm);
                        const terkunci = isTerkunciEdit(item);
                        const judulKunci = terkunci
                          ? "Sudah lewat hari, revisi hanya berlaku di hari yang sama dengan tanggal BON"
                          : "";
                        return (
                          <tr key={i} className={`border-t ${sudahLunas ? "bg-green-50" : ""}`}>
                            <td className="px-2 py-1">{item.nama_pm}</td>
                            <td className="px-2 py-1">{item.qty_bon} {item.uom}</td>
                            <td className="px-2 py-1">
                              <span className={sudahLunas ? "text-green-600 font-bold" : "text-orange-500"}>{totalKirim}</span>
                            </td>
                            <td className="px-2 py-1">
                              <button
                                onClick={() => handleOpenEdit(item)}
                                disabled={terkunci}
                                title={judulKunci}
                                className={`text-white text-xs font-bold px-2 py-1 rounded-lg ${
                                  terkunci
                                    ? "bg-gray-300 cursor-not-allowed"
                                    : "bg-yellow-500 hover:bg-yellow-600"
                                }`}
                              >
                                {terkunci ? "🔒" : "✏️"}
                              </button>
                            </td>
                            <td className="px-2 py-1">
                              <button
                                onClick={() => handleOpenKirim(item, group)}
                                className={`text-white text-xs font-bold px-2 py-1 rounded-lg ${adaEdit ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"}`}
                              >
                                {adaEdit ? "⚠️🚚" : "🚚"}
                              </button>
                            </td>
                            <td className="px-2 py-1">
                              {ceklisInfo ? (
                                <span className="text-green-600 font-bold text-xs">✅</span>
                              ) : (
                                <button onClick={() => handleOpenCeklis(item)} className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-lg">☑️</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Modal Edit QTY */}
      {modalEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-1">✏️ Edit QTY BON</h3>
            <p className="text-xs text-gray-500 mb-1">No BON: {modalEdit.no_bon}</p>
            <p className="text-sm font-medium mb-4">{modalEdit.nama_pm}</p>

            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <p className="text-[11px] text-amber-700">
                Revisi hanya berlaku pada hari yang sama dengan tanggal BON. Qty boleh diubah bebas, asal tidak kurang dari jumlah yang sudah dikirim.
              </p>
            </div>

            {(riwayatEdit[modalEdit.no_bon] || []).filter((r) => r.nama_pm === modalEdit.nama_pm).length > 0 && (
              <div className="mb-4 bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">Riwayat Perubahan:</p>
                <div className="space-y-1">
                  {(riwayatEdit[modalEdit.no_bon] || []).filter((r) => r.nama_pm === modalEdit.nama_pm).map((r, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-600">
                      <span>• {r.qty_lama} → {r.qty_baru} {modalEdit.uom} — {r.nama_editor || "-"}</span>
                      <span className="text-gray-400">{r.waktu}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 mb-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Editor</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nama lengkap" value={namaEditor} onChange={(e) => setNamaEditor(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Masukkan password" value={passwordEdit} onChange={(e) => setPasswordEdit(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">QTY Baru ({modalEdit.uom}) — saat ini: {modalEdit.qty_bon}</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Masukkan qty baru" value={qtyEdit} onChange={(e) => setQtyEdit(e.target.value)} />
                {getTotalKirim(modalEdit.no_bon, modalEdit.material_code) > 0 && (
                  <p className="text-[11px] text-indigo-600 mt-1">
                    ℹ️ Sudah dikirim {getTotalKirim(modalEdit.no_bon, modalEdit.material_code)} {modalEdit.uom} — qty baru tidak boleh kurang dari ini.
                  </p>
                )}
              </div>
            </div>

            {editPesan && <div className="mb-3 p-2 rounded-lg bg-blue-50 text-blue-800 text-sm">{editPesan}</div>}
            <div className="flex gap-2">
              <button onClick={() => { setModalEdit(null); setQtyEdit(""); setNamaEditor(""); setPasswordEdit(""); setEditPesan(""); }} className="flex-1 border rounded-xl py-2 text-sm text-gray-600">Batal</button>
              <button onClick={handleEdit} disabled={editLoading} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl py-2 text-sm">
                {editLoading ? "Menyimpan..." : "✏️ Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengiriman */}
      {modalKirim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-1">🚚 Catat Pengiriman</h3>
            <p className="text-xs text-gray-500 mb-1">
              No BON: {modalKirim.no_bon} {modalKirim.shift && <span className="text-indigo-500 font-medium">· {modalKirim.shift}</span>}
            </p>
            <p className="text-sm font-medium mb-1">{modalKirim.nama_pm}</p>

            {/* Notifikasi jika ada edit */}
            {hasRiwayatEdit(modalKirim.no_bon, modalKirim.nama_pm) && (
              <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                ⚠️ QTY BON item ini pernah diubah! Pastikan qty kirim sesuai dengan BON terbaru ({modalKirim.qty_bon} {modalKirim.uom}).
              </div>
            )}

            <p className="text-xs text-gray-500 mb-4">
              QTY BON: {modalKirim.qty_bon} {modalKirim.uom} · Sudah terkirim: {getTotalKirim(modalKirim.no_bon, modalKirim.material_code)} {modalKirim.uom}
            </p>
            {(riwayatKirim[modalKirim.no_bon] || []).filter((r) => r.material_code === modalKirim.material_code).length > 0 && (
              <div className="mb-4 bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">Riwayat Pengiriman:</p>
                <div className="space-y-1">
                  {(riwayatKirim[modalKirim.no_bon] || []).filter((r) => r.material_code === modalKirim.material_code).map((r, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-600">
                      <span>
                        • {r.qty_kirim} {modalKirim.uom} — {r.nama_pembuat}
                        {modalKirim.shift && (
                          <span className="ml-1 inline-block bg-indigo-100 text-indigo-700 rounded px-1.5 text-[10px] font-semibold align-middle">
                            {modalKirim.shift}
                          </span>
                        )}
                      </span>
                      <span className="text-gray-400">{r.jam_kirim}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-3 mb-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Pengirim</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nama lengkap" value={namaKirim} onChange={(e) => setNamaKirim(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Password" value={passwordKirim} onChange={(e) => setPasswordKirim(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  QTY Kirim ({modalKirim.uom}) — sisa: {Number(modalKirim.qty_bon) - getTotalKirim(modalKirim.no_bon, modalKirim.material_code)}
                </label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Masukkan qty" value={qtyKirim} onChange={(e) => setQtyKirim(e.target.value)} />
              </div>
            </div>
            {kirimPesan && <div className="mb-3 p-2 rounded-lg bg-blue-50 text-blue-800 text-sm">{kirimPesan}</div>}
            <div className="flex gap-2">
              <button onClick={() => { setModalKirim(null); setQtyKirim(""); setNamaKirim(""); setPasswordKirim(""); setKirimPesan(""); }} className="flex-1 border rounded-xl py-2 text-sm text-gray-600">Tutup</button>
              <button onClick={handleKirim} disabled={kirimLoading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-2 text-sm">
                {kirimLoading ? "Menyimpan..." : "🚚 Catat Kirim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ceklis per Item */}
      {modalCeklis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-1">☑️ Ceklis Input Sistem</h3>
            <p className="text-xs text-gray-500 mb-1">No BON: {modalCeklis.no_bon}</p>
            <p className="text-sm font-medium mb-4">{modalCeklis.nama_pm}</p>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Password</label>
              <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Masukkan password" value={passwordCeklis} onChange={(e) => setPasswordCeklis(e.target.value)} />
            </div>
            {ceklisPesan && <div className="mb-3 p-2 rounded-lg bg-blue-50 text-blue-800 text-sm">{ceklisPesan}</div>}
            <div className="flex gap-2">
              <button onClick={() => { setModalCeklis(null); setPasswordCeklis(""); setCeklisPesan(""); }} className="flex-1 border rounded-xl py-2 text-sm text-gray-600">Batal</button>
              <button onClick={handleCeklis} disabled={ceklisLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-2 text-sm">
                {ceklisLoading ? "Menyimpan..." : "✅ Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}