import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Flame,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchAlerts,
  fetchAttackTypes,
  fetchSummary,
  fetchTimeline,
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
const TRAFFIC_PER_PAGE = 10;

export default function Dashboard() {
  const [data, setData] = useState<SummaryData>(DEFAULT_SUMMARY);
  const [pieData, setPieData] = useState<ChartItem[]>([]);
  const [lineData, setLineData] = useState<TimelineItem[]>([]);
  const [flows, setFlows] = useState<AlertItem[]>([]);
  const [traffic, setTraffic] = useState<TrafficItem[]>([]);
  const [alertPage, setAlertPage] = useState(1);
  const [trafficPage, setTrafficPage] = useState(1);
  const [trafficPageCount, setTrafficPageCount] = useState(1);
  const [trafficHasNext, setTrafficHasNext] = useState(false);
  const [alertSearch, setAlertSearch] = useState("");
  const [trafficSearch, setTrafficSearch] = useState("");

  const chartData = useMemo(() => combineAttackTypes(pieData), [pieData]);
  const currentAttackType =
    chartData.reduce<ChartItem | null>(
      (top, item) => (!top || item.value > top.value ? item : top),
      null
    )?.name ?? "SSH Brute Force";
  const filteredFlows = useMemo(
    () =>
      flows.filter((item) =>
        matchesSearch(item, [
          "flowId",
          "srcIp",
          "srcPort",
          "destIp",
          "destPort",
          "prediction",
          "action",
          "riskScore",
          "level",
        ], alertSearch)
      ),
    [flows, alertSearch]
  );
  const filteredTraffic = useMemo(
    () =>
      traffic.filter((item) =>
        matchesSearch(item, [
          "flowId",
          "time",
          "srcIp",
          "dstIp",
          "port",
          "protocol",
          "flag",
          "result",
        ], trafficSearch)
      ),
    [traffic, trafficSearch]
  );
  const alertPageCount = Math.max(
    1,
    Math.ceil(filteredFlows.length / ALERTS_PER_PAGE)
  );
  const searchTrafficPageCount = Math.max(
    1,
    Math.ceil(filteredTraffic.length / TRAFFIC_PER_PAGE)
  );
  const effectiveTrafficPageCount = trafficSearch.trim()
    ? searchTrafficPageCount
    : trafficPageCount;
  const effectiveTrafficHasNext = trafficSearch.trim()
    ? trafficPage < searchTrafficPageCount
    : trafficHasNext;
  const pagedFlows = filteredFlows.slice(
    (alertPage - 1) * ALERTS_PER_PAGE,
    alertPage * ALERTS_PER_PAGE
  );
  const pagedTraffic = trafficSearch.trim()
    ? filteredTraffic.slice(
        (trafficPage - 1) * TRAFFIC_PER_PAGE,
        trafficPage * TRAFFIC_PER_PAGE
      )
    : filteredTraffic;

  useEffect(() => {
    const load = async () => {
      try {
        const [summary, attackTypes, timeline, alerts] = await Promise.all([
          fetchSummary(),
          fetchAttackTypes(),
          fetchTimeline(),
          fetchAlerts(),
        ]);

        if (summary) {
          setData(summary);
        }
        setPieData(attackTypes);
        setLineData(timeline);
        setFlows(alerts);
      } catch (err) {
        console.error("API error:", err);
      }
    };

    load();
    const interval = setInterval(load, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadTraffic = async () => {
      try {
        const isSearching = trafficSearch.trim().length > 0;
        const trafficData = await fetchTraffic(
          isSearching ? 1 : trafficPage,
          isSearching ? 200 : TRAFFIC_PER_PAGE
        );
        setTraffic(trafficData.items);
        if (isSearching) {
          setTrafficHasNext(false);
        } else {
          setTrafficPageCount((pageCount) =>
            Math.max(pageCount, trafficData.totalPages)
          );
          setTrafficHasNext(trafficData.hasNext);
        }
      } catch (err) {
        console.error("Traffic API error:", err);
      }
    };

    loadTraffic();
    const interval = setInterval(loadTraffic, 5000);

    return () => clearInterval(interval);
  }, [trafficPage, trafficSearch]);

  useEffect(() => {
    setAlertPage((page) => Math.min(page, alertPageCount));
  }, [alertPageCount]);

  useEffect(() => {
    setAlertPage(1);
  }, [alertSearch]);

  useEffect(() => {
    setTrafficPage(1);
  }, [trafficSearch]);

  return (
    <div className="min-h-screen bg-[#edf1f7] p-6 font-sans">
      <div className="bg-gradient-to-r from-[#2e3c52] to-[#3d4d65] text-white px-8 py-5 rounded-2xl shadow-lg flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-wide">
          보안 시스템 대시보드
        </h1>

        <p className="text-sm opacity-90">
          현재 {currentAttackType} 공격이 집중 발생 중
        </p>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        <SummaryCard
          title="현재 위험도"
          value={data.dangerLevel}
          color="bg-red-500"
          icon={<Flame size={20} />}
        />

        <SummaryCard
          title="오늘 공격 수"
          value={`${data.attackCount}건`}
          color="bg-blue-500"
          icon={<AlertTriangle size={20} />}
        />

        <SummaryCard
          title="실시간 공격 여부"
          value={data.realtimeStatus}
          color="bg-green-500"
          icon={<Activity size={20} />}
        />

        <SummaryCard
          title="평균 위험 점수"
          value={`${data.averageRisk}점`}
          color="bg-yellow-500"
          icon={<AlertTriangle size={20} />}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <AttackStatusPanel chartData={chartData} lineData={lineData} />

        <AlertLogPanel
          lineData={lineData}
          pagedFlows={pagedFlows}
          alertPage={alertPage}
          alertPageCount={alertPageCount}
          alertSearch={alertSearch}
          setAlertSearch={setAlertSearch}
          setAlertPage={setAlertPage}
        />
      </div>

      <TrafficAnalysisPanel
        pagedTraffic={pagedTraffic}
        trafficPage={trafficPage}
        trafficPageCount={effectiveTrafficPageCount}
        trafficHasNext={effectiveTrafficHasNext}
        trafficSearch={trafficSearch}
        detailModalSize="large"
        setTrafficSearch={setTrafficSearch}
        setTrafficPage={setTrafficPage}
      />
    </div>
  );
}

function matchesSearch(
  item: object,
  keys: string[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const values = item as Record<string, unknown>;

  return keys.some((key) =>
    String(values[key] ?? "")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

interface PanelProps {
  title: string;
  children: ReactNode;
}

function Panel({ title, children }: PanelProps) {
  return (
    <div className="bg-gradient-to-r from-[#2e3c52] to-[#34445c] text-white rounded-2xl shadow-lg p-6">
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

function getPageButtons(currentPage: number, pageCount: number) {
  const pages = new Set<number>([1, pageCount]);
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(pageCount, currentPage + 2);

  for (let page = start; page <= end; page += 1) {
    pages.add(page);
  }

  const sortedPages = Array.from(pages).sort((a, b) => a - b);
  const buttons: Array<number | string> = [];

  sortedPages.forEach((page) => {
    const previous = buttons[buttons.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      buttons.push(`ellipsis-${previous}-${page}`);
    }
    buttons.push(page);
  });

  return buttons;
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  color: string;
  icon: ReactNode;
}

function SummaryCard({ title, value, color, icon }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-500 text-sm">{title}</p>

        <div className={`${color} text-white p-3 rounded-full`}>{icon}</div>
      </div>

      <h3 className="text-4xl font-bold text-[#111827]">{value}</h3>
    </div>
  );
}

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

function getAttackTypeColor(name: string, index = 0) {
  const label = getAttackTypeLabel(name, index);
  const normalizedName = label.trim().toLowerCase();

  return ATTACK_TYPE_COLORS[normalizedName] ?? "#94a3b8";
}

function getAttackTypeLabel(name: string, index = 0) {
  const normalizedName = name.trim().toLowerCase().replace(/[_-]/g, " ");

  if (normalizedName.includes("brute")) return "Brute Force";
  if (normalizedName.includes("port") && normalizedName.includes("scan")) {
    return "Port Scan";
  }
  if (normalizedName.includes("network") && normalizedName.includes("scan")) {
    return "Network Scan";
  }
  if (normalizedName.includes("ddos")) return "DDoS";
  if (normalizedName.includes("syn") && normalizedName.includes("flood")) {
    return "SYN Flood";
  }

  return ATTACK_TYPE_LABELS[index % ATTACK_TYPE_LABELS.length];
}

function combineAttackTypes(items: ChartItem[]): ChartItem[] {
  const grouped = new Map<string, number>();

  items.forEach((item, index) => {
    const label = getAttackTypeLabel(item.name, index);
    grouped.set(label, (grouped.get(label) ?? 0) + item.value);
  });

  return ATTACK_TYPE_LABELS.map((label) => ({
    name: label,
    value: grouped.get(label) ?? 0,
  })).filter((item) => item.value > 0);
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

interface AttackStatusPanelProps {
  chartData: ChartItem[];
  lineData: TimelineItem[];
}

function AttackStatusPanel({
  chartData,
  lineData,
}: AttackStatusPanelProps) {
  return (
    <Panel title="?ㅼ떆媛?怨듦꺽 ?곹깭">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#33445d] rounded-2xl p-5">
          <p className="text-gray-300 text-sm mb-3">怨듦꺽 ?좏삎</p>

          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                outerRadius={90}
                innerRadius={0}
                stroke="#fff"
                strokeWidth={2}
                label={renderPieLabel}
                labelLine={false}
                isAnimationActive={false}
              >
                {chartData.map((item, i) => (
                  <Cell
                    key={item.name}
                    fill={getAttackTypeColor(item.name, i)}
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

        <div className="bg-[#33445d] rounded-2xl p-5">
          <p className="text-gray-300 text-sm mb-3">?쒓컙蹂?怨듦꺽</p>

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
  );
}

interface AlertLogPanelProps {
  lineData: TimelineItem[];
  pagedFlows: AlertItem[];
  alertPage: number;
  alertPageCount: number;
  alertSearch: string;
  setAlertSearch: Dispatch<SetStateAction<string>>;
  setAlertPage: Dispatch<SetStateAction<number>>;
}

function AlertLogPanel({
  lineData,
  pagedFlows,
  alertPage,
  alertPageCount,
  alertSearch,
  setAlertSearch,
  setAlertPage,
}: AlertLogPanelProps) {
  return (
    <Panel title="?ㅼ떆媛??뚮┝ 濡쒓렇">
      <div className="bg-[#33445d] rounded-2xl p-5 mb-4">
        <p className="text-sm text-gray-300 mb-2">理쒓렐 怨듦꺽 異붿씠</p>

        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={lineData}>
            <Line dataKey="v" stroke="#f5a623" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-3 mb-4">
        <button className="bg-red-500 px-4 py-2 rounded-lg text-sm hover:bg-red-600">
          HIGH留?蹂닿린
        </button>

        <input
          value={alertSearch}
          onChange={(event) => setAlertSearch(event.target.value)}
          className="flex-1 bg-[#33445d] rounded-lg px-4 py-2 text-sm outline-none"
          placeholder="검색"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#41506a]">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-[#3b4b61] text-left text-gray-200">
            <tr>
              <Th>FlowID</Th>
              <Th>Src IP:Port</Th>
              <Th>Dest IP:Port</Th>
              <Th>Prediction</Th>
              <Th>Action</Th>
              <Th>RiskScore</Th>
            </tr>
          </thead>

          <tbody>
            {pagedFlows.map((item, i) => (
              <tr
                key={`${item.flowId}-${i}`}
                className="border-t border-[#41506a] bg-[#33445d] hover:bg-[#34455b]"
              >
                <Td>{item.flowId}</Td>
                <Td>{`${item.srcIp}:${item.srcPort}`}</Td>
                <Td>{`${item.destIp}:${item.destPort}`}</Td>
                <Td
                  className={
                    String(item.prediction).toLowerCase().includes("high")
                      ? "text-red-400"
                      : "text-yellow-300"
                  }
                >
                  {item.prediction}
                </Td>
                <Td>{item.action}</Td>
                <Td>{item.riskScore}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center items-center gap-4 mt-5">
        <button
          type="button"
          onClick={() => setAlertPage((page) => Math.max(1, page - 1))}
          disabled={alertPage === 1}
          className="bg-[#4a5568] px-4 py-2 rounded enabled:cursor-pointer disabled:cursor-default disabled:opacity-40"
        >
          Previous
        </button>

        <div className="flex items-center gap-2">
          {getPageButtons(alertPage, alertPageCount).map((page) =>
            typeof page === "number" ? (
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
            ) : (
              <span key={page} className="px-1 text-gray-300">
                ...
              </span>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            setAlertPage((page) => Math.min(alertPageCount, page + 1))
          }
          disabled={alertPage === alertPageCount}
          className="bg-blue-500 px-4 py-2 rounded enabled:cursor-pointer disabled:cursor-default disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </Panel>
  );
}

interface TrafficAnalysisPanelProps {
  pagedTraffic: TrafficItem[];
  trafficPage: number;
  trafficPageCount: number;
  trafficHasNext: boolean;
  trafficSearch: string;
  detailModalSize?: "default" | "large";
  setTrafficSearch: Dispatch<SetStateAction<string>>;
  setTrafficPage: Dispatch<SetStateAction<number>>;
}

function TrafficAnalysisPanel({
  pagedTraffic,
  trafficPage,
  trafficPageCount,
  trafficHasNext,
  trafficSearch,
  detailModalSize = "default",
  setTrafficSearch,
  setTrafficPage,
}: TrafficAnalysisPanelProps) {
  const [selectedTraffic, setSelectedTraffic] = useState<TrafficDetail | null>(
    null
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingFlowId, setLoadingFlowId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");

  const openDetail = async (row: TrafficItem) => {
    setIsDetailOpen(true);
    setSelectedTraffic(null);
    setDetailError("");
    setLoadingFlowId(row.flowId);

    try {
      const detail = await fetchTrafficDetail(row.flowId);

      if (detail) {
        setSelectedTraffic(detail);
      } else {
        setDetailError("상세 데이터를 불러오지 못했습니다.");
      }
    } catch (error) {
      console.error("Traffic detail API error:", error);
      setDetailError("상세 데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoadingFlowId(null);
    }
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedTraffic(null);
    setDetailError("");
  };
  const detailModalStyle =
    detailModalSize === "large"
      ? { width: "92vw", maxWidth: "1200px", minHeight: "720px" }
      : { width: "100%", maxWidth: "768px" };

  return (
    <Panel title="?곸꽭 ?몃옒??遺꾩꽍">
      <p className="text-gray-300 text-sm mb-4">
        ?ㅽ듃?뚰겕 ?몃옒??紐⑸줉 (寃??諛??섏씠吏?
      </p>

      <div className="bg-[#33445d] rounded-xl p-3 flex gap-3 mb-5">
        <div className="flex-1 flex items-center bg-[#2f3b4c] rounded-lg px-3">
          <Search size={16} className="text-gray-400 mr-2" />
          <input
            value={trafficSearch}
            onChange={(event) => setTrafficSearch(event.target.value)}
            placeholder="검색"
            className="bg-transparent w-full py-2 outline-none text-sm"
          />
        </div>

        <Select label="Source IP" />
        <Select label="Date Range" />
        <Select label="Port" />
      </div>

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
            {pagedTraffic.map((row) => (
              <tr
                key={row.flowId}
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

                <Td>
                  <button
                    type="button"
                    onClick={() => openDetail(row)}
                    disabled={loadingFlowId === row.flowId}
                    className="text-blue-300 hover:text-blue-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    {loadingFlowId === row.flowId
                      ? "Loading..."
                      : "View Details"}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center items-center gap-4 mt-5">
        <button
          type="button"
          onClick={() => setTrafficPage((page) => Math.max(1, page - 1))}
          disabled={trafficPage === 1}
          className="bg-[#4a5568] px-4 py-2 rounded enabled:cursor-pointer disabled:cursor-default disabled:opacity-40"
        >
          Previous
        </button>

        <div className="flex items-center gap-2">
          {getPageButtons(trafficPage, trafficPageCount).map((page) =>
            typeof page === "number" ? (
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
            ) : (
              <span key={page} className="px-1 text-gray-300">
                ...
              </span>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => setTrafficPage((page) => page + 1)}
          disabled={!trafficHasNext}
          className="bg-blue-500 px-4 py-2 rounded enabled:cursor-pointer disabled:cursor-default disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {isDetailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="traffic-detail-title"
        >
          <div
            className="rounded-xl border border-[#52647f] bg-[#27364a] shadow-2xl"
            style={detailModalStyle}
          >
            <div className="flex items-center justify-between border-b border-[#41506a] px-5 py-4">
              <h3 id="traffic-detail-title" className="text-lg font-semibold">
                Traffic Detail
              </h3>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded p-1 text-gray-300 hover:bg-[#33445d] hover:text-white"
                aria-label="Close traffic detail"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[88vh] overflow-y-auto p-8">
              {loadingFlowId && !selectedTraffic ? (
                <div className="flex items-center justify-center gap-2 py-12 text-gray-200">
                  <Loader2 size={18} className="animate-spin" />
                  상세 데이터를 불러오는 중입니다.
                </div>
              ) : detailError ? (
                <div className="rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-200">
                  {detailError}
                </div>
              ) : selectedTraffic ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <DetailItem
                      label="FlowID"
                      value={selectedTraffic.flowId}
                      size={detailModalSize}
                    />
                    <DetailItem
                      label="Protocol"
                      value={selectedTraffic.protocol}
                      size={detailModalSize}
                    />
                    <DetailItem
                      label="Source"
                      value={`${selectedTraffic.srcIp}:${selectedTraffic.srcPort}`}
                      size={detailModalSize}
                    />
                    <DetailItem
                      label="Destination"
                      value={`${selectedTraffic.dstIp}:${selectedTraffic.dstPort}`}
                      size={detailModalSize}
                    />
                    <DetailItem
                      label="Start Time"
                      value={formatDateTime(selectedTraffic.startTime)}
                      size={detailModalSize}
                    />
                    <DetailItem
                      label="End Time"
                      value={formatDateTime(selectedTraffic.endTime)}
                      size={detailModalSize}
                    />
                  </div>

                  <div>
                    <h4 className="mb-4 text-base font-semibold text-gray-200">
                      AI Analysis
                    </h4>

                    {selectedTraffic.aiResult ? (
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        <DetailItem
                          label="Model"
                          value={selectedTraffic.aiResult.modelName}
                          size={detailModalSize}
                        />
                        <DetailItem
                          label="Prediction"
                          value={selectedTraffic.aiResult.prediction}
                          size={detailModalSize}
                        />
                        <DetailItem
                          label="Attack Type"
                          value={selectedTraffic.aiResult.attackType}
                          size={detailModalSize}
                        />
                        <DetailItem
                          label="Confidence"
                          value={formatPercent(
                            selectedTraffic.aiResult.confidence
                          )}
                          size={detailModalSize}
                        />
                        <DetailItem
                          label="Risk Score"
                          value={selectedTraffic.aiResult.riskScore}
                          size={detailModalSize}
                        />
                        <DetailItem
                          label="Analyzed At"
                          value={formatDateTime(
                            selectedTraffic.aiResult.analyzedAt
                          )}
                          size={detailModalSize}
                        />
                        <DetailItem
                          label="Action"
                          value={selectedTraffic.aiResult.action}
                          size={detailModalSize}
                        />
                        <DetailItem
                          label="Action Detail"
                          value={selectedTraffic.aiResult.actionDetail}
                          size={detailModalSize}
                          wide
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#33445d] px-4 py-3 text-sm text-gray-300">
                        AI 분석 결과가 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function DetailItem({
  label,
  value,
  size = "default",
  wide = false,
}: {
  label: string;
  value: string | number | undefined;
  size?: "default" | "large";
  wide?: boolean;
}) {
  const isLarge = size === "large";

  return (
    <div
      className={`rounded-lg bg-[#33445d] ${
        isLarge ? "min-h-[104px] p-5" : "p-3"
      } ${wide ? "md:col-span-2" : ""}`}
    >
      <div
        className={`mb-2 uppercase text-gray-400 ${
          isLarge ? "text-sm" : "text-xs"
        }`}
      >
        {label}
      </div>
      <div
        className={`break-words font-semibold text-white ${
          isLarge ? "text-lg leading-7" : "text-sm"
        }`}
      >
        {value ?? "-"}
      </div>
    </div>
  );
}

function formatDateTime(value: string | number | undefined) {
  if (!value || value === "-") return "-";

  return String(value).replace("T", " ");
}

function formatPercent(value: string | number | undefined) {
  if (value === undefined || value === "-") return "-";

  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return String(value);

  return numberValue <= 1
    ? `${(numberValue * 100).toFixed(1)}%`
    : `${numberValue.toFixed(1)}%`;
}
