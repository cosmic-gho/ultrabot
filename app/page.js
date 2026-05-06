"use client";
import { useState, useEffect, useRef } from "react";
import StatsCards from "./components/StatsCards";
import BotControl from "./components/BotControl";
import BotConfig from "./components/BotConfig";
import EquityChart from "./components/EquityChart";
import TradeHistory from "./components/TradeHistory";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function Home() {
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mt5Login, setMt5Login] = useState("");
  const [mt5Password, setMt5Password] = useState("");
  const [mt5Server, setMt5Server] = useState("");
  const [mt5Status, setMt5Status] = useState("");
  const [mt5Configured, setMt5Configured] = useState(false);

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState({
    status: "offline",
    win_rate: "0.00",
    total_pnl: "0.00",
    active_trades: 0,
    recent_trades: [],
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
      const configData = await fetchAPI("/account/config", {}, t);
      if (configData.configured) {
        setMt5Server(configData.server || "");
        setMt5Configured(true);
      }
    } catch (e) {
      console.error(e);
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
    setMt5Configured(false);
  };

  // ─── MT5 ───
  const handleMT5Link = async (e) => {
    e.preventDefault();
    setMt5Status("");
    const body = JSON.stringify({
      login: parseInt(mt5Login),
      password: mt5Password,
      server: mt5Server,
    });

    try {
      await fetchAPI("/account/mt5", { method: "POST", body });
      setMt5Status("success");
      setMt5Configured(true);
      setTimeout(() => setMt5Status(""), 3000);
    } catch (err) {
      setMt5Status("error");
      alert("Failed to link MT5: " + err.message);
    }
  };

  // ─── Bot Control ───
  const handleBotStart = async () => {
    setBotLoading(true);
    try {
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
    { key: "settings", icon: "fa-solid fa-gear", label: "MT5 Account" },
  ];

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
            {mt5Configured && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-glassBorder text-xs text-textMuted">
                <i className="fa-solid fa-link"></i>
                MT5 Linked
              </div>
            )}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/5 rounded-full border border-glassBorder text-sm">
              <span
                className={`pulse ${
                  botStatus.status === "running" && botStatus.is_alive
                    ? "running"
                    : botStatus.status === "error"
                    ? "error"
                    : ""
                }`}
              ></span>
              <span>
                {botStatus.status === "running" && botStatus.is_alive
                  ? "Bot Online"
                  : botStatus.status === "error"
                  ? "Bot Error"
                  : "Bot Offline"}
              </span>
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
            />

            {/* Stats Cards */}
            <StatsCards dashboardData={dashboardData} />

            {/* Equity Chart */}
            <EquityChart trades={dashboardData.recent_trades} />

            {/* Recent Trades */}
            <div className="glass-panel p-6 animate-fade-in-up">
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
            <BotConfig fetchAPI={fetchAPI} />
          </section>
        )}

        {/* ═══ MT5 SETTINGS ═══ */}
        {activeSection === "settings" && (
          <section className="p-6 lg:p-10 w-full max-w-[600px] mx-auto">
            <h1 className="text-3xl font-semibold mb-8">MT5 Integration</h1>
            <div className="glass-panel p-8 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <i className="fa-solid fa-link"></i>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Link MT5 Account</h3>
                  <p className="text-xs text-textMuted">
                    Provide your MetaTrader 5 credentials
                  </p>
                </div>
              </div>

              {mt5Configured && (
                <div className="my-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm flex items-center gap-2">
                  <i className="fa-solid fa-circle-check"></i>
                  MT5 account is linked. You can update credentials below.
                </div>
              )}

              {mt5Status === "success" && (
                <div className="mb-6 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm flex items-center gap-2 animate-slide-in">
                  <i className="fa-solid fa-circle-check"></i> MT5 Account
                  Linked Successfully!
                </div>
              )}

              <form onSubmit={handleMT5Link} className="mt-4">
                <div className="config-field">
                  <label>MT5 Login ID</label>
                  <input
                    type="number"
                    className="glass-input"
                    value={mt5Login}
                    onChange={(e) => setMt5Login(e.target.value)}
                    required
                  />
                </div>
                <div className="config-field">
                  <label>Password</label>
                  <input
                    type="password"
                    className="glass-input"
                    value={mt5Password}
                    onChange={(e) => setMt5Password(e.target.value)}
                    required
                  />
                </div>
                <div className="config-field">
                  <label>Server</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={mt5Server}
                    onChange={(e) => setMt5Server(e.target.value)}
                    placeholder="e.g. TenTrade-Server"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary mt-2">
                  <i className="fa-solid fa-plug mr-2"></i>
                  {mt5Configured ? "Update Credentials" : "Connect Broker"}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
