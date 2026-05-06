"use client";
import { useState, useEffect } from "react";

const TIMEFRAME_OPTIONS = [
  { value: "M1", label: "1 Minute" },
  { value: "M5", label: "5 Minutes" },
  { value: "M15", label: "15 Minutes" },
  { value: "M30", label: "30 Minutes" },
  { value: "H1", label: "1 Hour" },
  { value: "H4", label: "4 Hours" },
];

const TIME_GAP_PRESETS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
];

export default function BotConfig({ fetchAPI }) {
  const [lotSize, setLotSize] = useState("0.01");
  const [timeframe, setTimeframe] = useState("M5");
  const [timeGap, setTimeGap] = useState(300);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await fetchAPI("/bot/config");
      setLotSize(data.lot_size || "0.01");
      setTimeframe(data.timeframe || "M5");
      setTimeGap(data.time_gap_seconds || 300);
    } catch (e) {
      console.error("Failed to load config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      await fetchAPI("/bot/config", {
        method: "PUT",
        body: JSON.stringify({
          lot_size: parseFloat(lotSize),
          timeframe,
          time_gap_seconds: parseInt(timeGap),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-8 animate-fade-in-up">
        <div className="flex items-center gap-3 text-textMuted">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <span>Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-8 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <i className="fa-solid fa-sliders"></i>
        </div>
        <div>
          <h3 className="text-lg font-semibold">Bot Configuration</h3>
          <p className="text-xs text-textMuted">
            Customize how the bot executes trades
          </p>
        </div>
      </div>

      {saved && (
        <div className="mb-6 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm flex items-center gap-2 animate-slide-in">
          <i className="fa-solid fa-circle-check"></i>
          Configuration saved successfully!
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2 animate-slide-in">
          <i className="fa-solid fa-circle-exclamation"></i>
          {error}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Lot Size */}
        <div className="config-field">
          <label>
            <i className="fa-solid fa-layer-group mr-2 text-primary"></i>
            Lot Size
          </label>
          <input
            type="number"
            className="glass-input"
            value={lotSize}
            onChange={(e) => setLotSize(e.target.value)}
            min="0.01"
            max="100"
            step="0.01"
            required
          />
          <p className="helper">
            Volume per trade. Min: 0.01, Max: 100. Higher = more risk & reward.
          </p>
        </div>

        {/* Timeframe */}
        <div className="config-field">
          <label>
            <i className="fa-solid fa-clock mr-2 text-primary"></i>
            Timeframe
          </label>
          <select
            className="glass-select"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            {TIMEFRAME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.value})
              </option>
            ))}
          </select>
          <p className="helper">
            Candle timeframe for analysis. Shorter = more trades, Longer = higher confidence.
          </p>
        </div>

        {/* Time Gap */}
        <div className="config-field">
          <label>
            <i className="fa-solid fa-hourglass-half mr-2 text-primary"></i>
            Time Gap Between Trades
          </label>
          <select
            className="glass-select"
            value={timeGap}
            onChange={(e) => setTimeGap(parseInt(e.target.value))}
          >
            {TIME_GAP_PRESETS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="helper">
            How often the bot scans for new trade setups.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary mt-2 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i> Saving...
            </>
          ) : (
            <>
              <i className="fa-solid fa-floppy-disk"></i> Save Configuration
            </>
          )}
        </button>
      </form>
    </div>
  );
}
