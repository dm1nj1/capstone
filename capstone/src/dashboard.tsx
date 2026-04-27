import { useState, useEffect } from "react";
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

// ===============================
// API BASE URL
// ===============================
const API_BASE = "http://localhost:8080";

export default function Dashboard() {
  // ===============================
  // STATE
  // ===============================
  const [data, setData] = useState({
    dangerLevel: "위험",
    attackCount: 0,
    realtimeStatus: "ACTIVE",
    averageRisk: 0,
  });

  const [pieData, setPieData] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [flows, setFlows] = useState([]);
  const [traffic, setTraffic] = useState([]);

  // ===============================
  // API
  // ===============================
  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/summary`);
      const json = await res.json();

      setData(json);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttackTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/attack-types`);
      const json = await res.json();
      setPieData(json);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTimeline = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/timeline`);
      const json = await res.json();
      setLineData(json);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/alerts`);
      const json = await res.json();
      setFlows(json);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTraffic = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/traffic`);
      const json = await res.json();
      setTraffic(json);
    } catch (err) {
      console.error(err);
    }
  };

  // ===============================
  // INIT
  // ===============================
  useEffect(() => {
    const load = () => {
      fetchSummary();
      fetchAttackTypes();
      fetchTimeline();
      fetchAlerts();
      fetchTraffic();
    };

    load();
    const interval = setInterval(load, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#edf1f7] p-6 font-sans">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#2e3c52] to-[#3d4d65] text-white px-8 py-5 rounded-2xl shadow-lg flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-wide">
          보안 시스템 대시보드
        </h1>

        <p className="text-sm opacity-90">
          현재 SSH Brute Force 공격이 점증 발생 중
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
                  >
                    {pieData.map((item, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? "#f5a623" : "#4a90e2"}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="flex justify-between text-sm mt-2">
                <span className="text-orange-400">Brute Force</span>
                <span className="text-blue-400">Port Scan</span>
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
            <button className="bg-red-500 px-4 py-2 rounded-lg text-sm hover:bg-red-600">
              HIGH만 보기
            </button>

            <input
              className="flex-1 bg-[#33445d] rounded-lg px-4 py-2 text-sm outline-none"
              placeholder="검색"
            />
          </div>

          <div className="space-y-3">
            {flows.map((item, i) => (
              <div
                key={i}
                className="flex justify-between bg-[#33445d] rounded-lg px-4 py-3"
              >
                <span className="text-red-400">{item.level}</span>
                <span>{item.ip}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-5 mt-5 text-sm text-gray-300">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>...</span>
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
                <Th>TCP Flags</Th>
                <Th>AI Result</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {traffic.map((row, i) => (
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
                  <Td>{row.flag}</Td>

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
          <button className="bg-[#4a5568] px-4 py-2 rounded">
            Previous
          </button>

          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>...</span>

          <button className="bg-blue-500 px-4 py-2 rounded">
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
function Card({ title, value, color, icon }) {
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

function Panel({ title, children }) {
  return (
    <div className="bg-gradient-to-r from-[#2e3c52] to-[#34445c] text-white rounded-2xl shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-5">{title}</h2>
      {children}
    </div>
  );
}

function Select({ label }) {
  return (
    <button className="bg-[#2f3b4c] px-4 rounded-lg text-sm flex items-center gap-2 min-w-[130px] justify-between">
      {label}
      <ChevronDown size={16} />
    </button>
  );
}

function Th({ children }) {
  return <th className="px-3 py-3">{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}