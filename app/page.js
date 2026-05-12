"use client";
import { useState, useEffect, useRef } from "react";
import StatsCards from "./components/StatsCards";
import BotControl from "./components/BotControl";
import BotConfig from "./components/BotConfig";
import BrokerSettings from "./components/BrokerSettings";
import BrokerReadinessCard from "./components/BrokerReadinessCard";
import EquityChart from "./components/EquityChart";
import TradeHistory from "./components/TradeHistory";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function Home() {
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");

  // Auth form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [brokerConfigured, setBrokerConfigured] = useState(false);
  const [brokerProvider, setBrokerProvider] = useState("");
  const [startBlockedReason, setStartBlockedReason] = useState("Link and validate a broker account before starting the bot.");

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState({
    status: "offline",
    win_rate: "0.00",
    total_pnl: "0.00",
    active_trades: 0,
    recent_trades: [],
    recent_activity: [],
    winning_trades: 0,
    losing_trades: 0,
    max_win_streak: 0,
    max_loss_streak: 0,
    profit_factor: 0,
  });

  // Bot Status
  const [botStatus, setBotStatus] = useState({
    status: "stopped",
    started_at: null,
    last_heartbeat: null,
    uptime_seconds: 0,
    is_alive: false,
    error_message: "",
    last_cycle_status: "",
    last_cycle_message: "",
  });
  const [botLoading, setBotLoading] = useState(false);

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pollIntervalRef = useRef(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      loadAppConfig(savedToken);
      startPolling(savedToken);
    }
    return () => stopPolling();
  }, []);

  const fetchAPI = async (endpoint, options = {}, currentToken) => {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (currentToken || token) {
      headers["Authorization"] = `Bearer ${currentToken || token}`;
    }

    // For URLSearchParams (OAuth form)
    if (options.body instanceof URLSearchParams) {
      delete headers["Content-Type"];
    }

    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
      const error = new Error("Session expired.");
      error.isAuthError = true;
      throw error;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "API Error");
    return data;
  };

  const loadAppConfig = async (t) => {
    try {
      const brokerData = await fetchAPI("/account/broker", {}, t);
      setBrokerConfigured(Boolean(brokerData.configured));
      setBrokerProvider(brokerData.provider || "");
      if (!brokerData.configured) {
        setStartBlockedReason("Link and validate a broker account before starting the bot.");
      } else {
        await refreshStartReadiness(t);
      }
    } catch (e) {
      setBrokerConfigured(false);
      setBrokerProvider("");
      setStartBlockedReason("Link and validate a broker account before starting the bot.");
      console.error(e);
    }
  };

  const isMissingUserSymbolsReason = (reason = "") =>
    reason.toLowerCase().includes("save user bot symbols first") ||
    reason.toLowerCase().includes("no user bot symbols configured");

  const refreshStartReadiness = async (currentToken) => {
    try {
      const botConfigData = await fetchAPI("/bot/config", {}, currentToken);
      if (!Array.isArray(botConfigData.symbols) || botConfigData.symbols.length === 0) {
        const reason = "Save user bot symbols first in Bot Configuration.";
        setStartBlockedReason(reason);
        return reason;
      }

      const brokerData = await fetchAPI("/account/broker", {}, currentToken);
      if (!brokerData.configured) {
        const reason = "Link and validate a broker account before starting the bot.";
        setStartBlockedReason(reason);
        return reason;
      }
      if (!brokerData.connection_ok) {
        const reason = brokerData.connection_message || "Broker connection failed. Update credentials first.";
        setStartBlockedReason(reason);
        return reason;
      }

      const validationData = await fetchAPI("/account/broker/symbols", {}, currentToken);
      const invalidSymbols = (validationData.results || [])
        .filter((result) => !result.is_valid)
        .map((result) => result.symbol);

      if (invalidSymbols.length) {
        const reason = `Fix invalid symbols before starting: ${invalidSymbols.join(", ")}`;
        setStartBlockedReason(reason);
        return reason;
      }

      setStartBlockedReason("");
      return "";
    } catch (error) {
      if (!error.isAuthError) {
        const reason = error.message || "Broker readiness check failed.";
        setStartBlockedReason(reason);
        return reason;
      }
      throw error;
    }
  };

  const pollDashboard = async (t) => {
    try {
      const [dashData, statusData] = await Promise.all([
        fetchAPI("/dashboard", {}, t),
        fetchAPI("/bot/status", {}, t),
      ]);
      setDashboardData(dashData);
      setBotStatus(statusData);
    } catch (err) {
      if (!err.isAuthError) {
        console.error("Poll Error", err);
      }
    }
  };

  const startPolling = (t) => {
    stopPolling();
    pollDashboard(t);
    pollIntervalRef.current = setInterval(() => pollDashboard(t), 5000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // ─── Auth ───
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);

    try {
      const data = await fetchAPI("/auth/login", { method: "POST", body });
      const t = data.access || data.access_token;
      setToken(t);
      localStorage.setItem("token", t);
      loadAppConfig(t);
      startPolling(t);
      setUsername("");
      setPassword("");
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    const body = JSON.stringify({ username, password });

    try {
      await fetchAPI("/auth/register", { method: "POST", body });
      setAuthSuccess("Registration successful! Please log in.");
      setTimeout(() => setAuthMode("login"), 2000);
      setUsername("");
      setPassword("");
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    stopPolling();
    setActiveSection("dashboard");
    setBrokerConfigured(false);
    setBrokerProvider("");
    setStartBlockedReason("Link and validate a broker account before starting the bot.");
  };

  // ─── Bot Control ───
  const handleBotStart = async () => {
    setBotLoading(true);
    try {
      const readinessError = await refreshStartReadiness();
      if (readinessError) {
        setActiveSection(isMissingUserSymbolsReason(readinessError) ? "config" : "settings");
        alert(readinessError);
        return;
      }
      await fetchAPI("/bot/start", { method: "POST" });
      // Refresh status
      const statusData = await fetchAPI("/bot/status");
      setBotStatus(statusData);
    } catch (err) {
      alert(err.message);
    } finally {
      setBotLoading(false);
    }
  };

  const handleBotStop = async () => {
    setBotLoading(true);
    try {
      await fetchAPI("/bot/stop", { method: "POST" });
      const statusData = await fetchAPI("/bot/status");
      setBotStatus(statusData);
    } catch (err) {
      alert(err.message);
    } finally {
      setBotLoading(false);
    }
  };

  // ─── Nav Items ───
  const navItems = [
    { key: "dashboard", icon: "fa-solid fa-house", label: "Dashboard" },
    { key: "history", icon: "fa-solid fa-clock-rotate-left", label: "Trade History" },
    { key: "config", icon: "fa-solid fa-sliders", label: "Bot Config" },
    { key: "settings", icon: "fa-solid fa-gear", label: "Broker Account" },
  ];

  const brokerLabel = brokerProvider
    ? brokerProvider === "capitalcom"
      ? "Capital.com"
      : brokerProvider.toUpperCase()
    : "Broker";
  const isBotRunning = botStatus.status === "running";
  const isBotAlive = Boolean(botStatus.is_alive);
  const isBotStarting = isBotRunning && !isBotAlive;
  const botIndicatorTone = isBotRunning && isBotAlive ? "running" : isBotStarting ? "starting" : botStatus.status === "error" ? "error" : "";
  const botIndicatorLabel = isBotRunning && isBotAlive ? "Bot Online" : isBotStarting ? "Bot Starting" : botStatus.status === "error" ? "Bot Error" : "Bot Offline";
  const recentActivity = Array.isArray(dashboardData.recent_activity)
    ? [...dashboardData.recent_activity].reverse()
    : [];

  const getActivityMeta = (status) => {
    switch ((status || "").toLowerCase()) {
      case "trade_executed":
        return {
          icon: "fa-solid fa-circle-check",
          tone: "text-success",
          label: "Trade Executed",
        };
      case "trade_failed":
      case "error":
        return {
          icon: "fa-solid fa-circle-xmark",
          tone: "text-danger",
          label: "Trade Failed",
        };
      case "trade_blocked":
      case "rejected":
        return {
          icon: "fa-solid fa-ban",
          tone: "text-yellow-300",
          label: "Signal Rejected",
        };
      case "cooldown":
        return {
          icon: "fa-solid fa-hourglass-half",
          tone: "text-primary",
          label: "Cooldown",
        };
      case "signal_detected":
      case "accepted":
        return {
          icon: "fa-solid fa-wave-square",
          tone: "text-primary",
          label: "Signal Detected",
        };
      case "waiting":
        return {
          icon: "fa-solid fa-clock",
          tone: "text-textMuted",
          label: "Waiting",
        };
      default:
        return {
          icon: "fa-solid fa-circle-info",
          tone: "text-textMuted",
          label: "Activity",
        };
    }
  };

  // ═══════════════════════════════════════════
  //  AUTH SCREEN
  // ═══════════════════════════════════════════
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen p-5">
        <div className="glass-panel w-full max-w-md p-10 text-center animate-fade-in-up">
          <div className="flex items-center gap-3 justify-center mb-8 text-primary">
            <i className="fa-solid fa-chart-line text-2xl"></i>
            <h2 className="text-textMain text-2xl font-semibold">
              Ultra Trading SaaS
            </h2>
          </div>

          {authMode === "login" ? (
            <div>
              <h3 className="text-xl mb-5 font-medium">Welcome Back</h3>
              <form onSubmit={handleLogin}>
                <div className="input-group">
                  <i className="fa-solid fa-user"></i>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                  />
                </div>
                <div className="input-group">
                  <i className="fa-solid fa-lock"></i>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Log In
                </button>
                <p className="mt-5 text-textMuted text-sm">
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                      setAuthSuccess("");
                    }}
                    className="text-primary font-medium"
                  >
                    Create an account
                  </button>
                </p>
              </form>
            </div>
          ) : (
            <div>
              <h3 className="text-xl mb-5 font-medium">Create Account</h3>
              <form onSubmit={handleRegister}>
                <div className="input-group">
                  <i className="fa-solid fa-user"></i>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a Username"
                    required
                  />
                </div>
                <div className="input-group">
                  <i className="fa-solid fa-lock"></i>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create Password"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Register
                </button>
                <p className="mt-5 text-textMuted text-sm">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                      setAuthSuccess("");
                    }}
                    className="text-primary font-medium"
                  >
                    Log In
                  </button>
                </p>
              </form>
            </div>
          )}

          {authError && (
            <div className="text-danger mt-4 text-sm">{authError}</div>
          )}
          {authSuccess && (
            <div className="text-success mt-4 text-sm">{authSuccess}</div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  MAIN APP
  // ═══════════════════════════════════════════
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`glass-panel w-[260px] p-6 flex flex-col rounded-none border-r border-t-0 border-b-0 border-l-0 border-glassBorder z-40 shrink-0
          fixed lg:relative h-full transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex items-center gap-3 mb-8 text-primary">
          <i className="fa-solid fa-chart-line text-2xl"></i>
          <h2 className="text-textMain text-xl font-semibold">UltraSaaS</h2>
        </div>

        <ul className="nav-links flex-grow mt-2">
          {navItems.map((item) => (
            <li
              key={item.key}
              className={activeSection === item.key ? "active" : ""}
              onClick={() => {
                setActiveSection(item.key);
                setSidebarOpen(false);
              }}
            >
              <i className={`${item.icon} w-5`}></i>
              {item.label}
            </li>
          ))}
        </ul>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="btn btn-secondary flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="glass-panel px-6 lg:px-10 py-5 flex justify-between items-center rounded-none border-b border-t-0 border-l-0 border-r-0 border-glassBorder sticky top-0 z-10">
          {/* Mobile menu button */}
          <button
            className="lg:hidden text-textMuted text-xl"
            onClick={() => setSidebarOpen(true)}
          >
            <i className="fa-solid fa-bars"></i>
          </button>

          <div className="flex items-center gap-3 ml-auto">
            {brokerConfigured && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-glassBorder text-xs text-textMuted">
                <i className="fa-solid fa-link"></i>
                {brokerLabel} Linked
              </div>
            )}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/5 rounded-full border border-glassBorder text-sm">
              <span className={`pulse ${botIndicatorTone}`}></span>
              <span>{botIndicatorLabel}</span>
            </div>
          </div>
        </header>

        {/* ═══ DASHBOARD ═══ */}
        {activeSection === "dashboard" && (
          <section className="p-6 lg:p-10 w-full max-w-[1200px] mx-auto">
            <h1 className="text-3xl font-semibold mb-8">Live Performance</h1>

            {/* Bot Control */}
            <BotControl
              botStatus={botStatus}
              onStart={handleBotStart}
              onStop={handleBotStop}
              loading={botLoading}
              startBlockedReason={startBlockedReason}
            />

            <BrokerReadinessCard
              brokerConfigured={brokerConfigured}
              brokerLabel={brokerLabel}
              startBlockedReason={startBlockedReason}
              onOpenSettings={() => setActiveSection("settings")}
            />

            {/* Stats Cards */}
            <StatsCards dashboardData={dashboardData} />

            {/* Equity Chart */}
            <EquityChart trades={dashboardData.recent_trades} />

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="glass-panel p-6 animate-fade-in-up xl:col-span-1">
                <h3 className="font-medium text-lg mb-5 flex items-center gap-2">
                  <i className="fa-solid fa-bolt text-primary"></i>
                  Recent Activity
                </h3>
                {!recentActivity.length ? (
                  <div className="py-8 text-center text-textMuted text-sm">
                    <i className="fa-solid fa-inbox text-xl mb-2 block opacity-30"></i>
                    No recent bot activity yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((item, idx) => {
                      const meta = getActivityMeta(item.status);
                      return (
                        <div
                          key={`${item.timestamp || "activity"}-${idx}`}
                          className="rounded-xl border border-glassBorder bg-white/5 px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <i className={`${meta.icon} ${meta.tone} mt-0.5`}></i>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3 mb-1">
                                <span className={`text-xs font-medium uppercase tracking-wide ${meta.tone}`}>
                                  {meta.label}
                                </span>
                                <span className="text-[11px] text-textMuted shrink-0">
                                  {item.timestamp
                                    ? new Date(item.timestamp).toLocaleTimeString()
                                    : "--"}
                                </span>
                              </div>
                              <p className="text-sm text-textMain leading-6">
                                {item.message || "Bot activity recorded."}
                              </p>
                              {item.symbol && (
                                <div className="mt-2 text-[11px] uppercase tracking-wide text-textMuted">
                                  {item.symbol}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Trades */}
              <div className="glass-panel p-6 animate-fade-in-up xl:col-span-2">
                <h3 className="font-medium text-lg mb-5 flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-primary"></i>
                  Recent Trades
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-4 text-textMuted font-medium border-b border-glassBorder">
                          Symbol
                        </th>
                        <th className="p-4 text-textMuted font-medium border-b border-glassBorder">
                          Type
                        </th>
                        <th className="p-4 text-textMuted font-medium border-b border-glassBorder">
                          Entry
                        </th>
                        <th className="p-4 text-textMuted font-medium border-b border-glassBorder">
                          Conf
                        </th>
                        <th className="p-4 text-textMuted font-medium border-b border-glassBorder">
                          Stop Loss
                        </th>
                        <th className="p-4 text-textMuted font-medium border-b border-glassBorder">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {!dashboardData.recent_trades ||
                      dashboardData.recent_trades.length === 0 ? (
                        <tr>
                          <td
                            colSpan="6"
                            className="p-6 text-center text-textMuted border-b border-glassBorder"
                          >
                            <i className="fa-solid fa-inbox text-xl mb-1 block opacity-30"></i>
                            No recent trades
                          </td>
                        </tr>
                      ) : (
                        [...dashboardData.recent_trades]
                          .reverse()
                          .map((t, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-white/5 transition-colors"
                            >
                              <td className="p-4 border-b border-glassBorder font-medium">
                                {t.symbol || "--"}
                              </td>
                              <td
                                className={`p-4 border-b border-glassBorder font-medium ${
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
                                {t.direction || "--"}
                              </td>
                              <td className="p-4 border-b border-glassBorder">
                                {t.entry_price || "--"}
                              </td>
                              <td className="p-4 border-b border-glassBorder">
                                {t.confidence
                                  ? (t.confidence * 100).toFixed(1) + "%"
                                  : "--"}
                              </td>
                              <td className="p-4 border-b border-glassBorder text-danger">
                                {t.stop_loss || "--"}
                              </td>
                              <td className="p-4 border-b border-glassBorder text-textMuted text-xs">
                                {t.timestamp
                                  ? new Date(t.timestamp).toLocaleTimeString()
                                  : "--"}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══ TRADE HISTORY ═══ */}
        {activeSection === "history" && (
          <section className="p-6 lg:p-10 w-full max-w-[1200px] mx-auto">
            <h1 className="text-3xl font-semibold mb-8">Trade History</h1>
            <TradeHistory fetchAPI={fetchAPI} />
          </section>
        )}

        {/* ═══ BOT CONFIG ═══ */}
        {activeSection === "config" && (
          <section className="p-6 lg:p-10 w-full max-w-[600px] mx-auto">
            <h1 className="text-3xl font-semibold mb-8">Bot Configuration</h1>
            <BotConfig
              fetchAPI={fetchAPI}
              onConfigChange={(configData) => {
                const symbols = Array.isArray(configData?.symbols) ? configData.symbols : [];
                if (!symbols.length) {
                  setStartBlockedReason("Save user bot symbols first in Bot Configuration.");
                  return;
                }
                refreshStartReadiness();
              }}
            />
          </section>
        )}

        {/* ═══ BROKER SETTINGS ═══ */}
        {activeSection === "settings" && (
          <section className="p-6 lg:p-10 w-full max-w-[900px] mx-auto">
            <h1 className="text-3xl font-semibold mb-8">Broker Integration</h1>
            <BrokerSettings
              fetchAPI={fetchAPI}
              onConfiguredChange={(configured, provider) => {
                setBrokerConfigured(Boolean(configured));
                setBrokerProvider(provider || "");
              }}
              onReadinessChange={(ready, reason) => {
                setStartBlockedReason(ready ? "" : reason || "Validate broker symbols before starting the bot.");
              }}
            />
          </section>
        )}
      </main>
    </div>
  );
}
