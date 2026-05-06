"use client";
import { useState, useEffect, useRef } from "react";

export default function StatsCards({ dashboardData }) {
  const pnl = parseFloat(dashboardData.total_pnl || 0);
  const pnlPositive = pnl >= 0;

  const cards = [
    {
      label: "Win Rate",
      value: `${dashboardData.win_rate || 0}%`,
      icon: "fa-solid fa-bullseye",
      color: "primary",
      bgClass: "bg-primary/10",
      textClass: "text-primary",
    },
    {
      label: "Total PnL",
      value: `${pnlPositive ? "+" : ""}$${pnl.toFixed(2)}`,
      icon: "fa-solid fa-dollar-sign",
      color: pnlPositive ? "success" : "danger",
      bgClass: pnlPositive ? "bg-success/10" : "bg-danger/10",
      textClass: pnlPositive ? "text-success" : "text-danger",
    },
    {
      label: "Active Trades",
      value: dashboardData.active_trades || 0,
      icon: "fa-solid fa-arrows-rotate",
      color: "purple",
      bgClass: "bg-purple-500/10",
      textClass: "text-purple-500",
    },
    {
      label: "Profit Factor",
      value: dashboardData.profit_factor || "0.00",
      icon: "fa-solid fa-chart-pie",
      color: "primary",
      bgClass: "bg-blue-500/10",
      textClass: "text-blue-400",
    },
    {
      label: "Win Streak",
      value: dashboardData.max_win_streak || 0,
      icon: "fa-solid fa-fire",
      color: "success",
      bgClass: "bg-emerald-500/10",
      textClass: "text-emerald-400",
    },
    {
      label: "W / L",
      value: `${dashboardData.winning_trades || 0} / ${dashboardData.losing_trades || 0}`,
      icon: "fa-solid fa-scale-balanced",
      color: "textMuted",
      bgClass: "bg-white/5",
      textClass: "text-textMuted",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
      {cards.map((card, idx) => (
        <div
          key={card.label}
          className="glass-panel p-6 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-glow animate-fade-in-up"
          style={{ animationDelay: `${idx * 60}ms` }}
        >
          <div className={`icon-wrap ${card.bgClass} ${card.textClass}`}>
            <i className={card.icon}></i>
          </div>
          <h3 className="text-textMuted font-medium mt-1 mb-2 text-sm uppercase tracking-wide">
            {card.label}
          </h3>
          <h2 className={`text-3xl font-light ${card.textClass}`}>{card.value}</h2>
        </div>
      ))}
    </div>
  );
}
