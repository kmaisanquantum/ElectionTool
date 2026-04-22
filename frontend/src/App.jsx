import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

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
  const pct = Math.min(Math.abs(score) * 100, 100);
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
      }}
    >
      {isShift && (
        <div style={{
          position: "absolute", top: 8, right: 10,
          color: "#ff3d5a", fontSize: 9, fontWeight: 800,
          letterSpacing: 1.5, fontFamily: "monospace",
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
              paddingBottom: i < reasonParts.length - 1 ? 8 : 0,
              paddingTop: i > 0 ? 8 : 0,
            }}>{part}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LIVE ANALYSIS TAB
   ───────────────────────────────────────────── */
function LiveAnalysis({ records }) {
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const runAnalysis = async () => {
    if (records.length === 0) return;
    setIsLoading(true);
    setResponse("");
    setError("");

    try {
      const res = await fetch("/analyst/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setResponse(data.content[0].text);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: "#f1f5f9", fontSize: 18, marginBottom: 8 }}>Electoral Intelligence Analyst</h2>
        <p style={{ color: "#64748b", fontSize: 13 }}>Query the Hegarty-Rule AI for high-impact assessment of current shifts.</p>
      </div>

      <button
        onClick={runAnalysis}
        disabled={isLoading || records.length === 0}
        style={{
          background: "#38bdf8", color: "#020617", border: "none",
          padding: "12px 24px", borderRadius: 6, fontWeight: 700,
          cursor: "pointer", marginBottom: 20, alignSelf: "flex-start",
        }}
      >
        {isLoading ? "ANALYZING..." : "RUN FULL ELECTORAL ASSESSMENT"}
      </button>

      {error && <div style={{ color: "#ff3d5a", marginBottom: 20 }}>{error}</div>}

      <div style={{
        flex: 1, background: "#070f1e", border: "1px solid #1e2d45",
        borderRadius: 8, padding: 20, overflowY: "auto",
        fontFamily: "serif", lineHeight: 1.6, color: "#e2e8f0", fontSize: 15,
      }}>
        {response ? response : <span style={{ color: "#334155" }}>Awaiting intelligence records...</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
   ───────────────────────────────────────────── */
export default function App() {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("records");
  const [filter, setFilter] = useState("ALL_EVENTS");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await fetch("/pipeline/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sources: [
              {
                url: "https://rnz.co.nz/rss/pacific.xml",
                label: "RNZ Pacific",
                max_items: 10
              }
            ]
          })
        });
        if (!res.ok) throw new Error("Failed to fetch pipeline data");
        const data = await res.json();
        setRecords(data.records);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRecords();
  }, []);

  const eventTypes = ["ALL_EVENTS", ...Object.keys(EVENT_COLORS)];
  const filtered = filter === "ALL_EVENTS" ? records : records.filter(r => r.event_type === filter);

  const shiftCount = records.filter(r => r.shift_flag).length;
  const avgHegarty = records.reduce((acc, r) => acc + r.hegarty_score, 0) / (records.length || 1);
  const highConf = records.filter(r => r.confidence_level === "HIGH").length;

  const chartData = Array.from(new Set(records.map(r => r.entities.electorate)))
    .filter(e => e !== "NULL")
    .map(e => {
      const eRecs = records.filter(r => r.entities.electorate === e);
      const avgH = eRecs.reduce((a, b) => a + b.hegarty_score, 0) / eRecs.length;
      const avgS = eRecs.reduce((a, b) => a + b.sentiment_score, 0) / eRecs.length;
      return {
        name: e,
        hegarty: avgH,
        sentiment: avgS,
        color: avgS > 0.2 ? "#00e5a0" : avgS < -0.2 ? "#ff3d5a" : "#94a3b8"
      };
    });

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#020617",
      color: "#e2e8f0", display: "flex", flexDirection: "column",
      overflow: "hidden", fontFamily: "Inter, system-ui, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        height: 56, borderBottom: "1px solid #0f1e30",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", background: "#060e1c",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, background: "#0a1628", borderRadius: 6,
            border: "1px solid #1e2d45", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#38bdf8", fontSize: 16,
          }}>⬡</div>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 800,
              letterSpacing: 0.5, color: "#f1f5f9",
            }}>PNG ELECTORAL INTELLIGENCE</div>
            <div style={{ color: "#334155", fontSize: 9, letterSpacing: 2, fontFamily: "monospace" }}>
              HEGARTY RULE PIPELINE · v1.0.0
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "RECORDS", value: records.length, color: "#38bdf8" },
            { label: "SHIFT FLAGS", value: shiftCount, color: shiftCount > 0 ? "#ff3d5a" : "#64748b" },
            { label: "AVG HEGARTY", value: (avgHegarty >= 0 ? "+" : "") + avgHegarty.toFixed(3), color: avgHegarty >= 0 ? "#00e5a0" : "#ff3d5a" },
            { label: "HIGH CONF", value: highConf, color: "#00e5a0" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "right" }}>
              <div style={{ color: "#334155", fontSize: 8, letterSpacing: 2, fontFamily: "monospace" }}>{label}</div>
              <div style={{ color: color, fontSize: 16, fontWeight: 700, fontFamily: "monospace" }}>{value}</div>
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
            fontFamily: "monospace",
          }}>{label}</button>
        ))}
      </div>

      {/* Body */}
      {isLoading ? (
        <div style={{ color: "#38bdf8", padding: 20, fontFamily: "monospace" }}>LOADING INTELLIGENCE PIPELINE...</div>
      ) : error ? (
        <div style={{ color: "#ff3d5a", padding: 20, fontFamily: "monospace" }}>ERROR: {error}</div>
      ) : (
        <>
          {tab === "records" && (
            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr 320px", height: "calc(100vh - 102px)" }}>
              <div style={{ borderRight: "1px solid #0f1e30", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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

              <div style={{ borderRight: "1px solid #0f1e30", overflowY: "auto" }}>
                <DetailPanel record={selected !== null ? records[selected] : null} />
              </div>

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
            </div>
          )}

          {tab === "analyst" && (
            <div style={{ height: "calc(100vh - 102px)" }}>
              <LiveAnalysis records={records} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
