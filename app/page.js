"use client";
import { useState, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function Home() {
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard"); // dashboard | settings

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mt5Login, setMt5Login] = useState("");
  const [mt5Password, setMt5Password] = useState("");
  const [mt5Server, setMt5Server] = useState("");
  const [mt5Status, setMt5Status] = useState("");

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState({
    status: "offline",
    win_rate: "0.00",
    total_pnl: "0.00",
    active_trades: 0,
    recent_trades: []
  });

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
      ...options.headers
    };
    if (currentToken || token) {
      headers["Authorization"] = `Bearer ${currentToken || token}`;
    }
    
    // For URLSearchParams (OAuth form)
    if(options.body instanceof URLSearchParams) {
      delete headers["Content-Type"];
    }

    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
      // throw new Error("Session expired. Please log in again.");
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
      if(configData.configured) {
        setMt5Server(configData.server || "");
      }
    } catch(e) { 
      console.error(e);
    }
  };

  const pollDashboard = async (t) => {
    try {
      const data = await fetchAPI("/dashboard", {}, t);
      setDashboardData(data);
    } catch (err) {
      if (!err.isAuthError) {
        console.error("Dashboard Poll Error", err);
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
  };

  const handleMT5Link = async (e) => {
    e.preventDefault();
    setMt5Status("");
    const body = JSON.stringify({
      login: parseInt(mt5Login),
      password: mt5Password,
      server: mt5Server
    });

    try {
      await fetchAPI("/account/mt5", { method: "POST", body });
      setMt5Status("success");
      setTimeout(() => setMt5Status(""), 3000);
    } catch (err) {
      setMt5Status("error");
      alert("Failed to link MT5: " + err.message);
    }
  };

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen p-5">
        <div className="glass-panel w-full max-w-md p-10 text-center">
          <div className="flex items-center gap-3 justify-center mb-8 text-primary">
            <i className="fa-solid fa-chart-line text-2xl"></i>
            <h2 className="text-textMain text-2xl font-semibold">Ultra Trading SaaS</h2>
          </div>
          
          {authMode === "login" ? (
            <div>
              <h3 className="text-xl mb-5 font-medium">Welcome Back</h3>
              <form onSubmit={handleLogin}>
                <div className="input-group">
                  <i className="fa-solid fa-user"></i>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required />
                </div>
                <div className="input-group">
                  <i className="fa-solid fa-lock"></i>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
                </div>
                <button type="submit" className="btn btn-primary">Log In</button>
                <p className="mt-5 text-textMuted text-sm">New here? <button type="button" onClick={() => {setAuthMode("register"); setAuthError(""); setAuthSuccess("");}} className="text-primary font-medium">Create an account</button></p>
              </form>
            </div>
          ) : (
            <div>
              <h3 className="text-xl mb-5 font-medium">Create Account</h3>
              <form onSubmit={handleRegister}>
                <div className="input-group">
                  <i className="fa-solid fa-user"></i>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a Username" required />
                </div>
                <div className="input-group">
                  <i className="fa-solid fa-lock"></i>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create Password" required />
                </div>
                <button type="submit" className="btn btn-primary">Register</button>
                <p className="mt-5 text-textMuted text-sm">Already have an account? <button type="button" onClick={() => {setAuthMode("login"); setAuthError(""); setAuthSuccess("");}} className="text-primary font-medium">Log In</button></p>
              </form>
            </div>
          )}
          
          {authError && <div className="text-danger mt-4 text-sm">{authError}</div>}
          {authSuccess && <div className="text-success mt-4 text-sm">{authSuccess}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <nav className="glass-panel w-[260px] p-6 flex flex-col rounded-none border-r border-t-0 border-b-0 border-l-0 border-glassBorder z-20 shrink-0">
        <div className="flex items-center gap-3 mb-8 text-primary">
          <i className="fa-solid fa-chart-line text-2xl"></i>
          <h2 className="text-textMain text-xl font-semibold">UltraSaaS</h2>
        </div>
        
        <ul className="nav-links flex-grow mt-2">
          <li className={activeSection === "dashboard" ? "active" : ""} onClick={() => setActiveSection("dashboard")}>
            <i className="fa-solid fa-house w-5"></i> Dashboard
          </li>
          <li className={activeSection === "settings" ? "active" : ""} onClick={() => setActiveSection("settings")}>
            <i className="fa-solid fa-gear w-5"></i> Bot Settings
          </li>
        </ul>
        
        <div className="mt-auto">
          <button onClick={handleLogout} className="btn btn-secondary flex items-center justify-center gap-2">
            <i className="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </div>
      </nav>

      {/* Main Content Areas */}
      <main className="flex-grow flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="glass-panel px-10 py-5 flex justify-end items-center rounded-none border-b border-t-0 border-l-0 border-r-0 border-glassBorder sticky top-0 z-10">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-white/5 rounded-full border border-glassBorder text-sm">
            <span className={`pulse ${dashboardData.status === "running" ? "running" : ""}`}></span>
            <span>{dashboardData.status === "running" ? "Bot Online" : "Bot Offline (Check MT5 Settings)"}</span>
          </div>
        </header>

        {activeSection === "dashboard" && (
          <section className="p-10 w-full max-w-[1200px] mx-auto animate-in fade-in duration-500">
            <h1 className="text-3xl font-semibold mb-8">Live Performance</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="glass-panel p-6 relative transition-transform hover:-translate-y-1">
                <div className="icon-wrap bg-primary/10 text-primary"><i className="fa-solid fa-percent"></i></div>
                <h3 className="text-textMuted font-medium mt-3 mb-2">Win Rate</h3>
                <h2 className="text-4xl font-light">{dashboardData.win_rate}%</h2>
              </div>
              <div className="glass-panel p-6 relative transition-transform hover:-translate-y-1">
                <div className="icon-wrap bg-success/10 text-success"><i className="fa-solid fa-dollar-sign"></i></div>
                <h3 className="text-textMuted font-medium mt-3 mb-2">Total PnL</h3>
                <h2 className="text-4xl font-light">${parseFloat(dashboardData.total_pnl).toFixed(2)}</h2>
              </div>
              <div className="glass-panel p-6 relative transition-transform hover:-translate-y-1">
                <div className="icon-wrap bg-purple-500/10 text-purple-500"><i className="fa-solid fa-arrows-rotate"></i></div>
                <h3 className="text-textMuted font-medium mt-3 mb-2">Active Trades</h3>
                <h2 className="text-4xl font-light">{dashboardData.active_trades}</h2>
              </div>
            </div>

            <div className="glass-panel p-6">
              <h3 className="font-medium text-xl mb-5">Recent Trades</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="p-4 text-textMuted font-medium border-b border-glassBorder">Symbol</th>
                      <th className="p-4 text-textMuted font-medium border-b border-glassBorder">Type</th>
                      <th className="p-4 text-textMuted font-medium border-b border-glassBorder">Entry</th>
                      <th className="p-4 text-textMuted font-medium border-b border-glassBorder">Conf</th>
                      <th className="p-4 text-textMuted font-medium border-b border-glassBorder">Stop Loss</th>
                      <th className="p-4 text-textMuted font-medium border-b border-glassBorder">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!dashboardData.recent_trades || dashboardData.recent_trades.length === 0) ? (
                      <tr><td colSpan="6" className="p-4 text-center text-textMuted border-b border-glassBorder">No recent trades</td></tr>
                    ) : (
                      [...dashboardData.recent_trades].reverse().map((t, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 border-b border-glassBorder font-medium">{t.symbol || '--'}</td>
                          <td className={`p-4 border-b border-glassBorder ${t.direction === 'BUY' ? 'text-success' : 'text-danger'}`}>{t.direction || '--'}</td>
                          <td className="p-4 border-b border-glassBorder">{t.entry_price || '--'}</td>
                          <td className="p-4 border-b border-glassBorder">{t.confidence ? (t.confidence*100).toFixed(1)+'%' : '--'}</td>
                          <td className="p-4 border-b border-glassBorder">{t.stop_loss || '--'}</td>
                          <td className="p-4 border-b border-glassBorder text-textMuted">{t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : '--'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === "settings" && (
          <section className="p-10 w-full max-w-[1200px] mx-auto animate-in fade-in duration-500">
            <h1 className="text-3xl font-semibold mb-8">MT5 Integration</h1>
            <div className="grid gap-6 max-w-[600px]">
              <div className="glass-panel p-8 relative">
                <h3 className="text-xl mb-2 font-medium">Link MT5 Account</h3>
                <p className="text-textMuted mb-6 text-sm">Provide your MetaTrader 5 credentials for the bot to trade on your behalf.</p>
                
                {mt5Status === "success" && (
                  <div className="mb-6 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm flex items-center gap-2">
                    <i className="fa-solid fa-circle-check"></i> MT5 Account Linked Successfully!
                  </div>
                )}
                
                <form onSubmit={handleMT5Link}>
                  <div className="mb-5">
                    <label className="block mb-2 text-textMuted text-sm">MT5 Login ID</label>
                    <input type="number" className="glass-input" value={mt5Login} onChange={e => setMt5Login(e.target.value)} required />
                  </div>
                  <div className="mb-5">
                    <label className="block mb-2 text-textMuted text-sm">Password</label>
                    <input type="password" className="glass-input" value={mt5Password} onChange={e => setMt5Password(e.target.value)} required />
                  </div>
                  <div className="mb-5">
                    <label className="block mb-2 text-textMuted text-sm">Server</label>
                    <input type="text" className="glass-input" value={mt5Server} onChange={e => setMt5Server(e.target.value)} placeholder="e.g. TenTrade-Server" required />
                  </div>
                  <button type="submit" className="btn btn-primary mt-2">Connect Broker</button>
                </form>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
