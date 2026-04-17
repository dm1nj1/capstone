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

// === 완전 이미지 기준 레이아웃 ===
export default function Dashboard() {
  const [data, setData] = useState({
    dangerLevel: "위험",
    attackCount: 128,
    realtimeStatus: "ACTIVE",
    averageRisk: 78,
  });

  const [lineData, setLineData] = useState([
    { t: "4", v: 5 },
    { t: "8", v: 7 },
    { t: "12", v: 12 },
    { t: "16", v: 6 },
    { t: "24", v: 9 },
  ]);

  const pieData = [
    { name: "Brute Force", value: 50 },
    { name: "Port Scan", value: 50 },
  ];

  useEffect(() => {
    const i = setInterval(() => {
      setData((p) => ({
        ...p,
        attackCount: Math.floor(Math.random() * 200),
        averageRisk: Math.floor(Math.random() * 100),
      }));

      setLineData((prev) =>
        prev.map((d) => ({ ...d, v: Math.floor(Math.random() * 15) }))
      );
    }, 3000);

    return () => clearInterval(i);
  }, []);

  return (
    <div className="min-h-screen bg-[#eef2f7] p-6 font-sans">
      {/* HEADER */}
      <div className="bg-[#3c4b5f] text-white px-6 py-4 rounded-xl flex justify-between items-center mb-6 shadow-md">
        <h1 className="text-lg font-semibold">보안 시스템 대시보드</h1>
        <span className="text-sm opacity-80">
          현재 SSH Brute Force 공격이 점증 발생 중
        </span>
      </div>

      {/* TOP CARDS */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card title="현재 위험도" value={data.dangerLevel} color="bg-[#e85d4f]" icon={<Flame />} />
        <Card title="오늘 공격 수" value={`${data.attackCount}건`} color="bg-[#4a6cf7]" icon={<AlertTriangle />} />
        <Card title="실시간 공격 여부" value={data.realtimeStatus} color="bg-[#3cb371]" icon={<Activity />} />
        <Card title="평균 위험 점수" value={`${data.averageRisk}점`} color="bg-[#f4a62a]" icon={<AlertTriangle />} />
      </div>

      {/* MIDDLE */}
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
                  <Pie
                    data={pieData}
                    dataKey="value"
                    outerRadius={80}
                    label={({ cx, cy, midAngle, outerRadius, percent }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius * 0.65;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);

                      return (
                        <text
                          x={x}
                          y={y}
                          fill="white"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={12}
                          fontWeight="bold"
                        >
                          {(percent * 100).toFixed(0)}%
                        </text>
                      );
                    }}
                    labelLine={false}
                  >
                    <Cell fill="#f4a62a" />
                    <Cell fill="#4a90e2" />
                  </Pie>

                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="flex justify-between text-xs mt-2">
                <span className="text-orange-400">Brute Force</span>
                <span className="text-blue-400">Port Scan</span>
              </div>
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
                  <Line type="monotone" dataKey="v" stroke="#f4a62a" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL 🔥 수정 핵심 */}
        <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow flex flex-col">
          <h2 className="font-semibold mb-4">실시간 알림 로그</h2>

          {/* 🔥 1. 그래프 (상단) */}
          <div className="bg-[#3c4b5f] p-3 rounded-xl mb-4 h-[140px]">

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <XAxis dataKey="t" hide />
                <YAxis hide />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="#f4a62a"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 🔥 2. 필터 */}
          <div className="flex justify-between items-center bg-[#3c4b5f] px-3 py-2 rounded mb-3 text-xs">
            <span className="bg-red-500 px-2 py-1 rounded">HIGH만 보기</span>
            <input
              className="bg-[#2f3b4c] px-2 py-1 rounded outline-none"
              placeholder="검색"
            />
          </div>

          {/* 🔥 3. 로그 리스트 */}
          <div className="space-y-2 text-xs overflow-y-auto flex-1">
            {[
              "192.168.1.15",
              "192.168.1.22",
              "203.45.67.39",
              "192.168.1.10",
              "192.283.120.45",
            ].map((ip, i) => (
              <div
                key={i}
                className="flex justify-between bg-[#3c4b5f] px-3 py-2 rounded"
              >
                <span className="text-red-400">위험</span>
                <span>{ip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow">
        <h2 className="font-semibold mb-4">AI 분석 결과</h2>

        <div className="grid grid-cols-3 gap-6 text-sm">
          <Info label="위험도" value="위험" color="text-red-400" />
          <Info label="탐지" value="SSH Brute Force" />
          <Info label="확률" value="95%" color="text-yellow-400" />
        </div>

        <button className="mt-4 bg-red-500 px-4 py-2 rounded hover:bg-red-600 transition">
          IP 차단
        </button>
      </div>
    </div>
  );
}

// ===== UI COMPONENTS =====
function Card({ title, value, color, icon }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-sm">{title}</span>
        <div className={`p-2 rounded-full ${color} text-white`}>{icon}</div>
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