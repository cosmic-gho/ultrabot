"use client";

export default function BotControl({ botStatus, onStart, onStop, loading, startBlockedReason = "" }) {
  const isRunning = botStatus?.status === "running";
  const isError = botStatus?.status === "error";
  const isAlive = botStatus?.is_alive;
  const startBlocked = !isRunning && Boolean(startBlockedReason);

  const formatUptime = (seconds) => {
    if (!seconds || seconds <= 0) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "Never";
    const d = new Date(isoStr);
    return d.toLocaleTimeString();
  };

  return (
    <div className="glass-panel p-6 mb-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left — status info */}
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 ${
              isRunning && isAlive
                ? "bg-success/15 text-success pulse-glow"
                : isError
                ? "bg-danger/15 text-danger"
                : "bg-white/5 text-textMuted"
            }`}
          >
            <i
              className={`fa-solid ${
                isRunning && isAlive
                  ? "fa-robot"
                  : isError
                  ? "fa-triangle-exclamation"
                  : "fa-power-off"
              }`}
            ></i>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg">Trading Bot</h3>
              <span
                className={`status-badge ${
                  isRunning && isAlive
                    ? "running"
                    : isError
                    ? "error"
                    : "stopped"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRunning && isAlive
                      ? "bg-success"
                      : isError
                      ? "bg-danger"
                      : "bg-textMuted"
                  }`}
                ></span>
                {isRunning && isAlive
                  ? "Running"
                  : isError
                  ? "Error"
                  : "Stopped"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-textMuted">
              {isRunning && (
                <>
                  <span>
                    <i className="fa-solid fa-clock mr-1"></i>
                    Uptime: {formatUptime(botStatus?.uptime_seconds)}
                  </span>
                  <span>
                    <i className="fa-solid fa-heart-pulse mr-1"></i>
                    Last ping: {formatTime(botStatus?.last_heartbeat)}
                  </span>
                </>
              )}
              {isError && botStatus?.error_message && (
                <span className="text-danger">
                  <i className="fa-solid fa-circle-exclamation mr-1"></i>
                  {botStatus.error_message}
                </span>
              )}
              {startBlocked && (
                <span className="text-yellow-400">
                  <i className="fa-solid fa-shield-halved mr-1"></i>
                  {startBlockedReason}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right — toggle */}
        <button
          onClick={isRunning ? onStop : onStart}
          disabled={loading || startBlocked}
          className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border ${
            loading || startBlocked
              ? "opacity-50 cursor-not-allowed bg-white/5 border-glassBorder text-textMuted"
              : isRunning
              ? "bg-danger/15 border-danger/30 text-danger hover:bg-danger/25"
              : "bg-success/15 border-success/30 text-success hover:bg-success/25"
          }`}
        >
          {loading ? (
            <i className="fa-solid fa-spinner fa-spin"></i>
          ) : (
            <i
              className={`fa-solid ${isRunning ? "fa-stop" : "fa-play"}`}
            ></i>
          )}
          {loading ? "Processing..." : isRunning ? "Stop Bot" : "Start Bot"}
        </button>
      </div>
    </div>
  );
}
