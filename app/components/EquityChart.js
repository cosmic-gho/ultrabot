"use client";
import { useEffect, useRef } from "react";

export default function EquityChart({ trades }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !trades || trades.length === 0) return;
    drawChart();
  }, [trades]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // High DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 55 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    // Build equity curve
    let equity = 0;
    const points = [{ x: 0, y: 0 }];
    trades.forEach((t, i) => {
      // Use risk_amount as proxy for PnL if available, otherwise confidence-based estimate
      const pnl = t.confidence > 0.5 ? Math.abs(t.risk_amount || 10) : -Math.abs(t.risk_amount || 10);
      equity += pnl;
      points.push({ x: i + 1, y: equity });
    });

    const maxX = points.length - 1 || 1;
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));
    const rangeY = maxY - minY || 1;

    const toCanvasX = (x) => pad.left + (x / maxX) * chartW;
    const toCanvasY = (y) => pad.top + chartH - ((y - minY) / rangeY) * chartH;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px 'Outfit', sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= gridLines; i++) {
      const val = maxY - (rangeY / gridLines) * i;
      const y = pad.top + (chartH / gridLines) * i;
      ctx.fillText(`$${val.toFixed(0)}`, pad.left - 8, y + 4);
    }

    // X-axis labels
    ctx.textAlign = "center";
    const labelInterval = Math.max(1, Math.floor(maxX / 6));
    for (let i = 0; i <= maxX; i += labelInterval) {
      const x = toCanvasX(i);
      ctx.fillText(`#${i}`, x, H - 8);
    }

    // Zero line
    if (minY < 0 && maxY > 0) {
      const zeroY = toCanvasY(0);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(W - pad.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Gradient fill under the line
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    const lastPoint = points[points.length - 1];
    if (lastPoint.y >= 0) {
      gradient.addColorStop(0, "rgba(16, 185, 129, 0.25)");
      gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");
    } else {
      gradient.addColorStop(0, "rgba(239, 68, 68, 0.0)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0.25)");
    }

    ctx.beginPath();
    ctx.moveTo(toCanvasX(points[0].x), toCanvasY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toCanvasX(points[i].x), toCanvasY(points[i].y));
    }
    ctx.lineTo(toCanvasX(points[points.length - 1].x), pad.top + chartH);
    ctx.lineTo(toCanvasX(points[0].x), pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toCanvasX(points[0].x), toCanvasY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      // Smooth curve
      if (i < points.length - 1) {
        const xc = (toCanvasX(points[i].x) + toCanvasX(points[i + 1].x)) / 2;
        const yc = (toCanvasY(points[i].y) + toCanvasY(points[i + 1].y)) / 2;
        ctx.quadraticCurveTo(toCanvasX(points[i].x), toCanvasY(points[i].y), xc, yc);
      } else {
        ctx.lineTo(toCanvasX(points[i].x), toCanvasY(points[i].y));
      }
    }
    ctx.strokeStyle = lastPoint.y >= 0 ? "#10b981" : "#ef4444";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dot at end
    const endX = toCanvasX(lastPoint.x);
    const endY = toCanvasY(lastPoint.y);
    ctx.beginPath();
    ctx.arc(endX, endY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lastPoint.y >= 0 ? "#10b981" : "#ef4444";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(endX, endY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = lastPoint.y >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  if (!trades || trades.length === 0) {
    return (
      <div className="glass-panel p-6 mb-8 animate-fade-in-up">
        <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
          <i className="fa-solid fa-chart-line text-primary"></i>
          Equity Curve
        </h3>
        <div className="chart-container flex items-center justify-center text-textMuted text-sm">
          <div className="text-center">
            <i className="fa-solid fa-chart-area text-3xl mb-2 opacity-30"></i>
            <p>No trade data yet. Start the bot to see your equity curve.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 mb-8 animate-fade-in-up">
      <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
        <i className="fa-solid fa-chart-line text-primary"></i>
        Equity Curve
      </h3>
      <div className="chart-container">
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
