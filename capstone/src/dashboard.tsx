import { useState, useEffect } from "react";
import { Flame, AlertTriangle, Activity, Search } from "lucide-react";
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

const API_BASE = "http://localhost:8080";

export default function Dashboard() {
  const [data, setData] = useState({
    dangerLevel: "위험",
    attackCount: 0,
    realtimeStatus: "ACTIVE",
    averageRisk: 0,
  });

  const [pieData, setPieData] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [trafficFlows, setTrafficFlows] = useState([]); // 하단 테이블용 데이터

  // API 호출 함수들 (기존 로직 유지)
  const fetchSummary = async () => { /* ...생략... */ };
  const fetchAttackTypes = async () => { /* ...생략... */ };
  const fetchTimeline = async () => { /* ...생략... */ };
  const fetchAlerts = async () => { /* ...생략... */ };

  // 이미지의 하단 테이블 데이터를 가져오는 새로운 함수 (가정)
  const fetchTrafficFlows = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/traffic`);
      const json = await res.json();
      setTrafficFlows(json);
    } catch (err) {
      console.error("traffic flows error:", err);
    }
  };

  useEffect(() => {
    const load = () => {
      fetchSummary();
      fetchAttackTypes();
      fetchTimeline();
      fetchAlerts();
      fetchTrafficFlows();
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#eef2f7] p-6 font-sans text-[#2f3b4c]">
      {/* HEADER */}
      <div className="bg-[#3c4b5f] text-white px-6 py-4 rounded-xl flex justify-between items-center mb-6 shadow-md">
        <h1 className="text-lg font-semibold text-white">보안 시스템 대시보드</h1>
        <span className="text-sm opacity-80">
          현재 SSH Brute Force 공격이 점증 발생 중
        </span>
      </div>

      {/* TOP CARD */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card title="현재 위험도" value={data.dangerLevel} color="bg-[#e85d4f]" icon={<Flame size={20}/>} />
        <Card title="오늘 공격 수" value={`${data.attackCount}건`} color="bg-[#4a6cf7]" icon={<AlertTriangle size={20}/>} />
        <Card title="실시간 공격 여부" value={data.realtimeStatus} color="bg-[#3cb371]" icon={<Activity size={20}/>} />
        <Card title="평균 위험 점수" value={`${data.averageRisk}점`} color="bg-[#f4a62a]" icon={<AlertTriangle size={20}/>} />
      </div>

      {/* CENTER - 공격 상태 & 알림 로그 */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow">
          <h2 className="font-semibold mb-4 text-white">실시간 공격 상태</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#3c4b5f] p-4 rounded-xl border border-gray-600">
              <p className="text-xs text-gray-300 mb-3">공격 유형</p>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" outerRadius={60} stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#f4a62a" : "#4a90e2"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-around text-[10px] mt-2">
                <span className="text-[#f4a62a]">● Brute Force</span>
                <span className="text-[#4a90e2]">● Port Scan</span>
              </div>
            </div>

            <div className="bg-[#3c4b5f] p-4 rounded-xl border border-gray-600">
              <p className="text-xs text-gray-300 mb-3">시간별 공격</p>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={lineData}>
                  <XAxis dataKey="t" hide />
                  <YAxis hide />
                  <Tooltip />
                  <Line type="monotone" dataKey="v" stroke="#f4a62a" strokeWidth={2} dot={{ r: 3, fill: "#f4a62a" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow">
          <h2 className="font-semibold mb-4 text-white">실시간 알림 로그</h2>
          <div className="bg-[#3c4b5f] p-4 rounded-xl border border-gray-600 flex-1 min-h-[200px]">
             <p className="text-[10px] text-gray-400 mb-4">최근 공격 추이</p>
             {/* 이미지 상의 작은 그래프와 로그 목록 재현 */}
             <div className="space-y-2">
                {alerts.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-xs border-b border-gray-600 pb-2">
                    <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded">위험</span>
                    <span className="text-gray-300">{item.ip}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* BOTTOM - 상세 트래픽 분석 (이미지 핵심 부분) */}
      <div className="bg-[#2f3b4c] text-white p-5 rounded-xl shadow">
        <h2 className="font-semibold mb-1 text-white">상세 트래픽 분석</h2>
        <p className="text-xs text-gray-400 mb-4">네트워크 트래픽 목록 (검색 및 페이징)</p>
        
        {/* Search Bar Area */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <input type="text" className="w-full bg-[#3c4b5f] border border-gray-600 rounded px-3 py-1.5 text-xs outline-none" placeholder="Search..." />
            <Search className="absolute right-3 top-2 text-gray-400" size={14} />
          </div>
          <select className="bg-[#3c4b5f] border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300">
            <option>Source IP</option>
          </select>
          <select className="bg-[#3c4b5f] border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300">
            <option>Date Range</option>
          </select>
          <select className="bg-[#3c4b5f] border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300">
            <option>Port</option>
          </select>
        </div>

        {/* Traffic Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-gray-400 border-b border-gray-600">
                <th className="py-2 font-medium">FlowID</th>
                <th className="py-2 font-medium">Timestamp</th>
                <th className="py-2 font-medium">Source IP</th>
                <th className="py-2 font-medium">Destination IP</th>
                <th className="py-2 font-medium">Port</th>
                <th className="py-2 font-medium">Protocol</th>
                <th className="py-2 font-medium">TCP Flags</th>
                <th className="py-2 font-medium">AI Result</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {trafficFlows.map((flow, idx) => (
                <tr key={idx} className="border-b border-gray-700/50 hover:bg-[#3c4b5f]/50">
                  <td className="py-3">{flow.flowId || "[Flow12345]"}</td>
                  <td>{flow.timestamp || "14:01:23"}</td>
                  <td>{flow.sourceIp || "192.168.1.15"}</td>
                  <td>{flow.destIp || "10.0.0.1"}</td>
                  <td>{flow.port || "22"}</td>
                  <td>{flow.protocol || "TCP"}</td>
                  <td>{flow.flags || "S"}</td>
                  <td>
                    <span className={flow.risk === 'High' ? "text-red-400" : "text-yellow-400"}>
                      {flow.aiResult || "SSH Brute Force (High)"}
                    </span>
                  </td>
                  <td>
                    <button className="text-blue-400 hover:underline">[View Details]</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Dummy */}
        <div className="flex justify-center mt-4 gap-2 text-[10px]">
          <button className="px-2 py-1 bg-[#3c4b5f] rounded">Previous</button>
          <button className="px-2 py-1 bg-blue-500 rounded text-white">1</button>
          <button className="px-2 py-1 bg-[#3c4b5f] rounded">2</button>
          <button className="px-2 py-1 bg-[#3c4b5f] rounded">3</button>
          <button className="px-2 py-1 bg-[#3c4b5f] rounded">Next</button>
        </div>
      </div>
    </div>
  );
}

// 기존 Card 컴포넌트 스타일 수정 (이미지처럼 배경 흰색 유지)
function Card({ title, value, color, icon }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-[11px] font-medium">{title}</span>
        <div className={`p-1.5 rounded-full ${color} text-white`}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold text-[#2f3b4c]">{value}</p>
    </div>
  );
}