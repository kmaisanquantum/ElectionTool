import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

/* ─────────────────────────────────────────────
   MOCK DATA — simulates a /pipeline/run response
   ───────────────────────────────────────────── */
const MOCK_RECORDS = [
  { event_type: "PROJECT_COMMISSIONING", source: "RNZ Pacific", entities: { candidate_name: "Hon. Peter Ipatas", electorate: "Enga Provincial", party_affiliation: "United Resources Party" }, sentiment_score: 0.72, confidence_level: "HIGH", hegarty_score: 0.6180, shift_flag: true, reasoning: "Sentiment component: 0.50 × 0.720 | Event modifier: 0.35 × 0.60 | Confidence adj: 0.15 × 1.00 | Electorate context: events=1, negative=0, projects=1" },
  { event_type: "VOTING_IRREGULARITY", source: "Post-Courier", entities: { candidate_name: "NULL", electorate: "Goroka Open", party_affiliation: "NULL" }, sentiment_score: -0.88, confidence_level: "HIGH", hegarty_score: -0.7580, shift_flag: true, reasoning: "Sentiment component: 0.50 × -0.880 | Event modifier: 0.35 × -0.80 | Confidence adj: 0.15 × 1.00 | Electorate context: events=3, negative=3, projects=1 | Vulnerability amplifier applied" },
  { event_type: "CANDIDATE_ANNOUNCEMENT", source: "PNG Loop", entities: { candidate_name: "James Marape", electorate: "Tari-Pori Open", party_affiliation: "Pangu Party" }, sentiment_score: 0.45, confidence_level: "HIGH", hegarty_score: 0.1725, shift_flag: false, reasoning: "Sentiment component: 0.50 × 0.450 | Event modifier: 0.35 × -0.30 | Confidence adj: 0.15 × 1.00" },
  { event_type: "ALLIANCE_FORMATION", source: "ABC Pacific", entities: { candidate_name: "Bryan Kramer", electorate: "Madang Open", party_affiliation: "PNG Party" }, sentiment_score: -0.31, confidence_level: "MEDIUM", hegarty_score: -0.2966, shift_flag: false, reasoning: "Sentiment component: 0.50 × -0.310 | Event modifier: 0.35 × -0.20 | Confidence adj: 0.15 × 0.60" },
  { event_type: "POLICY_STATEMENT", source: "The National", entities: { candidate_name: "Sam Basil", electorate: "Bulolo Open", party_affiliation: "Pangu Party" }, sentiment_score: 0.22, confidence_level: "MEDIUM", hegarty_score: 0.1462, shift_flag: false, reasoning: "Sentiment component: 0.50 × 0.220 | Event modifier: 0.35 × 0.10 | Confidence adj: 0.15 × 0.60" },
  { event_type: "ELECTORAL_RESULT", source: "PNGEC", entities: { candidate_name: "Don Polye", electorate: "Kandep Open", party_affiliation: "Triumph Heritage Empowerment Party" }, sentiment_score: 0.91, confidence_level: "HIGH", hegarty_score: 0.8705, shift_flag: true, reasoning: "Sentiment component: 0.50 × 0.910 | Event modifier: 0.35 × 1.00 | Confidence adj: 0.15 × 1.00" },
  { event_type: "VOTING_IRREGULARITY", source: "RNZ Pacific", entities: { candidate_name: "NULL", electorate: "Lae Open", party_affiliation: "NULL" }, sentiment_score: -0.65, confidence_level: "MEDIUM", hegarty_score: -0.4550, shift_flag: true, reasoning: "Sentiment component: 0.50 × -0.650 | Event modifier: 0.35 × -0.80 | Confidence adj: 0.15 × 0.60" },
  { event_type: "PROJECT_COMMISSIONING", source: "Post-Courier", entities: { candidate_name: "Patrick Pruaitch", electorate: "Kavieng Open", party_affiliation: "National Alliance" }, sentiment_score: 0.58, confidence_level: "HIGH", hegarty_score: 0.4970, shift_flag: true, reasoning: "Sentiment component: 0.50 × 0.580 | Event modifier: 0.35 × 0.60 | Confidence adj: 0.15 × 1.00" },
];

/* ─────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────── */
const EVENT_COLORS = {
  PROJECT_COMMISSIONING:  "#00e5a0",
  VOTING_IRREGULARITY:    "#ff3d5a",
  CANDIDATE_ANNOUNCEMENT: "#ffd166",
  ALLIANCE_FORMATION:     "#a78bfa",
  POLICY_STATEMENT:       "#38bdf8",
  ELECTORAL_RESULT:       "#fb923c",
  GENERAL_POLITICAL:      "#94a3b8",
};

const CONFIDENCE_ICONS = { HIGH: "◆", MEDIUM: "◈", LOW: "◇", NULL: "○" };

/* ─────────────────────────────────────────────
   HEGARTY SCORE BAR
   ───────────────────────────────────────────── */
function HegartBar({ score }) {
  const pct = Math.abs(score) * 100;
  const positive = score >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <div style={{
        width: 160, height: 6, background: "#1a2035", borderRadius: 3,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          [positive ? "left" : "right"]: "50%",
          width: `${pct / 2}%`,
          height: "100%",
          background: positive ? "#00e5a0" : "#ff3d5a",
          borderRadius: 3,
          transition: "width 0.6s ease",
        }} />
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#334155" }} />
      </div>
      <span style={{
        fontFamily: "monospace", fontSize: 11,
        color: positive ? "#00e5a0" : "#ff3d5a",
        fontWeight: 700, minWidth: 48,
      }}>
        {score >= 0 ? "+" : ""}{score.toFixed(4)}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SENTIMENT CHIP
   ───────────────────────────────────────────── */
function SentimentChip({ score }) {
  const col = score > 0.2 ? "#00e5a0" : score < -0.2 ? "#ff3d5a" : "#94a3b8";
  const label = score > 0.2 ? "POS" : score < -0.2 ? "NEG" : "NEU";
  return (
    <span style={{
      background: col + "22", border: `1px solid ${col}55`,
      color: col, fontSize: 9, fontWeight: 800,
      padding: "2px 6px", borderRadius: 2, letterSpacing: 1,
      fontFamily: "monospace",
    }}>{label} {score.toFixed(2)}</span>
  );
}

/* ─────────────────────────────────────────────
   RECORD CARD
   ───────────────────────────────────────────── */
function RecordCard({ record, index, selected, onClick }) {
  const evColor = EVENT_COLORS[record.event_type] || "#94a3b8";
  const isShift = record.shift_flag;
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "#0f1a2e" : "#0a1628",
        border: `1px solid ${selected ? evColor : isShift ? "#ff3d5a44" : "#1e2d45"}`,
        borderLeft: `3px solid ${evColor}`,
        borderRadius: 6,
        padding: "12px 14px",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
        animation: `fadeSlide 0.3s ease ${index * 0.05}s both`,
      }}
    >
      {isShift && (
        <div style={{
          position: "absolute", top: 8, right: 10,
          color: "#ff3d5a", fontSize: 9, fontWeight: 800,
          letterSpacing: 1.5, fontFamily: "monospace",
          animation: "pulse 2s infinite",
        }}>⚠ SHIFT</div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{
          background: evColor + "22", border: `1px solid ${evColor}44`,
          color: evColor, fontSize: 9, fontWeight: 700,
          padding: "2px 7px", borderRadius: 2, letterSpacing: 0.8,
          fontFamily: "'Courier New', monospace",
        }}>{record.event_type.replace(/_/g, " ")}</span>
        <span style={{ color: "#475569", fontSize: 10, fontFamily: "monospace" }}>
          {CONFIDENCE_ICONS[record.confidence_level]} {record.confidence_level}
        </span>
      </div>

      <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
        {record.entities.candidate_name === "NULL"
          ? <span style={{ color: "#475569", fontStyle: "italic" }}>Unknown Candidate</span>
          : record.entities.candidate_name}
      </div>
      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8 }}>
        {record.entities.electorate} {record.entities.party_affiliation !== "NULL" ? `· ${record.entities.party_affiliation}` : ""}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <HegartBar score={record.hegarty_score} />
        <SentimentChip score={record.sentiment_score} />
      </div>

      <div style={{ color: "#334155", fontSize: 10, marginTop: 6, fontFamily: "monospace" }}>
        via {record.source}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DETAIL PANEL
   ───────────────────────────────────────────── */
function DetailPanel({ record }) {
  if (!record) return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%", color: "#1e3a5f", fontSize: 14,
      fontFamily: "'Courier New', monospace", letterSpacing: 2,
      flexDirection: "column", gap: 8,
    }}>
      <div style={{ fontSize: 32, opacity: 0.3 }}>◈</div>
      <div>SELECT A RECORD</div>
    </div>
  );

  const evColor = EVENT_COLORS[record.event_type] || "#94a3b8";
  const reasonParts = record.reasoning.split(" | ");

  const radarData = [
    { subject: "Sentiment", value: (record.sentiment_score + 1) * 50 },
    { subject: "Confidence", value: record.confidence_level === "HIGH" ? 100 : record.confidence_level === "MEDIUM" ? 60 : 30 },
    { subject: "Shift Risk", value: Math.abs(record.hegarty_score) * 100 },
    { subject: "Signal Strength", value: Math.abs(record.sentiment_score) * 100 },
    { subject: "Event Weight", value: record.event_type === "ELECTORAL_RESULT" ? 100 : record.event_type === "VOTING_IRREGULARITY" ? 80 : 50 },
  ];

  return (
    <div style={{ padding: "20px 24px", height: "100%", overflowY: "auto" }}>
      <div style={{
        fontFamily: "'Courier New', monospace", fontSize: 9,
        color: "#334155", letterSpacing: 2, marginBottom: 16,
      }}>INTELLIGENCE RECORD DETAIL</div>

      {/* Header */}
      <div style={{
        background: "#0a1628", border: `1px solid ${evColor}33`,
        borderRadius: 8, padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{
            background: evColor + "22", color: evColor,
            fontSize: 10, fontWeight: 700, padding: "3px 10px",
            borderRadius: 2, letterSpacing: 1,
          }}>{record.event_type.replace(/_/g, " ")}</span>
          {record.shift_flag && (
            <span style={{
              color: "#ff3d5a", fontSize: 10, fontWeight: 800,
              letterSpacing: 2, fontFamily: "monospace",
              border: "1px solid #ff3d5a44", padding: "2px 8px", borderRadius: 2,
            }}>⚠ ELECTORAL SHIFT DETECTED</span>
          )}
        </div>
        <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {record.entities.candidate_name === "NULL"
            ? <span style={{ color: "#475569", fontStyle: "italic", fontSize: 15 }}>Unknown Candidate</span>
            : record.entities.candidate_name}
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {record.entities.electorate !== "NULL" && <span style={{ color: "#94a3b8" }}>{record.entities.electorate}</span>}
          {record.entities.party_affiliation !== "NULL" && <span style={{ color: "#475569" }}> · {record.entities.party_affiliation}</span>}
        </div>
      </div>

      {/* Scores row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "HEGARTY SCORE", value: (record.hegarty_score >= 0 ? "+" : "") + record.hegarty_score.toFixed(4), color: record.hegarty_score >= 0 ? "#00e5a0" : "#ff3d5a" },
          { label: "SENTIMENT", value: (record.sentiment_score >= 0 ? "+" : "") + record.sentiment_score.toFixed(3), color: record.sentiment_score > 0.2 ? "#00e5a0" : record.sentiment_score < -0.2 ? "#ff3d5a" : "#94a3b8" },
          { label: "SOURCE", value: record.source, color: "#38bdf8" },
          { label: "CONFIDENCE", value: `${CONFIDENCE_ICONS[record.confidence_level]} ${record.confidence_level}`, color: record.confidence_level === "HIGH" ? "#00e5a0" : record.confidence_level === "MEDIUM" ? "#ffd166" : "#ff3d5a" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "#070f1e", border: "1px solid #1e2d45",
            borderRadius: 6, padding: "10px 12px",
          }}>
            <div style={{ color: "#334155", fontSize: 9, letterSpacing: 1.5, marginBottom: 4, fontFamily: "monospace" }}>{label}</div>
            <div style={{ color: color, fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Radar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: "#334155", fontSize: 9, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>SIGNAL PROFILE</div>
        <ResponsiveContainer width="100%" height={180}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#1e2d45" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#475569", fontSize: 9 }} />
            <Radar dataKey="value" stroke={evColor} fill={evColor} fillOpacity={0.15} strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Chain-of-thought reasoning */}
      <div>
        <div style={{ color: "#334155", fontSize: 9, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>HEGARTY RULE REASONING</div>
        <div style={{
          background: "#070f1e", border: "1px solid #1e2d45",
          borderRadius: 6, padding: 12,
        }}>
          {reasonParts.map((part, i) => (
            <div key={i} style={{
              color: i === 0 ? "#38bdf8" : i === 1 ? "#ffd166" : i === 2 ? "#a78bfa" : "#64748b",
              fontSize: 10, fontFamily: "monospace", lineHeight: 1.8,
              borderBottom: i < reasonParts.length - 1 ? "1px solid #0f1e30" : "none",
              paddingBottom: i < reasonParts.length - 1 ? 4 : 0,
              marginBottom: i < reasonParts.length - 1 ? 4 : 0,
            }}>
              <span style={{ color: "#1e3a5f", marginRight: 6 }}>›</span>{part}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LIVE ANALYSIS PANEL (Anthropic API)
   ───────────────────────────────────────────── */
function LiveAnalysis({ records }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const responseRef = useRef(null);

  const PRESETS = [
    "Which electorates show the highest shift risk?",
    "Summarise incumbent vulnerability across all records",
    "What patterns exist in voting irregularity events?",
  ];

  async function runQuery(q) {
    const prompt = q || query;
    if (!prompt.trim()) return;
    setLoading(true);
    setResponse("");
    setError("");

    const context = JSON.stringify(records, null, 2);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an expert electoral analyst for Papua New Guinea. 
You have access to a set of processed IntelligenceRecords from the Hegarty Rule pipeline.
Each record includes: event_type, source, entities (candidate_name, electorate, party_affiliation),
sentiment_score (-1 to 1), confidence_level, hegarty_score, shift_flag, and reasoning.

Be concise, precise, and analytical. Use bullet points. Reference specific electorates and candidates by name.
Flag any SHIFT records prominently. Keep responses under 300 words.`,
          messages: [{
            role: "user",
            content: `Here are the current pipeline records:\n\n${context}\n\nAnalyst query: ${prompt}`,
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "No response.";
      setResponse(text);
    } catch (e) {
      setError("API call failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (responseRef.current) responseRef.current.scrollTop = 0;
  }, [response]);

  return (
    <div style={{ padding: "20px 24px", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{
        fontFamily: "'Courier New', monospace", fontSize: 9,
        color: "#334155", letterSpacing: 2, marginBottom: 16,
      }}>LIVE ANALYST QUERY</div>

      {/* Presets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => { setQuery(p); runQuery(p); }} style={{
            background: "#0a1628", border: "1px solid #1e2d45",
            color: "#64748b", fontSize: 10, padding: "7px 12px",
            borderRadius: 4, cursor: "pointer", textAlign: "left",
            fontFamily: "'Courier New', monospace",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.target.style.borderColor = "#38bdf8"; e.target.style.color = "#38bdf8"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#1e2d45"; e.target.style.color = "#64748b"; }}
          >
            › {p}
          </button>
        ))}
      </div>

      {/* Custom query */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runQuery()}
          placeholder="Enter custom query…"
          style={{
            flex: 1, background: "#070f1e", border: "1px solid #1e2d45",
            color: "#e2e8f0", fontSize: 11, padding: "8px 12px",
            borderRadius: 4, outline: "none", fontFamily: "'Courier New', monospace",
          }}
        />
        <button onClick={() => runQuery()} disabled={loading} style={{
          background: loading ? "#0a1628" : "#0d2a4a",
          border: `1px solid ${loading ? "#1e2d45" : "#38bdf8"}`,
          color: loading ? "#334155" : "#38bdf8",
          fontSize: 10, padding: "8px 14px", borderRadius: 4,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: 1,
          transition: "all 0.15s",
        }}>
          {loading ? "…" : "RUN"}
        </button>
      </div>

      {/* Response */}
      <div ref={responseRef} style={{
        flex: 1, overflowY: "auto", background: "#070f1e",
        border: "1px solid #1e2d45", borderRadius: 6,
        padding: 14,
      }}>
        {loading && (
          <div style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: 11 }}>
            {["Querying intelligence model", "Parsing records", "Generating analysis"].map((t, i) => (
              <div key={i} style={{ animation: `pulse 1.5s infinite ${i * 0.3}s`, marginBottom: 4 }}>
                <span style={{ color: "#1e3a5f" }}>›</span> {t}…
              </div>
            ))}
          </div>
        )}
        {error && <div style={{ color: "#ff3d5a", fontSize: 11, fontFamily: "monospace" }}>{error}</div>}
        {!loading && !error && response && (
          <div style={{
            color: "#94a3b8", fontSize: 11, lineHeight: 1.8,
            fontFamily: "'Courier New', monospace", whiteSpace: "pre-wrap",
          }}>{response}</div>
        )}
        {!loading && !error && !response && (
          <div style={{ color: "#1e3a5f", fontSize: 11, fontFamily: "monospace" }}>
            Select a preset or enter a query above.
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
   ───────────────────────────────────────────── */
export default function App() {
  const [records] = useState(MOCK_RECORDS);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("records"); // records | chart | analyst
  const [filter, setFilter] = useState("ALL");

  const shiftCount   = records.filter(r => r.shift_flag).length;
  const avgHegarty   = records.reduce((s, r) => s + r.hegarty_score, 0) / records.length;
  const avgSentiment = records.reduce((s, r) => s + r.sentiment_score, 0) / records.length;
  const highConf     = records.filter(r => r.confidence_level === "HIGH").length;

  const eventTypes   = ["ALL", ...new Set(records.map(r => r.event_type))];
  const filtered     = filter === "ALL" ? records : records.filter(r => r.event_type === filter);

  const chartData = records.map(r => ({
    name: r.entities.electorate.replace(" Open", "").replace(" Provincial", ""),
    hegarty: r.hegarty_score,
    sentiment: r.sentiment_score,
    color: EVENT_COLORS[r.event_type],
  }));

  return (
    <div style={{
      minHeight: "100vh", background: "#050d1a",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: "#e2e8f0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #070f1e; }
        ::-webkit-scrollbar-thumb { background: #1e2d45; border-radius: 2px; }
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>

      {/* Scanline overlay */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 100, overflow: "hidden",
      }}>
        <div style={{
          width: "100%", height: 2, background: "linear-gradient(transparent, #38bdf811, transparent)",
          animation: "scanline 8s linear infinite",
        }} />
      </div>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #0f1e30", padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#060e1c",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 32, height: 32, background: "#0d2a4a",
            border: "1px solid #38bdf844", borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#38bdf8", fontSize: 16,
          }}>⬡</div>
          <div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800,
              letterSpacing: 0.5, color: "#f1f5f9",
            }}>PNG ELECTORAL INTELLIGENCE</div>
            <div style={{ color: "#334155", fontSize: 9, letterSpacing: 2, fontFamily: "monospace" }}>
              HEGARTY RULE PIPELINE · v1.0.0
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "RECORDS", value: records.length, color: "#38bdf8" },
            { label: "SHIFT FLAGS", value: shiftCount, color: shiftCount > 0 ? "#ff3d5a" : "#64748b" },
            { label: "AVG HEGARTY", value: (avgHegarty >= 0 ? "+" : "") + avgHegarty.toFixed(3), color: avgHegarty >= 0 ? "#00e5a0" : "#ff3d5a" },
            { label: "HIGH CONF", value: highConf, color: "#00e5a0" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "right" }}>
              <div style={{ color: "#334155", fontSize: 8, letterSpacing: 2, fontFamily: "monospace" }}>{label}</div>
              <div style={{ color: color, fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0, borderBottom: "1px solid #0f1e30",
        background: "#060e1c",
      }}>
        {[
          { id: "records",  label: "RECORDS" },
          { id: "chart",    label: "CHART VIEW" },
          { id: "analyst",  label: "LIVE ANALYST" },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: "none", border: "none",
            borderBottom: tab === id ? "2px solid #38bdf8" : "2px solid transparent",
            color: tab === id ? "#38bdf8" : "#334155",
            fontSize: 9, fontWeight: 700, letterSpacing: 2,
            padding: "10px 20px", cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace",
            transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* Body */}
      {tab === "records" && (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr 320px", height: "calc(100vh - 102px)" }}>

          {/* Left: filter + list */}
          <div style={{ borderRight: "1px solid #0f1e30", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Filter */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #0f1e30" }}>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{
                  width: "100%", background: "#070f1e",
                  border: "1px solid #1e2d45", color: "#64748b",
                  fontSize: 10, padding: "6px 10px", borderRadius: 4,
                  fontFamily: "monospace", outline: "none",
                }}
              >
                {eventTypes.map(e => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            {/* Record list */}
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((r, i) => (
                <RecordCard
                  key={i} record={r} index={i}
                  selected={selected === i}
                  onClick={() => setSelected(selected === i ? null : i)}
                />
              ))}
            </div>
          </div>

          {/* Center: detail */}
          <div style={{ borderRight: "1px solid #0f1e30", overflowY: "auto" }}>
            <DetailPanel record={selected !== null ? records[selected] : null} />
          </div>

          {/* Right: electorate summary */}
          <div style={{ overflowY: "auto", padding: "20px 16px" }}>
            <div style={{ color: "#334155", fontSize: 9, letterSpacing: 2, marginBottom: 14, fontFamily: "monospace" }}>
              SHIFT ALERTS
            </div>
            {records.filter(r => r.shift_flag).map((r, i) => (
              <div key={i} style={{
                background: "#0a0f1e",
                border: "1px solid #ff3d5a33",
                borderLeft: "3px solid #ff3d5a",
                borderRadius: 6, padding: "10px 12px", marginBottom: 8,
                animation: `fadeSlide 0.3s ease ${i * 0.08}s both`,
              }}>
                <div style={{ color: "#ff3d5a", fontSize: 9, fontWeight: 800, letterSpacing: 1.5, fontFamily: "monospace", marginBottom: 4 }}>
                  ⚠ {r.event_type.replace(/_/g, " ")}
                </div>
                <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
                  {r.entities.electorate}
                </div>
                <div style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>
                  {r.entities.candidate_name !== "NULL" ? r.entities.candidate_name : "Unknown"}
                </div>
                <div style={{ marginTop: 6 }}>
                  <HegartBar score={r.hegarty_score} />
                </div>
              </div>
            ))}

            <div style={{ color: "#334155", fontSize: 9, letterSpacing: 2, margin: "20px 0 14px", fontFamily: "monospace" }}>
              SENTIMENT DISTRIBUTION
            </div>
            {[
              { label: "Positive", count: records.filter(r => r.sentiment_score > 0.2).length, color: "#00e5a0" },
              { label: "Neutral",  count: records.filter(r => Math.abs(r.sentiment_score) <= 0.2).length, color: "#94a3b8" },
              { label: "Negative", count: records.filter(r => r.sentiment_score < -0.2).length, color: "#ff3d5a" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: "#475569", fontSize: 10, fontFamily: "monospace" }}>{label}</span>
                  <span style={{ color: color, fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>{count}</span>
                </div>
                <div style={{ height: 4, background: "#0f1e30", borderRadius: 2 }}>
                  <div style={{
                    width: `${(count / records.length) * 100}%`,
                    height: "100%", background: color, borderRadius: 2,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "chart" && (
        <div style={{ padding: "24px 28px", height: "calc(100vh - 102px)", overflowY: "auto" }}>
          <div style={{ color: "#334155", fontSize: 9, letterSpacing: 2, marginBottom: 20, fontFamily: "monospace" }}>
            HEGARTY SCORE BY ELECTORATE
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
              <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 9 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: "#475569", fontSize: 9 }} domain={[-1, 1]} />
              <Tooltip
                contentStyle={{ background: "#070f1e", border: "1px solid #1e2d45", borderRadius: 4, fontSize: 11 }}
                labelStyle={{ color: "#94a3b8", fontFamily: "monospace" }}
                formatter={(v) => [v.toFixed(4), "Hegarty Score"]}
              />
              <Bar dataKey="hegarty" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.hegarty >= 0 ? "#00e5a0" : "#ff3d5a"} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div style={{ marginTop: 32, color: "#334155", fontSize: 9, letterSpacing: 2, marginBottom: 20, fontFamily: "monospace" }}>
            SENTIMENT SCORE BY ELECTORATE
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
              <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 9 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: "#475569", fontSize: 9 }} domain={[-1, 1]} />
              <Tooltip
                contentStyle={{ background: "#070f1e", border: "1px solid #1e2d45", borderRadius: 4, fontSize: 11 }}
                labelStyle={{ color: "#94a3b8", fontFamily: "monospace" }}
                formatter={(v) => [v.toFixed(3), "Sentiment"]}
              />
              <Bar dataKey="sentiment" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} opacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12 }}>
            {Object.entries(EVENT_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, background: color, borderRadius: 1 }} />
                <span style={{ color: "#475569", fontSize: 9, fontFamily: "monospace", letterSpacing: 0.5 }}>
                  {type.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "analyst" && (
        <div style={{ height: "calc(100vh - 102px)" }}>
          <LiveAnalysis records={records} />
        </div>
      )}
    </div>
  );
}
