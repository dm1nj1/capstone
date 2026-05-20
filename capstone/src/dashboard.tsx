import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Flame,
  AlertTriangle,
  Activity,
  X,
} from "lucide-react";

import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import {
  fetchSummary,
  fetchAttackTypes,
  fetchTimeline,
  fetchAlerts,
  fetchTraffic,
  fetchTrafficDetail,
  type AlertItem,
  type ChartItem,
  type SummaryData,
  type TimelineItem,
  type TrafficDetail,
  type TrafficItem,
} from "./dashboardApi";

const DEFAULT_SUMMARY: SummaryData = {
  dangerLevel: "위험",
  attackCount: 0,
  realtimeStatus: "ACTIVE",
  averageRisk: 0,
};
const ALERTS_PER_PAGE = 5;
const REFRESH_INTERVAL_MS = 5000;
const MAIN_CHART_HEIGHT = 420;
const ATTACK_TYPE_COLORS: Record<string, string> = {
  "brute force": "#fb923c",
  "port scan": "#60a5fa",
  "network scan": "#facc15",
  ddos: "#22c55e",
  "syn flood": "#f87171",
};
const ATTACK_TYPE_LABELS = [
  "Brute Force",
  "Port Scan",
  "Network Scan",
  "DDoS",
  "SYN Flood",
];
const DEFAULT_ATTACK_COLOR = "#60a5fa";

type AttackChartMode = "all" | "today";

function normalizeAttackType(name: string) {
  const normalized = name.trim().toLowerCase().replace(/[_-]/g, " ");

  if (normalized.includes("brute")) return "brute force";
  if (normalized.includes("port")) return "port scan";
  if (normalized.includes("network")) return "network scan";
  if (normalized.includes("ddos")) return "ddos";
  if (normalized.includes("syn")) return "syn flood";

  return normalized;
}

function getAttackTypeColor(name: string) {
  return ATTACK_TYPE_COLORS[normalizeAttackType(name)] ?? DEFAULT_ATTACK_COLOR;
}

function matchesSearch(values: Array<string | number | undefined>, search: string) {
  const keyword = search.trim().toLowerCase();

  if (!keyword) return true;

  return values.some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(keyword)
  );
}

function getTrafficDate(row: TrafficItem) {
  const parsed = new Date(row.startTime);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function buildOrderedAttackData(items: ChartItem[]) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const key = normalizeAttackType(item.name);
    counts.set(key, (counts.get(key) ?? 0) + Number(item.value ?? 0));
  });

  const orderedItems = ATTACK_TYPE_LABELS.map((label) => ({
    name: label,
    value: counts.get(normalizeAttackType(label)) ?? 0,
  }));

  return orderedItems.some((item) => item.value > 0) ? orderedItems : items;
}

function buildTodayAttackData(rows: TrafficItem[]) {
  const today = new Date();
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const date = getTrafficDate(row);

    if (!date || !isSameLocalDay(date, today)) return;

    const name = row.attackType || row.result || "-";
    const key = normalizeAttackType(name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return ATTACK_TYPE_LABELS.map((label) => ({
    name: label,
    value: counts.get(normalizeAttackType(label)) ?? 0,
  }));
}

function buildLastSevenDaysData(rows: TrafficItem[]) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));

    return date;
  });

  return days.map((day) => ({
    t: formatMonthDay(day),
    v: rows.filter((row) => {
      const date = getTrafficDate(row);
      return date ? isSameLocalDay(date, day) : false;
    }).length,
  }));
}

function buildLastTwentyFourHoursData(rows: TrafficItem[], fallback: TimelineItem[]) {
  const now = new Date();
  const hours = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(now);
    date.setMinutes(0, 0, 0);
    date.setHours(now.getHours() - (23 - index));

    return date;
  });

  const hourly = hours.map((hour) => ({
    t: `${hour.getHours()}시`,
    v: rows.filter((row) => {
      const date = getTrafficDate(row);

      return (
        date !== null &&
        date >= hour &&
        date < new Date(hour.getTime() + 60 * 60 * 1000)
      );
    }).length,
  }));

  return hourly.some((item) => item.v > 0) ? hourly : fallback;
}

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}

function renderPieLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent,
  name = "",
}: PieLabelProps) {
  if (!percent) return "";

  const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
  const angle = (-midAngle * Math.PI) / 180;
  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      fontSize={14}
      fontWeight={700}
      stroke={getAttackTypeColor(name)}
      strokeWidth={0.6}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

export default function Dashboard() {
  // ===============================
  // STATE
  // ===============================
  const [data, setData] = useState<SummaryData>(DEFAULT_SUMMARY);

  const [pieData, setPieData] = useState<ChartItem[]>([]);
  const [lineData, setLineData] = useState<TimelineItem[]>([]);
  const [flows, setFlows] = useState<AlertItem[]>([]);
  const [traffic, setTraffic] = useState<TrafficItem[]>([]);
  const [alertPage, setAlertPage] = useState(1);
  const [alertSearch, setAlertSearch] = useState("");
  const [attackChartMode, setAttackChartMode] =
    useState<AttackChartMode>("all");
  const [attackTypeLoading, setAttackTypeLoading] = useState(false);
  const [attackTypeError, setAttackTypeError] = useState("");
  const [selectedTraffic, setSelectedTraffic] = useState<TrafficDetail | null>(
    null
  );
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");
  const allAttackChartData = useMemo(
    () => buildOrderedAttackData(pieData),
    [pieData]
  );
  const todayAttackChartData = useMemo(
    () => buildTodayAttackData(traffic),
    [traffic]
  );
  const chartData =
    attackChartMode === "today" ? todayAttackChartData : allAttackChartData;
  const attackTotal = chartData.reduce((total, item) => total + item.value, 0);
  const currentAttackType =
    chartData.reduce<ChartItem | null>(
      (top, item) => (!top || item.value > top.value ? item : top),
      null
    )?.name ?? "SSH Brute Force";
  const weeklyAttackData = useMemo(
    () => buildLastSevenDaysData(traffic),
    [traffic]
  );
  const hourlyAttackData = useMemo(
    () => buildLastTwentyFourHoursData(traffic, lineData),
    [lineData, traffic]
  );
  const filteredFlows = useMemo(
    () =>
      flows.filter((item) =>
        matchesSearch(
            [
              item.level,
              item.ip,
              item.flowId,
              item.srcIp,
              item.srcPort,
              item.destIp,
              item.destPort,
              item.prediction,
              item.action,
              item.riskScore,
            ],
            alertSearch
          )
      ),
    [alertSearch, flows]
  );
  const alertPageCount = Math.max(
    1,
    Math.ceil(filteredFlows.length / ALERTS_PER_PAGE)
  );
  const pagedFlows = filteredFlows.slice(
    (alertPage - 1) * ALERTS_PER_PAGE,
    alertPage * ALERTS_PER_PAGE
  );

  const openTrafficDetail = async (flowId: string) => {
    setDetailError("");
    setDetailLoadingId(flowId);

    try {
      const detail = await fetchTrafficDetail(flowId);

      if (detail) {
        setSelectedTraffic(detail);
      } else {
        setDetailError("상세 데이터를 불러오지 못했습니다.");
      }
    } catch (err) {
      console.error("Traffic detail error:", err);
      setDetailError("상세 데이터를 불러오지 못했습니다.");
    } finally {
      setDetailLoadingId(null);
    }
  };

  useEffect(() => {
  const load = async () => {
    try {
      const [
        summary,
        timeline,
        alerts,
        trafficData,
      ] = await Promise.all([
        fetchSummary(),
        fetchTimeline(),
        fetchAlerts(),
        fetchTraffic(1, 500),
      ]);

      if (summary) {
        setData(summary);
      }
      setLineData(timeline);
      setFlows(alerts);
      setTraffic(trafficData.items);
    } catch (err) {
      console.error("API error:", err);
    }
  };

  load();
  const interval = setInterval(load, REFRESH_INTERVAL_MS);

  return () => clearInterval(interval);
}, []);

  useEffect(() => {
    let ignore = false;

    const loadAttackTypes = async (showLoading = true) => {
      if (showLoading) {
        setAttackTypeLoading(true);
      }
      setAttackTypeError("");

      try {
        const attackTypes = await fetchAttackTypes("all");

        if (!ignore) {
          setPieData(attackTypes);
        }
      } catch (err) {
        console.error("Attack types API error:", err);

        if (!ignore) {
          setAttackTypeError("공격 유형 데이터를 불러오지 못했습니다.");
          setPieData([]);
        }
      } finally {
        if (!ignore) {
          setAttackTypeLoading(false);
        }
      }
    };

    loadAttackTypes();
    const interval = setInterval(
      () => loadAttackTypes(false),
      REFRESH_INTERVAL_MS
    );

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setAlertPage((page) => Math.min(page, alertPageCount));
  }, [alertPageCount]);

  useEffect(() => {
    setAlertPage(1);
  }, [alertSearch]);

  return (
    <div className="min-h-screen bg-[#edf1f7] p-6" style={{ fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif", }}>
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#2e3c52] to-[#3d4d65] text-white px-8 py-5 rounded-2xl shadow-lg flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-wide">
          보안 시스템 대시보드
        </h1>

        <p className="text-sm opacity-90">
          현재 {currentAttackType} 공격이 점증 발생 중
        </p>
      </div>

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        <Card
          title="현재 위험도"
          value={data.dangerLevel}
          color="bg-red-500"
          icon={<Flame size={20} />}
        />

        <Card
          title="오늘 공격 수"
          value={`${data.attackCount}건`}
          color="bg-blue-500"
          icon={<AlertTriangle size={20} />}
        />

        <Card
          title="실시간 공격 여부"
          value={data.realtimeStatus}
          color="bg-green-500"
          icon={<Activity size={20} />}
        />

        <Card
          title="평균 위험 점수"
          value={`${data.averageRisk}점`}
          color="bg-yellow-500"
          icon={<AlertTriangle size={20} />}
        />
      </div>

      {/* CENTER */}
<div className="grid grid-cols-2 items-stretch gap-6 mb-8">

  {/* LEFT PANEL */}
  <Panel title="실시간 공격 상태">
    <div className="grid h-full flex-1 grid-cols-2 gap-4">
      {/* PIE */}
      <div className="flex h-full flex-col bg-[#33445d] rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-gray-300 text-sm">공격 유형 비율</p>
            <p className="mt-1 text-xs text-gray-400">
              {attackChartMode === "all" ? "전체공격수" : "오늘 공격"} · 총{" "}
              {attackTotal.toLocaleString()}건
            </p>
          </div>
          <div className="flex rounded-lg bg-[#2f3b4c] p-1 text-xs">
            <button
              type="button"
              onClick={() => setAttackChartMode("all")}
              className={`rounded-md px-3 py-1 transition ${
                attackChartMode === "all"
                  ? "bg-blue-500 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              전체공격수
            </button>
            <button
              type="button"
              onClick={() => setAttackChartMode("today")}
              className={`rounded-md px-3 py-1 transition ${
                attackChartMode === "today"
                  ? "bg-blue-500 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              오늘 공격
            </button>
          </div>
        </div>

        <div className="relative min-h-[420px] flex-1">
          {attackChartMode === "all" && attackTypeLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#33445d]/80 text-sm text-gray-200">
              데이터를 불러오는 중...
            </div>
          )}

          {attackChartMode === "all" && attackTypeError ? (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-red-400/40 bg-red-500/10 px-4 text-center text-sm text-red-200">
              {attackTypeError}
            </div>
          ) : attackTotal === 0 &&
            !(attackChartMode === "all" && attackTypeLoading) ? (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-[#52637a] bg-[#2f3b4c] px-4 text-center text-sm text-gray-300">
              표시할 공격 유형 데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={MAIN_CHART_HEIGHT}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={155}
                  innerRadius={0}
                  paddingAngle={0}
                  stroke="#1f2937"
                  strokeWidth={1}
                  label={renderPieLabel}
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {chartData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={getAttackTypeColor(item.name)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    `${Number(value).toLocaleString()}건`,
                    String(name),
                  ]}
                  contentStyle={{
                    background: "#1f2937",
                    border: "1px solid #52637a",
                    borderRadius: 8,
                    color: "#f8fafc",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm mt-2">
          {chartData.map((item) => (
            <span
              key={item.name}
              className="whitespace-nowrap"
              style={{ color: getAttackTypeColor(item.name) }}
            >
              {item.name} ({item.value.toLocaleString()})
            </span>
          ))}
        </div>
      </div>

      {/* LINE */}
      <div className="flex h-full flex-col bg-[#33445d] rounded-2xl p-5">
        <p className="text-gray-300 text-sm mb-3">최근 7일간 공격</p>

        <div className="min-h-[420px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weeklyAttackData}>
            <CartesianGrid stroke="#52637a" strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke="#cbd5e1" />
            <YAxis stroke="#cbd5e1" />
            <Tooltip />
            <Line
              dataKey="v"
              stroke="#f5a623"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </Panel>

  {/* RIGHT PANEL */}
  <Panel title="실시간 알림 로그">
    <div className="bg-[#33445d] rounded-2xl p-5 mb-4">
      <p className="text-sm text-gray-300 mb-2">최근 24시간 공격 추이</p>

      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={hourlyAttackData}>
          <YAxis hide domain={[0, "dataMax"]} />
          <Line
            dataKey="v"
            stroke="#f5a623"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>

    <div className="flex gap-3 mb-4">
      <input
        className="flex-1 bg-[#33445d] rounded-lg px-4 py-2 text-sm outline-none"
        placeholder="검색"
        value={alertSearch}
        onChange={(event) => setAlertSearch(event.target.value)}
      />
    </div>

    <div className="overflow-x-auto rounded-xl border border-[#41506a]">
      <table className="min-w-[760px] w-full text-sm">
        <thead className="bg-[#3b4b61] text-left">
          <tr>
            <Th>FlowID</Th>
            <Th>Src IP:Port</Th>
            <Th>Dest IP:Port</Th>
            <Th>Prediction</Th>
            <Th>Action</Th>
            <Th>RiskScore</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody>
          {pagedFlows.map((item) => (
            <tr
              key={item.flowId}
              className="border-t border-[#41506a] hover:bg-[#34455b]"
            >
              <Td>{item.flowId}</Td>
              <Td>{`${item.srcIp}:${item.srcPort}`}</Td>
              <Td>{`${item.destIp}:${item.destPort}`}</Td>
              <Td className="text-red-300">{item.prediction}</Td>
              <Td>{item.action}</Td>
              <Td>{item.riskScore}</Td>
              <Td>
                <button
                  type="button"
                  onClick={() => openTrafficDetail(item.flowId)}
                  disabled={detailLoadingId === item.flowId}
                  className="text-blue-300 transition hover:text-blue-200 disabled:cursor-wait disabled:opacity-60"
                >
                  {detailLoadingId === item.flowId
                    ? "Loading..."
                    : "View Details"}
                </button>
              </Td>
            </tr>
          ))}
          {pagedFlows.length === 0 && (
            <tr className="border-t border-[#41506a]">
              <Td className="text-center text-gray-300" colSpan={7}>
                검색 결과가 없습니다.
              </Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    <div className="flex justify-center items-center gap-4 mt-5">
      <button
        type="button"
        onClick={() => setAlertPage((page) => Math.max(1, page - 1))}
        disabled={alertPage === 1}
        className="bg-[#4a5568] px-4 py-2 rounded disabled:opacity-40"
      >
        Previous
      </button>

      <div className="flex items-center gap-2">
        {Array.from({ length: alertPageCount }, (_, i) => i + 1).map(
          (page) => (
            <button
              key={page}
              type="button"
              onClick={() => setAlertPage(page)}
              className={`h-8 min-w-8 rounded px-2 transition ${
                alertPage === page
                  ? "bg-blue-500 text-white"
                  : "hover:bg-[#33445d]"
              }`}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        onClick={() =>
          setAlertPage((page) =>
            Math.min(alertPageCount, page + 1)
          )
        }
        disabled={alertPage === alertPageCount}
        className="bg-blue-500 px-4 py-2 rounded disabled:opacity-40"
      >
        Next
      </button>
    </div>
  </Panel>
</div>

      {detailError && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {detailError}
        </div>
      )}

      {selectedTraffic && (
        <DetailModal
          detail={selectedTraffic}
          onClose={() => setSelectedTraffic(null)}
        />
      )}
    </div>
  );
}

// ===============================
// COMPONENTS
// ===============================
interface CardProps {
  title: string;
  value: string | number;
  color: string;
  icon: ReactNode;
}

function Card({ title, value, color, icon }: CardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-500 text-sm">{title}</p>

        <div className={`${color} text-white p-3 rounded-full`}>
          {icon}
        </div>
      </div>

      <h3 className="text-4xl font-bold text-[#111827]">{value}</h3>
    </div>
  );
}

interface PanelProps {
  title: string;
  children: ReactNode;
}

function Panel({ title, children }: PanelProps) {
  return (
    <div 
      className="flex h-full flex-col bg-gradient-to-r from-[#2e3c52] to-[#34445c] text-white rounded-2xl shadow-lg p-6"
      style={{
        fontFamily:
          "'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif",
      }}
    >
      <h2 className="text-2xl font-semibold mb-5">{title}</h2>
      {children}
    </div>
  );
}

function DetailModal({
  detail,
  onClose,
}: {
  detail: TrafficDetail;
  onClose: () => void;
}) {
  const aiResult = detail.aiResult;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-[#2e3c52] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#41506a] px-6 py-4">
          <div>
            <h3 className="text-xl font-bold">Traffic Detail</h3>
            <p className="mt-1 text-sm text-gray-300">FlowID {detail.flowId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-300 transition hover:bg-[#33445d] hover:text-white"
            aria-label="Close detail"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-2">
          <div className="rounded-xl bg-[#33445d] p-5">
            <h4 className="mb-4 font-semibold">Flow Info</h4>
            <div className="space-y-3 text-sm">
              <DetailRow label="Source IP" value={detail.srcIp} />
              <DetailRow label="Source Port" value={detail.srcPort} />
              <DetailRow label="Destination IP" value={detail.dstIp} />
              <DetailRow label="Destination Port" value={detail.dstPort} />
              <DetailRow label="Protocol" value={detail.protocol} />
              <DetailRow label="Start Time" value={detail.startTime} />
              <DetailRow label="End Time" value={detail.endTime} />
              <DetailRow label="TCP Flags" value={detail.tcpFlags} />
            </div>
          </div>

          <div className="rounded-xl bg-[#33445d] p-5">
            <h4 className="mb-4 font-semibold">AI Analysis</h4>
            {aiResult ? (
              <div className="space-y-3 text-sm">
                <DetailRow label="Model" value={aiResult.modelName} />
                <DetailRow label="Prediction" value={aiResult.prediction} />
                <DetailRow label="Attack Type" value={aiResult.attackType} />
                <DetailRow label="Confidence" value={aiResult.confidence} />
                <DetailRow label="Risk Score" value={aiResult.riskScore} />
                <DetailRow label="Action" value={aiResult.action} />
                <DetailRow label="Analyzed At" value={aiResult.analyzedAt} />
              </div>
            ) : (
              <p className="text-sm text-gray-300">No AI analysis data.</p>
            )}
          </div>
        </div>

        {aiResult?.actionDetail && (
          <div className="px-6 pb-6">
            <div className="rounded-xl bg-[#33445d] p-5">
              <h4 className="mb-3 font-semibold">Action Detail</h4>
              <p className="whitespace-pre-wrap text-sm text-gray-200">
                {aiResult.actionDetail}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#41506a] pb-2 last:border-b-0 last:pb-0">
      <span className="shrink-0 text-gray-300">{label}</span>
      <span className="break-all text-right font-semibold">{value}</span>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3">{children}</th>;
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-3 py-3 ${className}`}>
      {children}
    </td>
  );
}
