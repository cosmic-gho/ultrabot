"use client";
import { useEffect, useMemo, useState } from "react";

const PROVIDERS = [
  { value: "oanda", label: "OANDA", defaultUrl: "https://api-fxpractice.oanda.com" },
  { value: "capitalcom", label: "Capital.com", defaultUrl: "https://demo-api-capital.backend-capital.com" },
];

const PRESET_SYMBOL_MAPPINGS = {
  oanda: {
    XAUUSD: "XAU_USD",
    GBPUSD: "GBP_USD",
  },
  capitalcom: {
    XAUUSD: "GOLD",
    GBPUSD: "GBPUSD",
  },
};

const EMPTY_MAPPING_ROW = { canonical: "", broker: "" };

const providerLabel = (value) =>
  PROVIDERS.find((provider) => provider.value === value)?.label || value || "Broker";

const defaultProviderUrl = (value) =>
  PROVIDERS.find((provider) => provider.value === value)?.defaultUrl || "";

const mapToRows = (mapping) => {
  const entries = Object.entries(mapping || {});
  return entries.length
    ? entries.map(([canonical, broker]) => ({ canonical, broker }))
    : [{ ...EMPTY_MAPPING_ROW }];
};

const rowsToMapping = (rows) => {
  const mapping = {};

  rows.forEach((row) => {
    const canonical = String(row.canonical || "").trim().toUpperCase();
    const broker = String(row.broker || "").trim();
    if (!canonical && !broker) {
      return;
    }
    if (!canonical || !broker) {
      throw new Error("Each mapping row must include both a canonical symbol and a broker symbol.");
    }
    mapping[canonical] = broker;
  });

  return mapping;
};

const hasNonEmptyMappingRows = (rows) =>
  (rows || []).some((row) => String(row.canonical || "").trim() || String(row.broker || "").trim());

const getSuggestedRows = (provider) => mapToRows(PRESET_SYMBOL_MAPPINGS[provider] || {});

export default function BrokerSettings({ fetchAPI, onConfiguredChange, onReadinessChange }) {
  const [provider, setProvider] = useState("oanda");
  const [accountId, setAccountId] = useState("");
  const [apiLogin, setApiLogin] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiUrl, setApiUrl] = useState(defaultProviderUrl("oanda"));
  const [maskedAccountId, setMaskedAccountId] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasStoredApiLogin, setHasStoredApiLogin] = useState(false);
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [hasStoredApiSecret, setHasStoredApiSecret] = useState(false);
  const [executionReady, setExecutionReady] = useState(false);
  const [executionMessage, setExecutionMessage] = useState("");
  const [connectionOk, setConnectionOk] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [summary, setSummary] = useState({});
  const [mappingRows, setMappingRows] = useState([{ ...EMPTY_MAPPING_ROW }]);
  const [validationResults, setValidationResults] = useState([]);
  const [lastValidatedAt, setLastValidatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [validating, setValidating] = useState(false);
  const [accountMessage, setAccountMessage] = useState({ type: "", text: "" });
  const [mappingMessage, setMappingMessage] = useState({ type: "", text: "" });

  const requiresApiLogin = provider === "capitalcom";
  const summaryEntries = useMemo(() => Object.entries(summary || {}), [summary]);
  const formattedLastValidatedAt = useMemo(() => {
    if (!lastValidatedAt) {
      return "";
    }
    const value = new Date(lastValidatedAt);
    if (Number.isNaN(value.getTime())) {
      return "";
    }
    return value.toLocaleString();
  }, [lastValidatedAt]);

  useEffect(() => {
    loadBrokerSettings();
  }, []);

  const updateReadiness = (ready, message = "") => {
    onReadinessChange?.(Boolean(ready), message || "");
  };

  const markMappingsPending = (message = "Save and validate symbol mappings before starting the bot.") => {
    setValidationResults([]);
    setLastValidatedAt(null);
    updateReadiness(false, message);
  };

  const validateSymbols = async (symbolsOverride = null, options = {}) => {
    const { quiet = false, successMessage = "" } = options;

    let symbols = symbolsOverride;
    if (!Array.isArray(symbols)) {
      try {
        symbols = Object.keys(rowsToMapping(mappingRows));
      } catch (error) {
        const reason = error.message;
        updateReadiness(false, reason);
        if (!quiet) {
          setMappingMessage({ type: "error", text: reason });
        }
        return { ready: false, reason, results: [] };
      }
    }

    if (!symbols.length) {
      const reason = "Save at least one symbol mapping before starting the bot.";
      setValidationResults([]);
      updateReadiness(false, reason);
      if (!quiet) {
        setMappingMessage({ type: "error", text: reason });
      }
      return { ready: false, reason, results: [] };
    }

    if (!quiet) {
      setValidating(true);
      setMappingMessage({ type: "", text: "" });
    }

    try {
      const query = `?symbols=${encodeURIComponent(symbols.join(","))}`;
      const data = await fetchAPI(`/account/broker/symbols${query}`);
      const results = data.results || [];
      const invalidSymbols = results.filter((result) => !result.is_valid).map((result) => result.symbol);
      setValidationResults(results);

      if (invalidSymbols.length) {
        const reason = `Fix invalid symbols before starting: ${invalidSymbols.join(", ")}`;
        updateReadiness(false, reason);
        setLastValidatedAt(null);
        if (!quiet) {
          setMappingMessage({ type: "error", text: reason });
        }
        return { ready: false, reason, results };
      }

      setLastValidatedAt(data.last_validated_at || null);
      updateReadiness(true, "");
      if (!quiet && successMessage) {
        setMappingMessage({ type: "success", text: successMessage });
      }
      return { ready: true, reason: "", results };
    } catch (error) {
      const reason = error.message || "Symbol validation failed.";
      setValidationResults([]);
      setLastValidatedAt(null);
      updateReadiness(false, reason);
      if (!quiet) {
        setMappingMessage({ type: "error", text: reason });
      }
      return { ready: false, reason, results: [] };
    } finally {
      if (!quiet) {
        setValidating(false);
      }
    }
  };

  const loadBrokerSettings = async () => {
    setLoading(true);
    try {
      const accountData = await fetchAPI("/account/broker");
      if (accountData.configured) {
        const activeProvider = accountData.provider || "oanda";
        setProvider(activeProvider);
        setApiUrl(accountData.api_url || defaultProviderUrl(activeProvider));
        setMaskedAccountId(accountData.account_id || "");
        setIsConfigured(true);
        setHasStoredApiLogin(Boolean(accountData.has_api_login));
        setHasStoredApiKey(Boolean(accountData.has_api_key));
        setHasStoredApiSecret(Boolean(accountData.has_api_secret));
        setExecutionReady(Boolean(accountData.execution_ready));
        setExecutionMessage(accountData.execution_message || "");
        setConnectionOk(Boolean(accountData.connection_ok));
        setConnectionMessage(accountData.connection_message || "");
        setSummary(accountData.summary || {});
        onConfiguredChange?.(true, activeProvider);

        try {
          const mappingData = await fetchAPI("/account/broker/mapping");
          const configuredMappings = Boolean(mappingData.configured) && Object.keys(mappingData.mappings || {}).length > 0;
          setLastValidatedAt(mappingData.last_validated_at || null);
          if (configuredMappings) {
            setMappingRows(mapToRows(mappingData.mappings));
            if (!accountData.connection_ok) {
              updateReadiness(false, accountData.connection_message || "Broker connection failed.");
            } else {
              await validateSymbols(Object.keys(mappingData.mappings), { quiet: true });
            }
          } else {
            setMappingRows(getSuggestedRows(activeProvider));
            setValidationResults([]);
            updateReadiness(false, "Save and validate symbol mappings before starting the bot.");
          }
        } catch (mappingError) {
          setMappingRows(getSuggestedRows(activeProvider));
          setValidationResults([]);
          updateReadiness(false, "Save and validate symbol mappings before starting the bot.");
          console.error("Failed to load broker mapping:", mappingError);
        }
      } else {
        resetConfiguredState();
      }
    } catch (error) {
      resetConfiguredState();
      console.error("Failed to load broker account:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetConfiguredState = () => {
    setIsConfigured(false);
    setHasStoredApiLogin(false);
    setHasStoredApiKey(false);
    setHasStoredApiSecret(false);
    setMaskedAccountId("");
    setExecutionReady(false);
    setExecutionMessage("");
    setConnectionOk(false);
    setConnectionMessage("");
    setSummary({});
    setMappingRows(getSuggestedRows(provider));
    setValidationResults([]);
    onConfiguredChange?.(false, "");
    updateReadiness(false, "Link a broker account first.");
  };

  const handleProviderChange = (nextProvider) => {
    setProvider(nextProvider);
    setApiUrl(defaultProviderUrl(nextProvider));
    setExecutionMessage("");
    setConnectionMessage("");
    setValidationResults([]);
    setMappingMessage({ type: "", text: "" });
    setMappingRows(getSuggestedRows(nextProvider));
    markMappingsPending();
  };

  const updateMappingRow = (index, key, value) => {
    markMappingsPending();
    setMappingRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, [key]: key === "canonical" ? value.toUpperCase() : value }
          : row
      )
    );
  };

  const addMappingRow = () => {
    markMappingsPending();
    setMappingRows((currentRows) => [...currentRows, { ...EMPTY_MAPPING_ROW }]);
  };

  const removeMappingRow = (index) => {
    markMappingsPending();
    setMappingRows((currentRows) => {
      if (currentRows.length === 1) {
        return [{ ...EMPTY_MAPPING_ROW }];
      }
      return currentRows.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const persistMappings = async (mappings, successMessage) => {
    setSavingMappings(true);
    setMappingMessage({ type: "", text: "" });

    try {
      const data = await fetchAPI("/account/broker/mapping", {
        method: "PUT",
        body: JSON.stringify({ mappings }),
      });
      setMappingRows(mapToRows(data.mappings));
      await validateSymbols(Object.keys(data.mappings), {
        successMessage,
      });
    } catch (error) {
      setMappingMessage({ type: "error", text: error.message });
    } finally {
      setSavingMappings(false);
    }
  };

  const upsertMappingForSymbol = async (canonicalSymbol, brokerSymbol) => {
    const normalizedCanonical = String(canonicalSymbol || "").trim().toUpperCase();
    const normalizedBroker = String(brokerSymbol || "").trim();
    if (!normalizedCanonical || !normalizedBroker) {
      return;
    }

    const nextRows = (() => {
      const existingIndex = mappingRows.findIndex(
        (row) => String(row.canonical || "").trim().toUpperCase() === normalizedCanonical
      );

      if (existingIndex >= 0) {
        return mappingRows.map((row, rowIndex) =>
          rowIndex === existingIndex ? { canonical: normalizedCanonical, broker: normalizedBroker } : row
        );
      }

      return [...mappingRows, { canonical: normalizedCanonical, broker: normalizedBroker }];
    })();

    setMappingRows(nextRows);
    await persistMappings(
      rowsToMapping(nextRows),
      `Applied ${normalizedBroker} for ${normalizedCanonical}, saved it, and revalidated successfully.`
    );
  };

  const handleSaveAccount = async (event) => {
    event.preventDefault();
    setSavingAccount(true);
    setAccountMessage({ type: "", text: "" });

    try {
      const payload = {
        provider,
        account_id: accountId,
        api_login: apiLogin,
        api_key: apiKey,
        api_secret: apiSecret,
        api_url: apiUrl,
      };
      const data = await fetchAPI("/account/broker", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMaskedAccountId(data.account_id || "");
      setIsConfigured(true);
      setHasStoredApiLogin(Boolean(data.has_api_login));
      setHasStoredApiKey(Boolean(data.has_api_key));
      setHasStoredApiSecret(Boolean(data.has_api_secret));
      setApiUrl(data.api_url || apiUrl || defaultProviderUrl(provider));
      setExecutionReady(Boolean(data.execution_ready));
      setExecutionMessage(data.execution_message || "");
      setConnectionOk(Boolean(data.connection_ok));
      setConnectionMessage(data.connection_message || "");
      setSummary(data.summary || {});
      setAccountMessage({ type: "success", text: "Broker account saved successfully." });
      onConfiguredChange?.(true, provider);
      setAccountId("");
      setApiKey("");
      setApiSecret("");
      setValidationResults([]);
      if (!hasNonEmptyMappingRows(mappingRows)) {
        setMappingRows(getSuggestedRows(provider));
      }
      updateReadiness(
        false,
        data.connection_ok
          ? "Save and validate symbol mappings before starting the bot."
          : data.connection_message || "Broker connection failed."
      );
    } catch (error) {
      setAccountMessage({ type: "error", text: error.message });
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSaveMappings = async () => {
    try {
      await persistMappings(mappingRows ? rowsToMapping(mappingRows) : {}, "Symbol mappings saved and validated successfully.");
    } catch (error) {
      setMappingMessage({ type: "error", text: error.message });
    }
  };

  const handleValidateMappings = async () => {
    await validateSymbols(null, { successMessage: "Symbol validation completed successfully." });
  };

  if (loading) {
    return (
      <div className="glass-panel p-8 animate-fade-in-up">
        <div className="flex items-center gap-3 text-textMuted">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <span>Loading broker settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="glass-panel p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <i className="fa-solid fa-building-columns"></i>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Broker Account</h3>
            <p className="text-xs text-textMuted">
              Connect a broker provider and store credentials securely on the backend
            </p>
          </div>
        </div>

        {isConfigured && (
          <div className="my-5 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="status-badge running">
                <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                {providerLabel(provider)} linked
              </span>
              {maskedAccountId && <span className="text-textMain">Account: {maskedAccountId}</span>}
              <span className={connectionOk ? "text-success" : "text-danger"}>
                {connectionOk ? "Connection OK" : "Connection check failed"}
              </span>
            </div>
            {executionMessage && (
              <p className="mt-3 text-xs text-textMuted">
                Execution: {executionReady ? "Ready" : "Not ready"} - {executionMessage}
              </p>
            )}
            {connectionMessage && (
              <p className="mt-1 text-xs text-textMuted">Connection: {connectionMessage}</p>
            )}
          </div>
        )}

        {accountMessage.text && (
          <div
            className={`mb-6 p-3 rounded-lg text-sm flex items-center gap-2 ${
              accountMessage.type === "success"
                ? "bg-success/10 border border-success/20 text-success"
                : "bg-danger/10 border border-danger/20 text-danger"
            }`}
          >
            <i
              className={`fa-solid ${
                accountMessage.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"
              }`}
            ></i>
            {accountMessage.text}
          </div>
        )}

        <form onSubmit={handleSaveAccount}>
          <div className="config-field">
            <label>Provider</label>
            <select
              className="glass-select"
              value={provider}
              onChange={(event) => handleProviderChange(event.target.value)}
            >
              {PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="config-field">
            <label>Account ID</label>
            <input
              type="text"
              className="glass-input"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder={provider === "oanda" ? "e.g. 001-011-1234567-001" : "Broker account identifier"}
              required
            />
            <p className="helper">
              {isConfigured
                ? `Stored account: ${maskedAccountId || "saved on server"}. Enter a new ID only to replace it.`
                : "This is the trading account identifier for the selected broker."}
            </p>
          </div>

          {requiresApiLogin && (
            <div className="config-field">
              <label>API Login</label>
              <input
                type="text"
                className="glass-input"
                value={apiLogin}
                onChange={(event) => setApiLogin(event.target.value)}
                placeholder="Email or login used for Capital.com"
                required={requiresApiLogin && !hasStoredApiLogin}
              />
              {isConfigured && hasStoredApiLogin && (
                <p className="helper">Login is already stored. Enter a value only to replace it.</p>
              )}
            </div>
          )}

          <div className="config-field">
            <label>{provider === "oanda" ? "API Token" : "API Key"}</label>
            <input
              type="password"
              className="glass-input"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                isConfigured && hasStoredApiKey
                  ? "Stored securely. Enter a new value only to replace it."
                  : provider === "oanda"
                  ? "Paste your OANDA API token"
                  : "Paste your broker API key"
              }
              required={!isConfigured || !hasStoredApiKey}
            />
            {isConfigured && hasStoredApiKey && (
              <p className="helper">An API key is already stored securely on the backend.</p>
            )}
          </div>

          <div className="config-field">
            <label>{provider === "capitalcom" ? "API Secret / Password" : "API Secret"}</label>
            <input
              type="password"
              className="glass-input"
              value={apiSecret}
              onChange={(event) => setApiSecret(event.target.value)}
              placeholder={
                isConfigured && hasStoredApiSecret
                  ? "Stored securely. Enter a new value only to replace it."
                  : provider === "capitalcom"
                  ? "Capital.com password or API secret"
                  : "Optional broker secret"
              }
              required={provider === "capitalcom" && (!isConfigured || !hasStoredApiSecret)}
            />
            {isConfigured && hasStoredApiSecret && (
              <p className="helper">A secret is already stored securely on the backend.</p>
            )}
          </div>

          <div className="config-field">
            <label>API URL</label>
            <input
              type="url"
              className="glass-input"
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              placeholder={defaultProviderUrl(provider)}
            />
            <p className="helper">
              Leave the default demo URL unless you are switching to a live broker environment.
            </p>
          </div>

          <button
            type="submit"
            disabled={savingAccount}
            className="btn btn-primary mt-2 flex items-center justify-center gap-2"
          >
            {savingAccount ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                Saving account...
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk"></i>
                Save Broker Account
              </>
            )}
          </button>
        </form>

        {summaryEntries.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {summaryEntries.map(([key, value]) => (
              <div key={key} className="rounded-xl border border-glassBorder bg-white/[0.03] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-textMuted mb-1">{key.replaceAll("_", " ")}</div>
                <div className="text-sm text-textMain break-all">{String(value)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <i className="fa-solid fa-shuffle"></i>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Symbol Mapping</h3>
            <p className="text-xs text-textMuted">
              Map strategy symbols like XAUUSD to the instrument names used by this broker
            </p>
            {formattedLastValidatedAt && (
              <p className="text-xs text-success mt-1">
                Last validated at: {formattedLastValidatedAt}
              </p>
            )}
          </div>
        </div>

        {!isConfigured && (
          <div className="my-5 p-4 rounded-xl bg-white/5 border border-glassBorder text-sm text-textMuted">
            Save the broker account first, then store mappings for that provider.
          </div>
        )}

        {isConfigured && !hasNonEmptyMappingRows(mappingRows) && (
          <div className="my-5 p-4 rounded-xl bg-white/5 border border-glassBorder text-sm text-textMuted">
            Suggested mappings are ready for {providerLabel(provider)}. Review them, save, then validate before starting.
          </div>
        )}

        {mappingMessage.text && (
          <div
            className={`my-5 p-3 rounded-lg text-sm flex items-center gap-2 ${
              mappingMessage.type === "success"
                ? "bg-success/10 border border-success/20 text-success"
                : "bg-danger/10 border border-danger/20 text-danger"
            }`}
          >
            <i
              className={`fa-solid ${
                mappingMessage.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"
              }`}
            ></i>
            {mappingMessage.text}
          </div>
        )}

        <div className="space-y-3">
          {mappingRows.map((row, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div className="config-field mb-0">
                <label>Canonical Symbol</label>
                <input
                  type="text"
                  className="glass-input"
                  value={row.canonical}
                  onChange={(event) => updateMappingRow(index, "canonical", event.target.value)}
                  placeholder="e.g. XAUUSD"
                  disabled={!isConfigured}
                />
              </div>
              <div className="config-field mb-0">
                <label>Broker Symbol</label>
                <input
                  type="text"
                  className="glass-input"
                  value={row.broker}
                  onChange={(event) => updateMappingRow(index, "broker", event.target.value)}
                  placeholder={provider === "oanda" ? "e.g. XAU_USD" : "e.g. GOLD"}
                  disabled={!isConfigured}
                />
              </div>
              <button
                type="button"
                onClick={() => removeMappingRow(index)}
                disabled={!isConfigured}
                className="px-4 py-3 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            type="button"
            onClick={() => {
              setMappingRows(getSuggestedRows(provider));
              markMappingsPending();
            }}
            disabled={!isConfigured}
            className="btn btn-secondary !w-auto px-5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            Use Suggested Mapping
          </button>
          <button
            type="button"
            onClick={addMappingRow}
            disabled={!isConfigured}
            className="btn btn-secondary !w-auto px-5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-plus"></i>
            Add Mapping
          </button>
          <button
            type="button"
            onClick={handleSaveMappings}
            disabled={!isConfigured || savingMappings}
            className="btn btn-primary !w-auto px-5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingMappings ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                Saving mappings...
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk"></i>
                Save Mappings
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleValidateMappings}
            disabled={!isConfigured || validating}
            className="btn btn-secondary !w-auto px-5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {validating ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                Validating...
              </>
            ) : (
              <>
                <i className="fa-solid fa-magnifying-glass-chart"></i>
                Validate Symbols
              </>
            )}
          </button>
        </div>

        {validationResults.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-white/[0.03]">
                  <th className="p-4 text-textMuted font-medium">Symbol</th>
                  <th className="p-4 text-textMuted font-medium">Mapped Symbol</th>
                  <th className="p-4 text-textMuted font-medium">Status</th>
                  <th className="p-4 text-textMuted font-medium">Candidates</th>
                </tr>
              </thead>
              <tbody>
                {validationResults.map((result) => (
                  <tr key={result.symbol} className="border-t border-glassBorder">
                    <td className="p-4 font-medium">{result.symbol}</td>
                    <td className="p-4">{result.mapped_symbol || "—"}</td>
                    <td className={`p-4 font-medium ${result.is_valid ? "text-success" : "text-danger"}`}>
                      {result.is_valid ? "Valid" : "Not found"}
                    </td>
                    <td className="p-4 text-xs text-textMuted">
                      {(result.candidates || []).length ? (
                        <div className="flex flex-wrap gap-2">
                          {result.candidates.map((item, index) => {
                            const candidateLabel = item.broker_symbol || item.display_name || `Candidate ${index + 1}`;
                            const isActiveCandidate = candidateLabel === result.mapped_symbol;

                            return (
                              <button
                                key={`${result.symbol}-${candidateLabel}-${index}`}
                                type="button"
                                onClick={() => upsertMappingForSymbol(result.symbol, candidateLabel)}
                                className={`px-2.5 py-1 rounded-lg border transition-colors ${
                                  isActiveCandidate
                                    ? "border-success/30 bg-success/10 text-success"
                                    : "border-glassBorder bg-white/[0.03] text-textMain hover:bg-white/[0.08]"
                                }`}
                                title={item.display_name || candidateLabel}
                              >
                                {candidateLabel}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
