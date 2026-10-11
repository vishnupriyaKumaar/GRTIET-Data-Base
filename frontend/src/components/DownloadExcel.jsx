import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import { saveBlob, blobErrorMessage } from "../download.js";
import { IconDownload } from "./Icons.jsx";

// Dialog shown when downloading Excel: the admin picks, batch by batch,
// which columns should be displayed (and printed) in the downloaded file.
export default function DownloadExcel({ onClose }) {
  const [columns, setColumns] = useState([]);
  const [batches, setBatches] = useState([]);
  // { [batch]: { include: boolean, keys: string[] } }
  const [sel, setSel] = useState({});
  const [openBatch, setOpenBatch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.get("/students/meta/columns"), api.get("/students/meta/batches")])
      .then(([c, b]) => {
        if (!alive) return;
        const cols = c.data.data;
        const list = [...b.data.data].sort();
        setColumns(cols);
        setBatches(list);
        setSel(Object.fromEntries(list.map((batch) => [batch, { include: true, keys: cols.map((x) => x.key) }])));
        setOpenBatch(list.length === 1 ? list[0] : "");
      })
      .catch((err) => setError(err.response?.data?.message || "Could not load batches and columns."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const groups = useMemo(() => {
    const map = new Map();
    columns.forEach((c) => {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group).push(c);
    });
    return [...map.entries()];
  }, [columns]);

  const allKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const update = (batch, patch) => setSel((s) => ({ ...s, [batch]: { ...s[batch], ...patch } }));
  const toggleKeys = (batch, keys, on) => {
    const cur = new Set(sel[batch].keys);
    keys.forEach((k) => (on ? cur.add(k) : cur.delete(k)));
    update(batch, { keys: allKeys.filter((k) => cur.has(k)) });
  };
  const setAllBatches = (keys) =>
    setSel((s) => Object.fromEntries(Object.entries(s).map(([b, v]) => [b, { ...v, keys }])));

  const ready = batches.filter((b) => sel[b]?.include && sel[b].keys.length > 0);

  async function handleDownload() {
    setError("");
    if (!ready.length) {
      setError("Select at least one batch with at least one column.");
      return;
    }
    setBusy(true);
    try {
      const selections = ready.map((b) => ({
        batch: b,
        columns: sel[b].keys.length === allKeys.length ? "all" : sel[b].keys,
      }));
      const res = await api.post("/download-excel", { selections }, { responseType: "blob" });
      saveBlob(res.data, "GRT-Student-Records.xlsx");
      onClose();
    } catch (err) {
      const message = await blobErrorMessage(err, "Could not download the Excel file.");
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card download-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Download Excel</h3>
        <p className="hint-text">Choose the columns to display and print for each batch. The downloaded file is set up for A4 landscape printing.</p>

        {loading && <p>Loading…</p>}
        {!loading && batches.length === 0 && <p className="error-text">No student records yet — add a student first.</p>}

        {!loading && batches.length > 0 && (
          <>
            <div className="dl-quick">
              <button type="button" className="btn-secondary" onClick={() => setAllBatches(allKeys)}>All columns · every batch</button>
              <button type="button" className="btn-secondary" onClick={() => setAllBatches([])}>Clear all</button>
              {batches.length > 1 && (
                <button type="button" className="btn-secondary" onClick={() => setAllBatches(sel[batches[0]].keys)}>
                  Copy {batches[0]} columns to all
                </button>
              )}
            </div>

            <div className="dl-batches">
              {batches.map((batch) => {
                const cur = sel[batch];
                const isOpen = openBatch === batch;
                const all = cur.keys.length === allKeys.length;
                return (
                  <div className="dl-batch" key={batch}>
                    <div className="dl-batch-head">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={cur.include} onChange={(e) => update(batch, { include: e.target.checked })} />
                        <strong>Batch {batch}</strong>
                      </label>
                      <span className="dl-count">{all ? "All columns" : `${cur.keys.length} of ${allKeys.length} columns`}</span>
                      <button type="button" className="btn-secondary dl-small" onClick={() => update(batch, { keys: allKeys })}>All</button>
                      <button type="button" className="btn-secondary dl-small" onClick={() => update(batch, { keys: [] })}>None</button>
                      <button type="button" className="btn-secondary dl-small" onClick={() => setOpenBatch(isOpen ? "" : batch)}>
                        {isOpen ? "Hide columns ▴" : "Choose columns ▾"}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="dl-columns">
                        {groups.map(([group, cols]) => {
                          const keys = cols.map((c) => c.key);
                          const onCount = keys.filter((k) => cur.keys.includes(k)).length;
                          return (
                            <fieldset key={group}>
                              <legend>
                                <label className="checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={onCount === keys.length}
                                    ref={(el) => el && (el.indeterminate = onCount > 0 && onCount < keys.length)}
                                    onChange={(e) => toggleKeys(batch, keys, e.target.checked)}
                                  />
                                  {group}
                                </label>
                              </legend>
                              <div className="dl-grid">
                                {cols.map((c) => (
                                  <label className="checkbox-label" key={c.key}>
                                    <input type="checkbox" checked={cur.keys.includes(c.key)} onChange={(e) => toggleKeys(batch, [c.key], e.target.checked)} />
                                    {c.header}
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={busy || loading || !ready.length} onClick={handleDownload}>
            <IconDownload /> {busy ? "Preparing…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
