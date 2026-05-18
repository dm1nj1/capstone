import { useState, useEffect, type ReactNode } from "react";
import {
  Flame,
  AlertTriangle,
  Activity,
  Search,
  ChevronDown,
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
  type AlertItem,
  type ChartItem,
  type SummaryData,
  type TimelineItem,
  type TrafficItem,
} from "./dashboardApi";

const DEFAULT_SUMMARY: SummaryData = {
  dangerLevel: "위험",
  attackCount: 0,
  realtimeStatus: "ACTIVE",
  averageRisk: 0,
};
const ALERTS_PER_PAGE = 5;
const TRAFFIC_PER_PAGE = 10;
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

function getAttackTypeColor(name: string) {
  return ATTACK_TYPE_COLORS[name.trim().toLowerCase()] ?? DEFAULT_ATTACK_COLOR;
}

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

function renderPieLabel({
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
      fontSize={14}
      fontWeight={700}
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
  const [trafficPage, setTrafficPage] = useState(1);
  const currentAttackType =
    pieData.reduce<ChartItem | null>(
      (top, item) => (!top || item.value > top.value ? item : top),
      null
    )?.name ?? "SSH Brute Force";
  const alertPageCount = Math.max(1, Math.ceil(flows.length / ALERTS_PER_PAGE));
  const pagedFlows = flows.slice(
    (alertPage - 1) * ALERTS_PER_PAGE,
    alertPage * ALERTS_PER_PAGE
  );
  const trafficPageCount = Math.max(
    1,
    Math.ceil(traffic.length / TRAFFIC_PER_PAGE)
  );
  const pagedTraffic = traffic.slice(
    (trafficPage - 1) * TRAFFIC_PER_PAGE,
    trafficPage * TRAFFIC_PER_PAGE
  );

  useEffect(() => {
  const load = async () => {
    try {
      const [
        summary,
        attackTypes,
        timeline,
        alerts,
        trafficData,
      ] = await Promise.all([
        fetchSummary(),
        fetchAttackTypes(),
        fetchTimeline(),
        fetchAlerts(),
        fetchTraffic(),
      ]);

      if (summary) {
        setData(summary);
      }
      setPieData(attackTypes);
      setLineData(timeline);
      setFlows(alerts);
      setTraffic(trafficData);
    } catch (err) {
      console.error("API error:", err);
    }
  };

  load();
  const interval = setInterval(load, 5000);

  return () => clearInterval(interval);
}, []);

  useEffect(() => {
    setAlertPage((page) => Math.min(page, alertPageCount));
  }, [alertPageCount]);

  useEffect(() => {
    setTrafficPage((page) => Math.min(page, trafficPageCount));
  }, [trafficPageCount]);

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
<div className="grid grid-cols-2 gap-6 mb-8">

  {/* LEFT PANEL */}
  <Panel title="실시간 공격 상태">
    <div className="grid grid-cols-2 gap-4">
      {/* PIE */}
      <div className="bg-[#33445d] rounded-2xl p-5">
        <p className="text-gray-300 text-sm mb-3">공격 유형</p>

        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              outerRadius={90}
              innerRadius={0}
              stroke="#fff"
              strokeWidth={2}
              label={renderPieLabel}
              labelLine={false}
              isAnimationActive={false}
            >
              {pieData.map((item) => (
                <Cell
                  key={item.name}
                  fill={getAttackTypeColor(item.name)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm mt-2">
          {ATTACK_TYPE_LABELS.map((label) => (
            <span
              key={label}
              className="whitespace-nowrap"
              style={{ color: getAttackTypeColor(label) }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* LINE */}
      <div className="bg-[#33445d] rounded-2xl p-5">
        <p className="text-gray-300 text-sm mb-3">시간별 공격</p>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={lineData}>
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
  </Panel>

  {/* RIGHT PANEL */}
  <Panel title="실시간 알림 로그">
    <div className="bg-[#33445d] rounded-2xl p-5 mb-4">
      <p className="text-sm text-gray-300 mb-2">최근 공격 추이</p>

      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={lineData}>
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
      />
    </div>

    <div className="space-y-3">
      {pagedFlows.map((item, i) => (
        <div
          key={i}
          className="flex justify-between bg-[#33445d] rounded-lg px-4 py-3"
        >
          <span className="text-red-400">{item.level}</span>
          <span>{item.ip}</span>
        </div>
      ))}
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

      {/* BOTTOM TABLE */}
      <Panel title="상세 트래픽 분석">
        <p className="text-gray-300 text-sm mb-4">
          네트워크 트래픽 목록 (검색 및 페이징)
        </p>

        {/* SEARCH */}
        <div className="bg-[#33445d] rounded-xl p-3 flex gap-3 mb-5">
          <div className="flex-1 flex items-center bg-[#2f3b4c] rounded-lg px-3">
            <Search size={16} className="text-gray-400 mr-2" />
            <input
              placeholder="Search"
              className="bg-transparent w-full py-2 outline-none text-sm"
            />
          </div>

          <Select label="Source IP" />
          <Select label="Date Range" />
          <Select label="Port" />
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-xl border border-[#41506a]">
          <table className="w-full text-sm">
            <thead className="bg-[#3b4b61] text-left">
              <tr>
                <Th>FlowID</Th>
                <Th>Timestamp</Th>
                <Th>Source IP</Th>
                <Th>Destination IP</Th>
                <Th>Port</Th>
                <Th>Protocol</Th>
                <Th>AI Result</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {pagedTraffic.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-[#41506a] hover:bg-[#34455b]"
                >
                  <Td>{row.flowId}</Td>
                  <Td>{row.time}</Td>
                  <Td>{row.srcIp}</Td>
                  <Td>{row.dstIp}</Td>
                  <Td>{row.port}</Td>
                  <Td>{row.protocol}</Td>

                  <Td
                    className={
                      row.result.includes("High")
                        ? "text-red-400"
                        : "text-yellow-400"
                    }
                  >
                    {row.result}
                  </Td>

                  <Td className="text-blue-400 cursor-pointer">
                    [View Details]
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGING */}
        <div className="flex justify-center items-center gap-4 mt-5">
          <button
            type="button"
            onClick={() => setTrafficPage((page) => Math.max(1, page - 1))}
            disabled={trafficPage === 1}
            className="bg-[#4a5568] px-4 py-2 rounded disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: trafficPageCount }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setTrafficPage(page)}
                  className={`h-8 min-w-8 rounded px-2 transition ${
                    trafficPage === page
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
              setTrafficPage((page) => Math.min(trafficPageCount, page + 1))
            }
            disabled={trafficPage === trafficPageCount}
            className="bg-blue-500 px-4 py-2 rounded disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </Panel>
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
      className="bg-gradient-to-r from-[#2e3c52] to-[#34445c] text-white rounded-2xl shadow-lg p-6"
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

function Select({ label }: { label: string }) {
  return (
    <button className="bg-[#2f3b4c] px-4 rounded-lg text-sm flex items-center gap-2 min-w-[130px] justify-between">
      {label}
      <ChevronDown size={16} />
    </button>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}
