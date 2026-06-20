import React from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import { Coins, ArrowUpRight, ShieldCheck, Zap, HelpCircle, FileText } from "lucide-react";

export function CreditsPage() {
  const config = useClientConfig();
  const balance = config.credits.total - config.credits.used;

  const formatCredits = (n: number) => {
    return n.toLocaleString();
  };

  const TRANSACTIONS = [
    { id: "TX-9018", date: "2026-06-18", description: "Inbound Call (via) - 3m 42s", amount: -370, status: "Success" },
    { id: "TX-9017", date: "2026-06-17", description: "Outbound Call (+918002825353) - 12m 10s", amount: -1210, status: "Success" },
    { id: "TX-9016", date: "2026-06-15", description: "Credit Refill - Package Standard", amount: 100000, status: "Success" },
    { id: "TX-9015", date: "2026-06-14", description: "Inbound Call (via) - 1m 15s", amount: -125, status: "Success" },
  ];

  const PLANS = [
    { name: "Starter Pack", amount: "50,000 credits", price: "$49", description: "Perfect for testing scripts and small flows." },
    { name: "Growth Pack", amount: "250,000 credits", price: "$199", description: "Ideal for outbound customer outreach campaigns.", popular: true },
    { name: "Enterprise Custom", amount: "1M+ credits", price: "Custom", description: "Dedicated voice ports and white-label SLA support." },
  ];

  return (
    <div className="placeholder-page">
      <div className="placeholder-header">
        <h2 className="placeholder-title flex items-center gap-2">
          <Coins className="w-6 h-6" style={{ color: config.brand.accentColor }} />
          Billing & Credits
        </h2>
      </div>

      {/* Credit Overview Panel */}
      <div className="credits-overview-card" style={{ borderLeftColor: config.brand.accentColor }}>
        <div>
          <span className="credits-overview-label">REMAINING BALANCE</span>
          <h3 className="credits-overview-value" style={{ color: config.brand.accentColor }}>
            {formatCredits(balance)} <span className="text-zinc-500 text-sm font-normal">/ {formatCredits(config.credits.total)} total</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Usage resets on the 1st of every month. Credits represent seconds of AI active speech time.
          </p>
        </div>
        <button
          className="credits-topup-btn"
          style={{
            background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}, ${config.brand.accentGradientTo})`,
          }}
        >
          <Zap className="w-4 h-4 fill-current text-white" />
          Buy Credits
        </button>
      </div>

      {/* Grid: Packages & Transactions */}
      <div className="credits-grid">
        {/* Plans */}
        <div className="col-span-2 space-y-4">
          <h3 className="credits-section-title">Refill Packages</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`plan-card ${plan.popular ? "plan-card-popular" : ""}`}
                style={plan.popular ? { borderColor: `${config.brand.accentColor}50` } : undefined}
              >
                {plan.popular && (
                  <span
                    className="plan-badge"
                    style={{
                      background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}, ${config.brand.accentGradientTo})`,
                    }}
                  >
                    POPULAR
                  </span>
                )}
                <h4 className="plan-name">{plan.name}</h4>
                <div className="plan-amount" style={{ color: plan.popular ? config.brand.accentColor : undefined }}>
                  {plan.amount}
                </div>
                <div className="plan-price">{plan.price}</div>
                <p className="plan-desc">{plan.description}</p>
                <button
                  className={`plan-btn ${plan.popular ? "plan-btn-popular" : ""}`}
                  style={
                    plan.popular
                      ? {
                          background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}, ${config.brand.accentGradientTo})`,
                        }
                      : undefined
                  }
                >
                  Purchase
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions ledger */}
        <div className="space-y-4">
          <h3 className="credits-section-title flex items-center justify-between">
            <span>Transaction Ledger</span>
            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
              <FileText className="w-3 h-3" /> Recent 4 entries
            </span>
          </h3>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 divide-y divide-zinc-200 space-y-3.5 shadow-sm">
            {TRANSACTIONS.map((tx) => (
              <div key={tx.id} className="flex items-start justify-between pt-3.5 first:pt-0">
                <div>
                  <h5 className="text-xs font-medium text-zinc-900">{tx.description}</h5>
                  <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">{tx.id} · {tx.date}</span>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-mono font-bold ${tx.amount > 0 ? "text-emerald-700" : "text-zinc-700"}`}>
                    {tx.amount > 0 ? "+" : ""}{formatCredits(tx.amount)}
                  </span>
                  <div className="text-[8px] text-emerald-700 font-mono mt-0.5 uppercase font-semibold">{tx.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
