import { useState, useEffect } from "react";
import { AlertTriangle, Flame, Activity } from "lucide-react";
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

export default function Dashboard() {
  const [data, setData] = useState({
    dangerLevel: "위험",
    attackCount: 128,
    realtimeStatus: "ACTIVE",
    averageRisk: 78,
  });

  const [chartData, setChartData] = useState([
    { time: "4", value: 5 },
    { time: "8", value: 7 },
    { time: "12", value: 12 },
    { time: "16", value: 6 },
    { time: "24", value: 9 },
  ]);

  const pieData = [
    { name: "Brute Force", value: 50 },
    { name: "Port Scan", value: 50 },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => ({
        ...prev,
        attackCount: Math.floor(Math.random() * 200),
        averageRisk: Math.floor(Math.random() * 100),
      }));

      setChartData((prev) =>
        prev.map((d) => ({ ...d, value: Math.floor(Math.random() * 15) }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#eef2f7] p-6">
      {/* Header */}
      <div className="bg-[#3c4b5f] text-white px-6 py-4 rounded-xl flex justify-between items-center mb-6 shadow">
        <h1 className="text-lg font-semibold">보안 시스템 대시보드 (개선 예시)</h1>
        <span className="text-sm opacity-80">현재 SSH Brute Force 공격이 점증 발생 중</span>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <TopCard title="현재 위험도" value={data.dangerLevel} bg="bg-[#e85d4f]" icon={<Flame />} />
        <TopCard title="오늘 공격 수" value={`${data.attackCount}건`} bg="bg-[#4a6cf7]" icon={<AlertTriangle />} />
        <TopCard title="실시간 공격 여부" value={data.realtimeStatus} bg="bg-[#3cb371]" icon={<Activity />} />
        <TopCard title="평균 위험 점수" value={`${data.averageRisk}점`} bg="bg-[#f4a62a]" icon={<AlertTriangle />} />
      </div>

      {/* Middle */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Attack Panel */}
        <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow">
          <h2 className="mb-4 font-semibold">실시간 공격 상태</h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Pie */}
            <div className="bg-[#3c4b5f] p-4 rounded-xl">
              <p className="text-sm mb-2">공격 유형</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={40} outerRadius={70}>
                    <Cell fill="#f4a62a" />
                    <Cell fill="#4a90e2" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-orange-400">Brute Force</span>
                <span className="text-blue-400">Port Scan</span>
              </div>
            </div>

            {/* Line */}
            <div className="bg-[#3c4b5f] p-4 rounded-xl">
              <p className="text-sm mb-2">시간별 공격</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#555" strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="#ccc" />
                  <YAxis stroke="#ccc" />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#f4a62a" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow">
          <h2 className="mb-4 font-semibold">실시간 알림 로그</h2>

          <div className="bg-[#3c4b5f] p-3 rounded mb-3 flex justify-between items-center text-sm">
            <span className="bg-red-500 px-2 py-1 rounded text-xs">HIGH만 보기</span>
            <input className="bg-[#2f3b4c] px-2 py-1 rounded text-xs" placeholder="검색" />
          </div>

          <div className="space-y-2 text-xs max-h-56 overflow-y-auto">
            {[
              "192.168.1.15",
              "192.168.1.22",
              "203.45.67.39",
              "192.168.1.10",
              "192.283.120.45",
            ].map((ip, i) => (
              <div key={i} className="flex justify-between bg-[#3c4b5f] px-3 py-2 rounded">
                <span className="text-red-400">위험</span>
                <span>{ip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow">
        <h2 className="mb-4 font-semibold">AI 분석 결과</h2>

        <div className="grid grid-cols-3 gap-6 text-sm">
          <Info label="위험도" value="위험" color="text-red-400" />
          <Info label="탐지" value="SSH Brute Force" />
          <Info label="확률" value="95%" color="text-yellow-400" />
        </div>

        <button className="mt-4 bg-red-500 px-4 py-2 rounded hover:bg-red-600">
          IP 차단
        </button>
      </div>
    </div>
  );
}

function TopCard({ title, value, bg, icon }) {
  return (
    <div className={`rounded-xl text-white p-4 shadow ${bg}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
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