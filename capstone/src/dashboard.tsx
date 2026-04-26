import { useState, useEffect } from "react";
import { Flame, AlertTriangle, Activity } from "lucide-react";
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

const API_BASE = "https://cristal-uninstructible-overthinly.ngrok-free.dev";

export default function Dashboard() {
  // ===============================
  // STATE
  // ===============================
  const [data, setData] = useState({
    dangerLevel: "정상",
    attackCount: 0,
    realtimeStatus: "INACTIVE",
    averageRisk: 0,
  });

  const [pieData, setPieData] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [aiResult, setAiResult] = useState({
    risk: "-",
    detect: "-",
    percent: "0%",
  });

  // ===============================
  // UTILS
  // ===============================
  const getRiskColor = (level) => {
    if (level === "위험") return "text-red-500";
    if (level === "주의") return "text-yellow-400";
    return "text-green-400";
  };

  // ===============================
  // API
  // ===============================

  // 1. summary
  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/summary`);
      const json = await res.json();

      setData({
        dangerLevel: json.dangerLevel,
        attackCount: json.attackCount,
        realtimeStatus: json.realtimeStatus,
        averageRisk: json.averageRisk,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // 2. attack types → pie chart
  const fetchAttackTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/attack-types`);
      const json = await res.json();

      const transformed = json.map((item) => ({
        name: item.type,
        value: item.count,
      }));

      setPieData(transformed);
    } catch (err) {
      console.error(err);
    }
  };

  // 3. timeline → line chart
  const fetchTimeline = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/timeline`);
      const json = await res.json();

      const transformed = json.map((item) => ({
        t: item.time,
        v: item.count,
      }));

      setLineData(transformed);
    } catch (err) {
      console.error(err);
    }
  };

  // 4. alerts
  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/alerts`);
      const json = await res.json();

      const transformed = json.map((item) => ({
        level: item.level,
        ip: item.sourceIp,
      }));

      setAlerts(transformed);
    } catch (err) {
      console.error(err);
    }
  };

  // 5. AI result (임시 flowId=1)
  const fetchAIResult = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/flows/1/ai-results`);
      const json = await res.json();

      setAiResult({
        risk: json.risk,
        detect: json.detect,
        percent: `${json.percent}%`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ===============================
  // INIT + INTERVAL
  // ===============================
  useEffect(() => {
    const load = () => {
      fetchSummary();
      fetchAttackTypes();
      fetchTimeline();
      fetchAlerts();
      fetchAIResult();
    };

    load();
    const interval = setInterval(load, 5000);

    return () => clearInterval(interval);
  }, []);

  // ===============================
  // UI
  // ===============================
  return (
    <div className="min-h-screen bg-[#eef2f7] p-6 font-sans">
      {/* HEADER */}
      <div className="bg-[#3c4b5f] text-white px-6 py-4 rounded-xl flex justify-between items-center mb-6 shadow-md">
        <h1 className="text-lg font-semibold">보안 시스템 대시보드</h1>
        <span className="text-sm opacity-80">
          현재 {aiResult.detect} 공격이 점증 발생 중
        </span>
      </div>

      {/* TOP */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card
          title="현재 위험도"
          value={data.dangerLevel}
          color="bg-red-500"
          icon={<Flame />}
        />

        <Card
          title="오늘 공격 수"
          value={`${data.attackCount}건`}
          color="bg-blue-500"
          icon={<AlertTriangle />}
        />

        <Card
          title="실시간 공격 여부"
          value={data.realtimeStatus}
          color={
            data.realtimeStatus === "ACTIVE"
              ? "bg-red-500"
              : "bg-green-500"
          }
          icon={<Activity />}
        />

        <Card
          title="평균 위험 점수"
          value={`${data.averageRisk}점`}
          color="bg-yellow-500"
          icon={<AlertTriangle />}
        />
      </div>

      {/* CENTER */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* LEFT */}
        <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow">
          <h2 className="font-semibold mb-4">실시간 공격 상태</h2>

          <div className="grid grid-cols-2 gap-4">
            {/* PIE */}
            <div className="bg-[#3c4b5f] p-4 rounded-xl">
              <p className="text-sm mb-2">공격 유형</p>

              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" outerRadius={80}>
                    {pieData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={idx % 2 === 0 ? "#f4a62a" : "#4a90e2"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* LINE */}
            <div className="bg-[#3c4b5f] p-4 rounded-xl">
              <p className="text-sm mb-2">시간별 공격</p>

              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={lineData}>
                  <CartesianGrid stroke="#555" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="#ccc" />
                  <YAxis stroke="#ccc" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="#f4a62a"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow flex flex-col">
          <h2 className="font-semibold mb-4">실시간 알림 로그</h2>

          <div className="space-y-2 text-xs overflow-y-auto flex-1">
            {alerts.map((item, i) => (
              <div
                key={i}
                className="flex justify-between bg-[#3c4b5f] px-3 py-2 rounded"
              >
                <span className="text-red-400">{item.level}</span>
                <span>{item.ip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow">
        <h2 className="font-semibold mb-4">AI 분석 결과</h2>

        <div className="grid grid-cols-3 gap-6 text-sm">
          <Info
            label="위험도"
            value={aiResult.risk}
            color={getRiskColor(aiResult.risk)}
          />
          <Info label="탐지" value={aiResult.detect} />
          <Info
            label="확률"
            value={aiResult.percent}
            color="text-yellow-400"
          />
        </div>

        <button className="mt-4 bg-red-500 px-4 py-2 rounded hover:bg-red-600">
          IP 차단
        </button>
      </div>
    </div>
  );
}

// ===============================
// COMPONENT
// ===============================
function Card({ title, value, color, icon }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-sm">{title}</span>
        <div className={`p-2 rounded-full ${color} text-white`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

function Info({ label, value, color }) {
  return (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className={`font-bold ${color || ""}`}>{value}</p>
    </div>
  );
}