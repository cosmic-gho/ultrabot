"use client";

export default function BrokerReadinessCard({
  brokerConfigured,
  brokerLabel,
  startBlockedReason,
  onOpenSettings,
}) {
  const isReady = brokerConfigured && !startBlockedReason;
  const isWarning = brokerConfigured && Boolean(startBlockedReason);

  const iconClass = isReady
    ? "fa-solid fa-shield-halved"
    : isWarning
    ? "fa-solid fa-triangle-exclamation"
    : "fa-solid fa-link-slash";

  const accentClass = isReady
    ? "bg-success/10 text-success border-success/20"
    : isWarning
    ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
    : "bg-danger/10 text-danger border-danger/20";

  const title = isReady ? "Broker Ready" : brokerConfigured ? "Broker Needs Attention" : "Broker Not Linked";
  const message = isReady
    ? `${brokerLabel} is connected and symbol mappings are validated.`
    : startBlockedReason || "Link a broker account to begin setup.";

  return (
    <div className="glass-panel p-6 mb-8 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl ${accentClass}`}>
            <i className={iconClass}></i>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">Broker Readiness</h3>
              <span className={`status-badge ${isReady ? "running" : brokerConfigured ? "error" : "stopped"}`}>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isReady ? "bg-success" : brokerConfigured ? "bg-yellow-400" : "bg-textMuted"
                  }`}
                ></span>
                {title}
              </span>
            </div>
            <p className="text-sm text-textMain">{message}</p>
            <p className="text-xs text-textMuted mt-2">
              Provider: {brokerConfigured ? brokerLabel : "Not linked yet"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="btn btn-secondary !w-auto px-5 flex items-center gap-2 self-start lg:self-center"
        >
          <i className="fa-solid fa-gear"></i>
          Open Broker Settings
        </button>
      </div>
    </div>
  );
}
