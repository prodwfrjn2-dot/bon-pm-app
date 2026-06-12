"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [produkList, setProdukList] = useState([]);
  const [selectedSku, setSelectedSku] = useState("");
  const [selectedNama, setSelectedNama] = useState("");
  const [bomList, setBomList] = useState([]);
  const [namaPembuat, setNamaPembuat] = useState("");
  const [shift, setShift] = useState("");
  const [line, setLine] = useState("");
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

  useEffect(() => {
    fetch("/api/produk")
      .then((r) => r.json())
      .then((d) => setProdukList(d.data || []));
  }, []);

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
    setHistory(data.data || []);
    setLoadingHistory(false);
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

  const packingTapes = bomList.filter((b) =>
    b.nama_pm?.toUpperCase().includes("PACKING TAPE")
  );

  const nonTapes = bomList.filter((b) =>
    !b.nama_pm?.toUpperCase().includes("PACKING TAPE")
  );

  const generateNoBon = () => {
    const now = new Date();
    const tgl = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `BON-${tgl}-${rand}`;
  };

  const handleSubmit = async () => {
    if (!selectedSku || !namaPembuat || !shift || !line) {
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
    setLoading(true);
    setPesan("");
    const res = await fetch("/api/bon-pm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        no_bon: generateNoBon(),
        tanggal: new Date().toLocaleDateString("id-ID"),
        nama_pembuat: namaPembuat,
        shift,
        line,
        sku_produk: selectedSku,
        nama_produk: selectedNama,
        items,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setPesan("✅ BON PM berhasil disimpan!");
      setSelectedSku("");
      setSelectedNama("");
      setBomList([]);
      setNamaPembuat("");
      setShift("");
      setLine("");
      setQtyMap({});
      setSelectedTapes([]);
      fetchHistory(filterTanggal);
    } else {
      setPesan("❌ Gagal menyimpan: " + data.error);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Form BON PM */}
        <div className="bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            📋 BON PM Waferflat
          </h1>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block font-medium mb-1">Nama Pembuat</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Nama lengkap"
                value={namaPembuat}
                onChange={(e) => setNamaPembuat(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Shift</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
              >
                <option value="">-- Pilih Shift --</option>
                <option value="Shift 1">Shift 1</option>
                <option value="Shift 2">Shift 2</option>
                <option value="Shift 3">Shift 3</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Line Produksi</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="No. Line"
                value={line}
                onChange={(e) => setLine(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block font-medium mb-1">Pilih Produk</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={selectedSku}
              onChange={handleProdukChange}
            >
              <option value="">-- Pilih Produk --</option>
              {produkList.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} - {p.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block font-medium mb-1">
              Daftar Bahan PM (Otomatis dari BOM)
            </label>

            {packingTapes.length > 0 && (
              <div className="flex gap-2 mb-3">
                <select
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  onChange={(e) => {
                    handleAddTape(e.target.value);
                    e.target.value = "";
                  }}
                  defaultValue=""
                >
                  <option value="">-- Tambah Packing Tape --</option>
                  {packingTapes
                    .filter((t) => !selectedTapes.find((s) => s.material_code === t.material_code))
                    .map((t) => (
                      <option key={t.material_code} value={t.material_code}>
                        {t.nama_pm}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2">Kode Material</th>
                    <th className="text-left px-3 py-2">Nama PM</th>
                    <th className="text-left px-3 py-2">UOM</th>
                    <th className="text-left px-3 py-2">QTY BON</th>
                  </tr>
                </thead>
                <tbody>
                  {nonTapes.length === 0 && selectedTapes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-gray-400">
                        {selectedSku ? "Memuat data..." : "Silakan pilih produk terlebih dahulu..."}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {nonTapes.map((b) => (
                        <tr key={b.material_code} className="border-t">
                          <td className="px-3 py-2">{b.material_code}</td>
                          <td className="px-3 py-2">{b.nama_pm}</td>
                          <td className="px-3 py-2">{b.uom}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="border rounded px-2 py-1 w-24"
                              placeholder="0"
                              value={qtyMap[b.material_code] || ""}
                              onChange={(e) => handleQtyChange(b.material_code, e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                      {selectedTapes.map((t) => (
                        <tr key={t.material_code} className="border-t bg-blue-50">
                          <td className="px-3 py-2">{t.material_code}</td>
                          <td className="px-3 py-2 flex items-center gap-2">
                            <button
                              onClick={() => handleRemoveTape(t.material_code)}
                              className="text-red-400 hover:text-red-600 font-bold"
                            >✕</button>
                            {t.nama_pm}
                          </td>
                          <td className="px-3 py-2">{t.uom}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="border rounded px-2 py-1 w-24"
                              placeholder="0"
                              value={t.qty || ""}
                              onChange={(e) => handleTapeQty(t.material_code, e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {pesan && (
            <div className="mb-4 p-3 rounded-lg bg-blue-50 text-blue-800 font-medium">
              {pesan}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-lg"
          >
            {loading ? "Menyimpan..." : "💾 Simpan Nota BON PM"}
          </button>
        </div>

        {/* History BON PM */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">📊 History BON PM</h2>
            <div className="flex gap-2">
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={filterLine}
                onChange={(e) => setFilterLine(e.target.value)}
              >
                <option value="">Semua Line</option>
                {[...new Set(history.map((r) => r.line))].filter(Boolean).sort().map((l) => (
                  <option key={l} value={l}>Line {l}</option>
                ))}
              </select>
              <input
                type="date"
                className="border rounded-lg px-3 py-2 text-sm"
                value={filterTanggal}
                onChange={(e) => setFilterTanggal(e.target.value)}
              />
            </div>
          </div>

          {loadingHistory ? (
            <p className="text-center text-gray-400 py-4">Memuat data...</p>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-400 py-4">Tidak ada data untuk tanggal ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2">Tanggal</th>
                    <th className="text-left px-3 py-2">Nama</th>
                    <th className="text-left px-3 py-2">Shift</th>
                    <th className="text-left px-3 py-2">Line</th>
                    <th className="text-left px-3 py-2">Produk</th>
                    <th className="text-left px-3 py-2">Nama PM</th>
                    <th className="text-left px-3 py-2">QTY</th>
                    <th className="text-left px-3 py-2">UOM</th>
                  </tr>
                </thead>
                <tbody>
                  {history.filter((row) => filterLine === "" || row.line === filterLine).map((row, i) => (
                    <tr key={i} className={`border-t ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                      <td className="px-3 py-2">{row.tanggal}</td>
                      <td className="px-3 py-2">{row.nama_pembuat}</td>
                      <td className="px-3 py-2">{row.shift}</td>
                      <td className="px-3 py-2">{row.line}</td>
                      <td className="px-3 py-2">{row.nama_produk}</td>
                      <td className="px-3 py-2">{row.nama_pm}</td>
                      <td className="px-3 py-2">{row.qty_bon}</td>
                      <td className="px-3 py-2">{row.uom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}