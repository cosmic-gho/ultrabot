"use client";
import { useState, useEffect } from "react";

export default function TradeHistory({ fetchAPI }) {
  const [trades, setTrades] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");

  useEffect(() => {
    loadTrades();
  }, [page, symbolFilter, directionFilter]);

  const loadTrades = async () => {
    setLoading(true);
    try {
      let query = `?page=${page}&per_page=15`;
      if (symbolFilter) query += `&symbol=${symbolFilter}`;
      if (directionFilter) query += `&direction=${directionFilter}`;

      const data = await fetchAPI(`/trades/history${query}`);
      setTrades(data.trades || []);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch (e) {
      console.error("Failed to load trades:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="animate-fade-in-up">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-textMuted">
          <i className="fa-solid fa-filter"></i>
          <span>Filters:</span>
        </div>
        <input
          type="text"
          placeholder="Symbol (e.g. XAUUSD)"
          className="glass-input !w-auto !py-2 !px-3 !text-sm !mb-0"
          value={symbolFilter}
          onChange={(e) => {
            setSymbolFilter(e.target.value.toUpperCase());
            setPage(1);
          }}
        />
        <select
          className="glass-select !w-auto !py-2 !px-3 !pr-8 !text-sm"
          value={directionFilter}
          onChange={(e) => {
            setDirectionFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Directions</option>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>
        <span className="text-xs text-textMuted ml-auto">
          {total} total trades
        </span>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="p-4 text-textMuted font-medium">Symbol</th>
                <th className="p-4 text-textMuted font-medium">Direction</th>
                <th className="p-4 text-textMuted font-medium">Entry</th>
                <th className="p-4 text-textMuted font-medium">Lot Size</th>
                <th className="p-4 text-textMuted font-medium">SL</th>
                <th className="p-4 text-textMuted font-medium">TP</th>
                <th className="p-4 text-textMuted font-medium">Conf</th>
                <th className="p-4 text-textMuted font-medium">Mode</th>
                <th className="p-4 text-textMuted font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-textMuted">
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Loading trades...
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-textMuted">
                    <i className="fa-solid fa-inbox text-2xl mb-2 block opacity-30"></i>
                    No trades found
                  </td>
                </tr>
              ) : (
                trades.map((t, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-glassBorder hover:bg-white/[0.03] transition-colors animate-slide-in"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <td className="p-4 font-medium">{t.symbol || "—"}</td>
                    <td
                      className={`p-4 font-medium ${
                        t.direction === "BUY"
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          t.direction === "BUY"
                            ? "fa-arrow-trend-up"
                            : "fa-arrow-trend-down"
                        } mr-1`}
                      ></i>
                      {t.direction || "—"}
                    </td>
                    <td className="p-4">{t.entry_price || "—"}</td>
                    <td className="p-4">{t.lot_size || "—"}</td>
                    <td className="p-4 text-danger">{t.stop_loss || "—"}</td>
                    <td className="p-4 text-success">{t.take_profit || "—"}</td>
                    <td className="p-4">
                      {t.confidence
                        ? `${(t.confidence * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md ${
                          t.is_demo
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-success/10 text-success"
                        }`}
                      >
                        {t.is_demo ? "Demo" : "Live"}
                      </span>
                    </td>
                    <td className="p-4 text-textMuted text-xs">
                      {formatDate(t.timestamp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-glassBorder">
            <span className="text-xs text-textMuted">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <i className="fa-solid fa-chevron-left mr-1"></i> Prev
              </button>
              <button
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next <i className="fa-solid fa-chevron-right ml-1"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
