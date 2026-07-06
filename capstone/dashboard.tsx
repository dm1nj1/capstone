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
  Sector,
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
  fetchTraffic,
  fetchTrafficDetail,
  fetchAlerts,
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

function getLatestTrafficDate(rows: TrafficItem[]) {
  return (
    rows
      .map(getTrafficDate)
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  );
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function buildRecentDailyData(rows: TrafficItem[], fallback: TimelineItem[]) {
  const latestDate = getLatestTrafficDate(rows);

  if (!latestDate) {
    return fallback.filter((item) => item.t && item.t !== "undefined");
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(latestDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(latestDate.getDate() - (6 - index));

    return date;
  });

  return days.map((day) => ({
    t: formatMonthDay(day),
    v: rows.filter((row) => {
      const date = getTrafficDate(row);

      return date !== null && isSameLocalDay(date, day);
    }).length,
  }));
}

function buildRecentHourlyData(rows: TrafficItem[], fallback: TimelineItem[]) {
  const latestDate = getLatestTrafficDate(rows);
  const now = latestDate ?? new Date();
  const hours = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(now);
    date.setMinutes(0, 0, 0);
    date.setHours(now.getHours() - (23 - index));

    return date;
  });

  const hourly = hours.map((hour) => {
    const nextHour = new Date(hour.getTime() + 60 * 60 * 1000);

    return {
      t: `${hour.getHours()}시`,
      v: rows.filter((row) => {
        const date = getTrafficDate(row);

        return date !== null && date >= hour && date < nextHour;
      }).length,
    };
  });

  return hourly.some((item) => item.v > 0) ? hourly : fallback;
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
  const counts = new Map<string, number>();
  const today = new Date();

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
interface PieSectorRenderProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}

interface PieLabelProps extends PieSectorRenderProps {
  percent?: number;
}

function renderDonutLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent,
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
      fontSize={18}
      fontWeight={800}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}
    >
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

function renderPieSector(
  {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill = DEFAULT_ATTACK_COLOR,
  }: PieSectorRenderProps,
  index: number,
  highlightedIndex: number
) {
  const angle = (-midAngle * Math.PI) / 180;
  const isHighlighted = index === highlightedIndex;
  const offset = isHighlighted ? 12 : 0;
  const shiftedCx = cx + offset * Math.cos(angle);
  const shiftedCy = cy + offset * Math.sin(angle);
  const expandedOuterRadius = outerRadius + (isHighlighted ? 10 : 0);

  return (
    <g>
      <Sector
        cx={shiftedCx}
        cy={shiftedCy}
        innerRadius={innerRadius}
        outerRadius={expandedOuterRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#ffffff"
        strokeWidth={3}
      />
    </g>
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
  const highlightedAttackIndex = chartData.reduce(
    (topIndex, item, index) =>
      item.value > 0 &&
      (topIndex === -1 || item.value > chartData[topIndex].value)
        ? index
        : topIndex,
    -1
  );
  const currentAttackType =
    chartData.reduce<ChartItem | null>(
      (top, item) => (!top || item.value > top.value ? item : top),
      null
    )?.name ?? "SSH Brute Force";
  const weeklyAttackData = useMemo(
    () => buildRecentDailyData(traffic, lineData),
    [lineData, traffic]
  );
  const hourlyAttackData = useMemo(
    () => buildRecentHourlyData(traffic, lineData),
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
        const [summary,timeline,alerts,trafficData] = await Promise.all([
          fetchSummary(),
          fetchTimeline(),
          fetchAlerts(),
          fetchTraffic(1, 500),
        ]);

        if(summary){
          setData(summary);
        }

        setLineData(timeline);
        setFlows(alerts);
        setTraffic(trafficData.items);

      } catch (err) {
        console.error("API error:",err);
      }
    };

    load();

    const interval = setInterval(load,REFRESH_INTERVAL_MS);

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
      <div className="bg-white text-[#111827] px-8 py-5 rounded-2xl shadow-lg flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-wide">
          한이음 프로젝트
        </h1>

        <p className="text-sm text-gray-600">
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
          color="bg-blue-500 text-white"
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
      <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-[#111827]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-bold tracking-wide">공격 유형 비율</p>
            <p className="mt-1 text-xs text-gray-500">
              {attackChartMode === "all" ? "전체 공격 기준" : "오늘 공격 기준"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <p className="whitespace-nowrap text-sm text-gray-600">
              총 공격 수{" "}
              <span className="text-2xl font-extrabold text-blue-400">
                {attackTotal.toLocaleString()}
              </span>{" "}
              건
            </p>
            <ToggleGroup
              value={attackChartMode}
              options={[
                { label: "전체공격수", value: "all" },
                { label: "오늘 공격", value: "today" },
              ]}
              onChange={setAttackChartMode}
            />
          </div>
        </div>

        <div className="relative flex flex-1 flex-col justify-center min-h-[360px]">
          {attackChartMode === "all" && attackTypeLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80 text-sm text-gray-600">
              데이터를 불러오는 중...
            </div>
          )}

          {attackChartMode === "all" && attackTypeError ? (
            <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-red-400/40 bg-red-500/10 px-4 text-center text-sm text-red-200">
              {attackTypeError}
            </div>
          ) : attackTotal === 0 &&
            !(attackChartMode === "all" && attackTypeLoading) ? (
            <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-center text-sm text-gray-600">
              표시할 공격 유형 데이터가 없습니다.
            </div>
          ) : (
            <div className="grid flex-1 items-center gap-5 lg:grid-cols-[minmax(240px,1fr)_minmax(180px,220px)]">
              <div className="relative h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={102}
                      innerRadius={52}
                      paddingAngle={1}
                      stroke="#ffffff"
                      strokeWidth={3}
                      label={renderDonutLabel}
                      labelLine={false}
                      shape={(props, index) =>
                        renderPieSector(props, index, highlightedAttackIndex)
                      }
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
                      formatter={(value) => [`${value}건`, "공격 수"]}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        color: "#111827",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full text-center">
                    <span className="text-xs font-semibold text-gray-500">
                      전체 공격
                    </span>
                    <span className="mt-1 text-2xl font-extrabold text-[#111827]">
                      {attackTotal.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">건</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                {chartData.map((item) => {
                  const percent =
                    attackTotal > 0 ? (item.value / attackTotal) * 100 : 0;

                  return (
                    <div
                      key={item.name}
                      className="border-b border-gray-200 py-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: getAttackTypeColor(item.name) }}
                        />
                        <span className="text-sm font-semibold text-[#111827]">
                          {item.name}
                        </span>
                      </div>
                      <div className="mt-2 text-right text-sm text-gray-500">
                        <span className="font-bold text-blue-400">
                          {item.value.toLocaleString()} 건
                        </span>{" "}
                        ({percent.toFixed(1)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LINE */}
      <div className="flex h-full flex-col bg-white rounded-2xl p-5 border border-gray-200">
        <p className="text-gray-600 text-sm mb-3">최근 7일간 공격</p>

        <div className="relative flex flex-1 flex-col justify-center min-h-[360px]">
          <div className="w-full flex-none">
          <ResponsiveContainer width="100%" height={320}>
          <LineChart data={weeklyAttackData}
                     margin={{ top: 10, right: 15, left: -20, bottom: 5}}
          >
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke="#4b5563" />
            <YAxis stroke="#4b5563" />
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
    </div>
  </Panel>

  {/* RIGHT PANEL */}
  <Panel title="실시간 알림 로그">
    <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-200">
      <p className="text-sm text-gray-600 mb-2">최근 24시간 공격 추이</p>

      <ResponsiveContainer width="100%" height={130}>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={hourlyAttackData}>

            <XAxis
                dataKey="t"
                stroke="#4b5563"
                interval={2}
            />

            <YAxis
                hide
                domain={[0,"dataMax"]}
            />

            <Tooltip
                formatter={(value)=>[
                  `${value}건`,
                  "공격 수"
                ]}
            />

            <Line
                type="monotone"
                dataKey="v"
                stroke="#f5a623"
                strokeWidth={3}
                dot={false}
                activeDot={{r:5}}
            />

          </LineChart>
        </ResponsiveContainer>
      </ResponsiveContainer>
    </div>

    <div className="flex gap-3 mb-4">
      <input
        className="flex-1 bg-white rounded-lg px-4 py-2 text-sm text-[#111827] outline-none border border-gray-200"
        placeholder="검색"
        value={alertSearch}
        onChange={(event) => setAlertSearch(event.target.value)}
      />
    </div>

    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-[760px] w-full text-sm">
        <thead className="bg-white text-left text-[#111827]">
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
              className="border-t border-gray-200 hover:bg-gray-50"
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
                  className="text-[#111827] transition hover:text-gray-600 disabled:cursor-wait disabled:opacity-60"
                >
                  {detailLoadingId === item.flowId
                    ? "Loading..."
                    : "View Details"}
                </button>
              </Td>
            </tr>
          ))}
          {pagedFlows.length === 0 && (
            <tr className="border-t border-gray-200">
              <Td className="text-center text-gray-600" colSpan={7}>
                검색 결과가 없습니다.
              </Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    <div className="flex justify-center items-center gap-4 mt-5">

      <button
          onClick={() =>
              setAlertPage(1)
          }

          disabled={
              alertPage===1
          }
      >
        ⏮
      </button>

      <button
          type="button"

          onClick={() =>
              setAlertPage(
                  page =>
                      Math.max(
                          1,
                          page-1
                      )
              )
          }

          disabled={
              alertPage===1
          }

          className="bg-white text-[#111827] border border-gray-200 px-4 py-2 rounded disabled:opacity-40"
      >
        Previous
      </button>

      <span>
    {alertPage}
        /
        {alertPageCount}
  </span>

      <button
          type="button"

          onClick={() =>
              setAlertPage(
                  page =>
                      Math.min(
                          alertPageCount,
                          page+1
                      )
              )
          }

          disabled={
              alertPage===
              alertPageCount
          }

          className="bg-white text-[#111827] border border-gray-200 px-4 py-2 rounded disabled:opacity-40"
      >
        Next
      </button>

      <button
          onClick={() =>
              setAlertPage(
                  alertPageCount
              )
          }

          disabled={
              alertPage===
              alertPageCount
          }
      >
        ⏭
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

        <div className={`${color} p-3 rounded-full`}>
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
      className="flex h-full flex-col bg-white text-[#111827] rounded-2xl shadow-lg p-6 border border-gray-200"
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

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-white p-1 text-xs border border-gray-200">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1 transition ${
            value === option.value
              ? "bg-white text-[#111827] border border-gray-200"
              : "text-gray-600 hover:text-[#111827]"
          }`}
        >
          {option.label}
        </button>
      ))}
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
      <div className="max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-white text-[#111827] shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold">Traffic Detail</h3>
            <p className="mt-1 text-sm text-gray-600">FlowID {detail.flowId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100 hover:text-[#111827]"
            aria-label="Close detail"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-2">
          <div className="rounded-xl bg-white p-5 border border-gray-200">
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

          <div className="rounded-xl bg-white p-5 border border-gray-200">
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
              <p className="text-sm text-gray-600">No AI analysis data.</p>
            )}
          </div>
        </div>

        {aiResult?.actionDetail && (
          <div className="px-6 pb-6">
            <div className="rounded-xl bg-white p-5 border border-gray-200">
              <h4 className="mb-3 font-semibold">Action Detail</h4>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
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
    <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2 last:border-b-0 last:pb-0">
      <span className="shrink-0 text-gray-600">{label}</span>
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
