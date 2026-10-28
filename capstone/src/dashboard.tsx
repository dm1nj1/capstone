import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Flame,
  AlertTriangle,
  Activity,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  LogIn,
  ShieldAlert,
  Menu,
  Network,
  UserPlus,
  Volume2,
  VolumeX,
  X,
  Search,
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
  fetchAllTraffic,
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
const TRAFFIC_LOGS_PER_PAGE = 5;
const REFRESH_INTERVAL_MS = 5000;
const ALERT_FLASH_DURATION_MS = 6000;
const CRITICAL_RISK_SCORE = 70;
const ATTACK_TYPE_COLORS: Record<string, string> = {
  "brute force": "#fb923c",
  "port scan": "#60a5fa",
  "network scan": "#a78bfa",
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
const DUMMY_NOTIFICATIONS = [
  {
    id: 1,
    type: "danger",
    title: "SSH Brute Force 탐지",
    message: "192.168.0.14에서 로그인 반복 시도가 감지되었습니다.",
    source: "192.168.0.14:53422",
    target: "10.10.0.21:22",
    detectedAt: "2026-07-01 14:28:12",
    detail:
      "짧은 시간 동안 동일 계정으로 SSH 인증 실패가 반복되었습니다. 비밀번호 대입 공격 가능성이 높습니다.",
    recommendation:
      "출발지 IP를 임시 차단하고 SSH 로그인 실패 횟수 제한 정책을 확인하세요.",
    time: "방금 전",
    unread: true,
  },
  {
    id: 2,
    type: "warning",
    title: "포트 스캔 의심",
    message: "10.0.2.8 대상 다중 포트 접근 패턴이 확인되었습니다.",
    source: "172.16.4.33",
    target: "10.0.2.8",
    detectedAt: "2026-07-01 14:16:04",
    detail:
      "단일 출발지에서 짧은 간격으로 21, 22, 80, 443, 3306 포트 접근이 발생했습니다.",
    recommendation:
      "스캔 출발지를 관찰 목록에 추가하고 방화벽 접근 로그를 함께 검토하세요.",
    time: "12분 전",
    unread: true,
  },
  {
    id: 3,
    type: "info",
    title: "트래픽 분석 완료",
    message: "최근 24시간 플로우 데이터 분석이 완료되었습니다.",
    source: "분석 엔진",
    target: "전체 플로우",
    detectedAt: "2026-07-01 13:50:27",
    detail:
      "최근 24시간 동안 수집된 네트워크 플로우에 대한 AI 위험도 산정이 완료되었습니다.",
    recommendation:
      "위험 점수 70점 이상 항목을 우선 확인하고 권장 조치 적용 여부를 검토하세요.",
    time: "38분 전",
    unread: false,
  },
  {
    id: 4,
    type: "success",
    title: "권장 조치 적용",
    message: "위험 IP 차단 정책이 정상 반영되었습니다.",
    source: "정책 관리자",
    target: "방화벽 정책",
    detectedAt: "2026-07-01 13:28:41",
    detail:
      "위험도가 높은 출발지 IP에 대한 차단 규칙이 정책 목록에 추가되었습니다.",
    recommendation:
      "차단 이후 동일 출발지의 재시도 여부와 정상 서비스 영향 여부를 확인하세요.",
    time: "1시간 전",
    unread: false,
  },
] as const;
const MENU_STRUCTURE = [
  {
    label: "요약 현황",
    description: "위험도, 공격 수, 실시간 상태",
    href: "#summary",
  },
  {
    label: "공격 분석",
    description: "공격 유형 비율과 최근 7일 추이",
    href: "#attack-analysis",
  },
  {
    label: "실시간 알림 로그",
    description: "플로우 검색, 위험 점수, 상세 보기",
    href: "#alert-log",
  },
  {
    label: "접근성 알림",
    description: "시각 및 청각 경보 제어",
    href: "#accessibility-controls",
  },
] as const;
const AUTH_MENU_ITEMS = [
  {
    label: "로그인",
    description: "기존 계정으로 접속",
    icon: LogIn,
  },
  {
    label: "회원가입",
    description: "새 계정 생성",
    icon: UserPlus,
  },
] as const;

type AttackChartMode = "all" | "today";
type TrafficDateRange = "all" | "24h" | "7d" | "30d";
type NotificationType = (typeof DUMMY_NOTIFICATIONS)[number]["type"];
type NotificationItem = (typeof DUMMY_NOTIFICATIONS)[number];

interface AccessibilityAlert {
  id: string;
  title: string;
  message: string;
  source: string;
  target: string;
  riskScore: string | number;
  action: string;
}

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

function getRiskScoreNumber(value: string | number) {
  const score = Number(value);

  return Number.isFinite(score) ? score : 0;
}

function getFlowPriority(item: AlertItem) {
  const riskScore = getRiskScoreNumber(item.riskScore);
  const levelScore =
    item.level === "위험" ? 100 : item.level === "주의" ? 70 : 40;

  return Math.max(riskScore, levelScore);
}

function getMostSevereFlow(items: AlertItem[]) {
  return [...items]
    .filter((item) => getFlowPriority(item) >= CRITICAL_RISK_SCORE)
    .sort((a, b) => getFlowPriority(b) - getFlowPriority(a))[0];
}

function buildAccessibilityAlert(item: AlertItem): AccessibilityAlert {
  return {
    id: `${item.flowId}-${item.prediction}-${item.riskScore}`,
    title: "위험 상황 통지",
    message: `${item.prediction} 공격이 감지되었습니다. 위험 점수 ${item.riskScore}점입니다.`,
    source: `${item.srcIp}:${item.srcPort}`,
    target: `${item.destIp}:${item.destPort}`,
    riskScore: item.riskScore,
    action: item.action,
  };
}

function playWarningTone() {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.1);
  gain.connect(audioContext.destination);

  [0, 0.32, 0.64].forEach((delay) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + delay);
    oscillator.connect(gain);
    oscillator.start(audioContext.currentTime + delay);
    oscillator.stop(audioContext.currentTime + delay + 0.18);
  });

  window.setTimeout(() => audioContext.close(), 1400);
}

function speakWarning(alert: AccessibilityAlert) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(
    `${alert.title}. ${alert.message} 권장 조치. ${alert.action}`
  );
  utterance.lang = "ko-KR";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
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
  if (!percent || percent < 0.05) return "";

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
  const [allTraffic, setAllTraffic] = useState<TrafficItem[]>([]);
  const [alertPage, setAlertPage] = useState(1);
  const [alertSearch, setAlertSearch] = useState("");
  const [trafficSearch, setTrafficSearch] = useState("");
  const [submittedTrafficSearch, setSubmittedTrafficSearch] = useState("");
  const [sourceIpFilter, setSourceIpFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] =
    useState<TrafficDateRange>("all");
  const [portFilter, setPortFilter] = useState("");
  const [trafficPage, setTrafficPage] = useState(1);
  const [trafficLoading, setTrafficLoading] = useState(true);
  const [trafficError, setTrafficError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationDetailOpen, setNotificationDetailOpen] = useState(false);
  const [attackChartMode, setAttackChartMode] =
    useState<AttackChartMode>("all");
  const [attackTypeLoading, setAttackTypeLoading] = useState(false);
  const [attackTypeError, setAttackTypeError] = useState("");
  const [selectedTraffic, setSelectedTraffic] = useState<TrafficDetail | null>(
    null
  );
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");
  const [visualAlertEnabled, setVisualAlertEnabled] = useState(true);
  const [audioAlertEnabled, setAudioAlertEnabled] = useState(true);
  const [accessibilityAlert, setAccessibilityAlert] =
    useState<AccessibilityAlert | null>(null);
  const [screenFlashActive, setScreenFlashActive] = useState(false);
  const lastAccessibilityAlertId = useRef("");
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
  const unreadNotificationCount = DUMMY_NOTIFICATIONS.filter(
    (item) => item.unread
  ).length;
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
              `${item.srcIp}:${item.srcPort}`,
              item.destIp,
              item.destPort,
              `${item.destIp}:${item.destPort}`,
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
  const sourceIpOptions = useMemo(
    () =>
      [...new Set(allTraffic.map((item) => item.srcIp).filter((ip) => ip && ip !== "-"))]
        .sort((a, b) => a.localeCompare(b)),
    [allTraffic]
  );
  const portOptions = useMemo(
    () =>
      [...new Set(allTraffic.map((item) => String(item.port)).filter((port) => port && port !== "-"))]
        .sort((a, b) => Number(a) - Number(b)),
    [allTraffic]
  );
  const filteredTraffic = useMemo(() => {
    const now = Date.now();
    const rangeDuration =
      dateRangeFilter === "24h"
        ? 24 * 60 * 60 * 1000
        : dateRangeFilter === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : dateRangeFilter === "30d"
            ? 30 * 24 * 60 * 60 * 1000
            : null;

    return allTraffic.filter((item) => {
      if (sourceIpFilter && item.srcIp !== sourceIpFilter) return false;
      if (portFilter && String(item.port) !== portFilter) return false;

      if (rangeDuration !== null) {
        const timestamp = getTrafficDate(item)?.getTime();

        if (timestamp === undefined || timestamp < now - rangeDuration) {
          return false;
        }
      }

      return matchesSearch(
        [
          item.flowId,
          item.time,
          item.startTime,
          item.srcIp,
          item.dstIp,
          item.port,
          item.protocol,
          item.result,
          item.attackType,
          item.flag,
        ],
        submittedTrafficSearch
      );
    });
  }, [
    allTraffic,
    dateRangeFilter,
    portFilter,
    sourceIpFilter,
    submittedTrafficSearch,
  ]);
  const trafficPageCount = Math.max(
    1,
    Math.ceil(filteredTraffic.length / TRAFFIC_LOGS_PER_PAGE)
  );
  const firstTrafficPage = Math.min(
    Math.max(1, trafficPage - 1),
    Math.max(1, trafficPageCount - 2)
  );
  const visibleTrafficPages = Array.from(
    { length: Math.min(3, trafficPageCount) },
    (_, index) => firstTrafficPage + index
  );
  const pagedTraffic = filteredTraffic.slice(
    (trafficPage - 1) * TRAFFIC_LOGS_PER_PAGE,
    trafficPage * TRAFFIC_LOGS_PER_PAGE
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
    let refreshTimer: number | undefined;

    const loadAllTraffic = async () => {
      try {
        const items = await fetchAllTraffic();

        if (!ignore) {
          setAllTraffic(items);
          setTrafficError("");
        }
      } catch (err) {
        console.error("All traffic API error:", err);

        if (!ignore) {
          setTrafficError("전체 트래픽 로그를 불러오지 못했습니다.");
        }
      } finally {
        if (!ignore) {
          setTrafficLoading(false);
          refreshTimer = window.setTimeout(loadAllTraffic, 30_000);
        }
      }
    };

    loadAllTraffic();

    return () => {
      ignore = true;
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
    };
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

  useEffect(() => {
    setTrafficPage(1);
  }, [
    dateRangeFilter,
    portFilter,
    sourceIpFilter,
    submittedTrafficSearch,
  ]);

  useEffect(() => {
    setTrafficPage((page) => Math.min(page, trafficPageCount));
  }, [trafficPageCount]);

  useEffect(() => {
    const mostSevereFlow = getMostSevereFlow(flows);

    if (!mostSevereFlow) return;

    const nextAlert = buildAccessibilityAlert(mostSevereFlow);

    if (lastAccessibilityAlertId.current === nextAlert.id) return;

    lastAccessibilityAlertId.current = nextAlert.id;
    setAccessibilityAlert(nextAlert);

    if (visualAlertEnabled) {
      setScreenFlashActive(true);
    }

    if (audioAlertEnabled) {
      try {
        playWarningTone();
        speakWarning(nextAlert);
      } catch (err) {
        console.error("Accessible audio alert error:", err);
      }
    }

    const flashTimer = window.setTimeout(
      () => setScreenFlashActive(false),
      ALERT_FLASH_DURATION_MS
    );

    return () => window.clearTimeout(flashTimer);
  }, [audioAlertEnabled, flows, visualAlertEnabled]);

  return (
    <div className="min-h-screen bg-[#edf2f7] p-6" style={{ fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif", }}>
      <style>
        {`
          @keyframes accessible-screen-flash {
            0%, 100% { opacity: 0; }
            12%, 42%, 72% { opacity: 0.32; }
            27%, 57%, 87% { opacity: 0.08; }
          }

          @keyframes accessible-alert-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
            50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
          }

          .accessible-screen-flash {
            animation: accessible-screen-flash 1s ease-in-out infinite;
          }

          .accessible-alert-pulse {
            animation: accessible-alert-pulse 1.2s ease-in-out infinite;
          }
        `}
      </style>

      {screenFlashActive && visualAlertEnabled && (
        <div
          className="accessible-screen-flash pointer-events-none fixed inset-0 z-[60] bg-red-500"
          aria-hidden="true"
        />
      )}

      {/* HEADER */}
      <div className="bg-[#3b4b60] text-white px-8 py-5 rounded-2xl shadow-lg flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-wide">
          보안 시스템 대시보드
        </h1>

        <div className="flex items-center gap-5">
          <p className="text-sm text-gray-200">
            현재 {currentAttackType} 공격이 점증 발생 중
          </p>

          <div
            id="accessibility-controls"
            className="flex rounded-xl border border-[#52637a] bg-[#2e3b4e] p-1"
          >
            <button
              type="button"
              onClick={() => setVisualAlertEnabled((enabled) => !enabled)}
              className={`flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                visualAlertEnabled
                  ? "bg-[#3b4b60] text-blue-200 shadow-sm"
                  : "text-gray-300 hover:text-white"
              }`}
              aria-pressed={visualAlertEnabled}
              aria-label="시각 알림 켜기 또는 끄기"
              title="시각 알림"
            >
              <Eye size={18} />
              시각
            </button>
            <button
              type="button"
              onClick={() => setAudioAlertEnabled((enabled) => !enabled)}
              className={`flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                audioAlertEnabled
                  ? "bg-[#3b4b60] text-blue-200 shadow-sm"
                  : "text-gray-300 hover:text-white"
              }`}
              aria-pressed={audioAlertEnabled}
              aria-label="청각 알림 켜기 또는 끄기"
              title="청각 알림"
            >
              {audioAlertEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              청각
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((open) => !open);
                setNotificationOpen(false);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#52637a] bg-[#2e3b4e] text-white shadow-sm transition hover:bg-[#465870]"
              aria-expanded={menuOpen}
              aria-label="메뉴 열기"
              title="메뉴"
            >
              <Menu size={19} />
            </button>

            {menuOpen && (
              <MenuStructureDropdown onClose={() => setMenuOpen(false)} />
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationOpen((open) => !open);
                setMenuOpen(false);
              }}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#52637a] bg-[#2e3b4e] text-white shadow-sm transition hover:bg-[#465870]"
              aria-label="알림 열기"
            >
              <Bell size={20} />
              {unreadNotificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <NotificationDropdown
                unreadCount={unreadNotificationCount}
                onClose={() => setNotificationOpen(false)}
                onViewAll={() => {
                  setNotificationOpen(false);
                  setNotificationDetailOpen(true);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* TOP SUMMARY */}
      <div id="summary" className="grid grid-cols-4 gap-5 mb-8 scroll-mt-6">
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
      <div
        id="attack-analysis"
        className="grid grid-cols-2 items-stretch gap-6 mb-8 scroll-mt-6"
      >

  {/* LEFT PANEL */}
  <Panel title="실시간 공격 상태">
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4">
      {/* PIE */}
      <div className="flex min-h-0 flex-col rounded-2xl border border-[#41506a] bg-[#3b4b60] p-5 text-white">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xl font-bold tracking-wide">공격 유형 비율</p>
            <p className="mt-1 text-xs text-gray-300">
              {attackChartMode === "all" ? "전체 공격 기준" : "오늘 공격 기준"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <p className="whitespace-nowrap text-sm text-gray-200">
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

        <div className="relative flex min-h-[420px] flex-1 flex-col justify-center">
          {attackChartMode === "all" && attackTypeLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#3b4b60]/90 text-sm text-gray-200">
              데이터를 불러오는 중...
            </div>
          )}

          {attackChartMode === "all" && attackTypeError ? (
            <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-red-400/40 bg-red-500/10 px-4 text-center text-sm text-red-200">
              {attackTypeError}
            </div>
          ) : attackTotal === 0 &&
            !(attackChartMode === "all" && attackTypeLoading) ? (
            <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-[#52637a] bg-[#34455f] px-4 text-center text-sm text-gray-300">
              표시할 공격 유형 데이터가 없습니다.
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-5 lg:flex-row lg:items-stretch">
              <div className="relative min-h-[420px] flex-1 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={118}
                      innerRadius={60}
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
                        backgroundColor: "#2e3b4e",
                        border: "1px solid #52637a",
                        borderRadius: 8,
                        color: "#ffffff",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full text-center">
                    <span className="text-xs font-semibold text-gray-300">
                      전체 공격
                    </span>
                    <span className="mt-1 text-2xl font-extrabold text-white">
                      {attackTotal.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-300">건</span>
                  </div>
                </div>
              </div>

              <div className="grid w-full gap-2 border-t border-[#52637a] pt-4 lg:w-64 lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                {chartData.map((item) => {
                  const percent =
                    attackTotal > 0 ? (item.value / attackTotal) * 100 : 0;

                  return (
                    <div
                      key={item.name}
                      className="rounded-lg border border-[#52637a] bg-[#34455f] px-3 py-2"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex min-w-0 items-start gap-2">
                          <span
                            className="mt-1 h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: getAttackTypeColor(item.name) }}
                          />
                          <span className="break-words text-sm font-semibold leading-5 text-white">
                            {item.name}
                          </span>
                        </div>
                        <div className="pl-5 text-sm text-gray-300">
                          <span className="font-bold text-blue-400">
                            {item.value.toLocaleString()}건
                          </span>{" "}
                          ({percent.toFixed(1)}%)
                        </div>
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
      <div className="flex min-h-0 flex-col rounded-2xl border border-[#41506a] bg-[#3b4b60] p-5 text-white">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-bold tracking-wide text-white">
              최근 7일간 공격
            </p>
            <p className="mt-1 text-xs text-gray-300">일별 탐지 건수</p>
          </div>
          <p className="whitespace-nowrap text-sm text-gray-200">
            총{" "}
            <span className="text-2xl font-extrabold text-orange-400">
              {weeklyAttackData
                .reduce((total, item) => total + Number(item.v ?? 0), 0)
                .toLocaleString()}
            </span>{" "}
            건
          </p>
        </div>

        <div className="relative h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={weeklyAttackData}
              margin={{ top: 12, right: 18, left: -18, bottom: 8 }}
            >
              <CartesianGrid stroke="#52637a" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#cbd5e1" />
              <YAxis stroke="#cbd5e1" allowDecimals={false} />
              <Tooltip formatter={(value) => [`${value}건`, "공격 수"]} />
              <Line
                type="monotone"
                dataKey="v"
                stroke="#f5a623"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </Panel>

  {/* RIGHT PANEL */}
  <div id="alert-log" className="scroll-mt-6">
  <Panel title="실시간 알림 로그">
    <div className="bg-[#3b4b60] rounded-2xl p-5 mb-4 border border-[#41506a]">
      <p className="text-sm text-gray-200 mb-2">최근 24시간 공격 추이</p>

      <ResponsiveContainer width="100%" height={130}>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={hourlyAttackData}>

            <XAxis
                dataKey="t"
                stroke="#cbd5e1"
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
        className="flex-1 bg-[#3b4b60] rounded-lg px-4 py-2 text-sm text-white outline-none border border-[#52637a] placeholder:text-gray-300 focus:border-blue-400"
        placeholder="검색"
        value={alertSearch}
        onChange={(event) => setAlertSearch(event.target.value)}
      />
    </div>

    <div className="overflow-x-auto rounded-xl border border-[#52637a]">
      <table className="min-w-[760px] w-full text-sm">
        <thead className="bg-[#3b4b60] text-left text-white">
          <tr>
            <Th>Flow ID</Th>
            <Th>Src IP:Port</Th>
            <Th>Dest IP:Port</Th>
            <Th>Prediction</Th>
            <Th>Action</Th>
            <Th>Risk Score</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody>
          {pagedFlows.map((item) => (
            <tr
              key={item.flowId}
              className="border-t border-[#52637a] hover:bg-[#3b4b60]"
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
                    ? "불러오는 중..."
                    : "상세 보기"}
                </button>
              </Td>
            </tr>
          ))}
          {pagedFlows.length === 0 && (
            <tr className="border-t border-[#52637a]">
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

          className="bg-[#3b4b60] text-white border border-[#52637a] px-4 py-2 rounded disabled:opacity-40"
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

          className="bg-[#3b4b60] text-white border border-[#52637a] px-4 py-2 rounded disabled:opacity-40"
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
</div>

      <section
        id="traffic-analysis"
        className="mb-8 rounded-2xl bg-[#2e3b4e] p-6 text-white shadow-lg"
        aria-labelledby="traffic-analysis-title"
      >
        <h2
          id="traffic-analysis-title"
          className="mb-5 text-2xl font-semibold tracking-wide"
        >
          상세 트래픽 분석
        </h2>
        <p className="mb-4 text-sm text-gray-300">
          네트워크 트래픽 목록 (검색 및 페이지 이동)
        </p>

        <div className="mb-5 flex flex-col gap-3 rounded-xl bg-[#3b4b60] p-3 lg:flex-row">
          <form
            className="flex min-w-0 flex-1 gap-2"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedTrafficSearch(trafficSearch.trim());
            }}
          >
            <label className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={trafficSearch}
                onChange={(event) => setTrafficSearch(event.target.value)}
                placeholder="Search"
                aria-label="전체 트래픽 검색"
                className="h-10 w-full rounded-l-lg border border-[#52637a] bg-[#2e3b4e] pl-10 pr-3 text-sm text-white outline-none placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
              />
            </label>
            <button
              type="submit"
              aria-label="검색"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-r-lg border border-[#52637a] bg-[#3b4b60] text-white transition hover:bg-[#465870] focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <Search size={17} aria-hidden="true" />
            </button>
          </form>

          <select
            value={sourceIpFilter}
            onChange={(event) => setSourceIpFilter(event.target.value)}
            aria-label="출발지 IP 필터"
            className="h-10 rounded-lg border border-[#52637a] bg-[#2e3b4e] px-4 text-sm text-white outline-none focus:border-blue-400"
          >
            <option value="">Source IP 전체</option>
            {sourceIpOptions.map((ip) => (
              <option key={ip} value={ip}>
                {ip}
              </option>
            ))}
          </select>

          <select
            value={dateRangeFilter}
            onChange={(event) =>
              setDateRangeFilter(event.target.value as TrafficDateRange)
            }
            aria-label="기간 필터"
            className="h-10 rounded-lg border border-[#52637a] bg-[#2e3b4e] px-4 text-sm text-white outline-none focus:border-blue-400"
          >
            <option value="all">Date Range</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>

          <select
            value={portFilter}
            onChange={(event) => setPortFilter(event.target.value)}
            aria-label="포트 필터"
            className="h-10 rounded-lg border border-[#52637a] bg-[#2e3b4e] px-4 text-sm text-white outline-none focus:border-blue-400"
          >
            <option value="">Port 전체</option>
            {portOptions.map((port) => (
              <option key={port} value={port}>
                {port}
              </option>
            ))}
          </select>
        </div>

        <p className="mb-3 text-sm text-gray-300" aria-live="polite">
          {trafficLoading
            ? "트래픽 로그를 불러오는 중..."
            : `${filteredTraffic.length.toLocaleString()}건`}
        </p>

        <div className="overflow-x-auto rounded-xl border border-[#52637a]">
          <table className="min-w-[1000px] w-full text-left text-sm">
            <thead className="bg-[#3b4b60]">
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
              {trafficError ? (
                <tr className="border-t border-[#52637a]">
                  <Td className="py-8 text-center text-red-200" colSpan={9}>
                    {trafficError}
                  </Td>
                </tr>
              ) : pagedTraffic.length > 0 ? (
                pagedTraffic.map((item) => (
                  <tr
                    key={item.flowId}
                    className="border-t border-[#52637a] transition hover:bg-[#3b4b60]"
                  >
                    <Td>{item.flowId}</Td>
                    <Td>{item.time}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setSourceIpFilter(item.srcIp)}
                        aria-label={`출발지 IP ${item.srcIp} 선택`}
                        title="눌러서 이 출발지 IP로 필터링"
                        className={`rounded px-1 py-0.5 text-left transition hover:bg-white/10 hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          sourceIpFilter === item.srcIp
                            ? "bg-blue-500/20 text-blue-200"
                            : "text-inherit"
                        }`}
                      >
                        {item.srcIp}
                      </button>
                    </Td>
                    <Td>{item.dstIp}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setPortFilter(String(item.port))}
                        aria-label={`포트 ${item.port} 선택`}
                        title="눌러서 이 포트로 필터링"
                        className={`rounded px-1 py-0.5 transition hover:bg-white/10 hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          portFilter === String(item.port)
                            ? "bg-blue-500/20 text-blue-200"
                            : "text-inherit"
                        }`}
                      >
                        {item.port}
                      </button>
                    </Td>
                    <Td>{item.protocol}</Td>
                    <Td>{item.flag}</Td>
                    <Td className="font-medium text-yellow-300">
                      {item.result}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => openTrafficDetail(item.flowId)}
                        disabled={detailLoadingId === item.flowId}
                        className="whitespace-nowrap text-blue-300 transition hover:text-blue-200 disabled:cursor-wait disabled:opacity-60"
                      >
                        {detailLoadingId === item.flowId
                          ? "불러오는 중..."
                          : "[상세 보기]"}
                      </button>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-[#52637a]">
                  <Td className="py-8 text-center text-gray-300" colSpan={9}>
                    {trafficLoading
                      ? "트래픽 로그를 불러오는 중..."
                      : "검색 결과가 없습니다."}
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setTrafficPage((page) => Math.max(1, page - 1))}
            disabled={trafficPage === 1}
            className="rounded-lg border border-[#52637a] bg-[#3b4b60] px-4 py-2 text-sm transition hover:bg-[#465870] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          {visibleTrafficPages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setTrafficPage(page)}
              aria-current={trafficPage === page ? "page" : undefined}
              aria-label={`${page}페이지`}
              className={`h-9 min-w-9 rounded-lg px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                trafficPage === page
                  ? "bg-blue-500 font-semibold text-white"
                  : "text-white hover:bg-white/10"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              setTrafficPage((page) => Math.min(trafficPageCount, page + 1))
            }
            disabled={trafficPage === trafficPageCount}
            className="rounded-lg border border-[#52637a] bg-[#3b4b60] px-4 py-2 text-sm transition hover:bg-[#465870] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>

      {accessibilityAlert && visualAlertEnabled && (
        <AccessibleAlertBanner
          alert={accessibilityAlert}
          onReplayAudio={() => {
            try {
              playWarningTone();
              speakWarning(accessibilityAlert);
            } catch (err) {
              console.error("Accessible audio replay error:", err);
            }
          }}
          onClose={() => {
            setScreenFlashActive(false);
            setAccessibilityAlert(null);
          }}
        />
      )}

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

      {notificationDetailOpen && (
        <NotificationDetailModal
          notifications={DUMMY_NOTIFICATIONS}
          onClose={() => setNotificationDetailOpen(false)}
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
      className="flex h-full flex-col bg-[#2e3b4e] text-white rounded-2xl shadow-lg p-6 border border-[#41506a]"
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
    <div className="flex rounded-lg bg-[#2e3b4e] p-1 text-xs border border-[#52637a]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1 transition ${
            value === option.value
              ? "bg-[#3b4b60] text-white border border-[#52637a]"
              : "text-gray-300 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MenuStructureDropdown({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute right-0 top-14 z-40 w-[360px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[#111827] shadow-2xl">
      <div className="flex items-start gap-3 border-b border-gray-200 px-5 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Network size={22} />
        </div>
        <div>
          <h3 className="text-lg font-bold">전체 메뉴</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            대시보드 주요 영역으로 바로 이동합니다.
          </p>
        </div>
      </div>

      <div className="p-4">
        <div className="relative space-y-3 before:absolute before:left-[18px] before:top-5 before:h-[calc(100%-40px)] before:w-px before:bg-gray-200">
          {MENU_STRUCTURE.map((item, index) => (
            <a
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="relative flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111827] text-sm font-bold text-white">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{item.label}</span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">
                  {item.description}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-gray-400" />
            </a>
          ))}
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="mb-3 px-1 text-xs font-bold uppercase text-gray-400">
            계정
          </p>
          <div className="grid grid-cols-2 gap-2">
            {AUTH_MENU_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-gray-500">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccessibleAlertBanner({
  alert,
  onReplayAudio,
  onClose,
}: {
  alert: AccessibilityAlert;
  onReplayAudio: () => void;
  onClose: () => void;
}) {
  return (
    <section
      className="accessible-alert-pulse fixed bottom-6 left-1/2 z-[70] w-[calc(100%-3rem)] max-w-4xl -translate-x-1/2 overflow-hidden rounded-2xl border-4 border-yellow-300 bg-[#111827] text-white shadow-2xl"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <ShieldAlert size={30} />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-wide text-yellow-300">
              시각 알림 · 청각 안내
            </p>
            <h3 className="mt-1 text-2xl font-black">{alert.title}</h3>
            <p className="mt-2 text-lg font-bold leading-7">{alert.message}</p>

            <div className="mt-3 grid gap-2 text-sm text-gray-100 md:grid-cols-3">
              <span className="rounded-lg bg-white/10 px-3 py-2">
                출발지 {alert.source}
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-2">
                목적지 {alert.target}
              </span>
              <span className="rounded-lg bg-red-500 px-3 py-2 font-black">
                위험 점수 {alert.riskScore}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-yellow-100">
              권장 조치: {alert.action}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 md:flex-col">
          <button
            type="button"
            onClick={onReplayAudio}
            className="flex items-center justify-center gap-2 rounded-lg bg-yellow-300 px-4 py-3 text-sm font-black text-[#111827] transition hover:bg-yellow-200"
          >
            <Volume2 size={18} />
            다시 듣기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/40 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <X size={18} />
            닫기
          </button>
        </div>
      </div>
    </section>
  );
}

function NotificationDropdown({
  unreadCount,
  onClose,
  onViewAll,
}: {
  unreadCount: number;
  onClose: () => void;
  onViewAll: () => void;
}) {
  return (
    <div className="absolute right-0 top-14 z-40 w-[380px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[#111827] shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold">알림</h3>
          <p className="mt-1 text-xs text-gray-500">
            읽지 않은 알림 {unreadCount}개
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-[#111827]"
          aria-label="알림 닫기"
        >
          <X size={18} />
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {DUMMY_NOTIFICATIONS.map((item) => (
          <div
            key={item.id}
            className={`flex gap-3 border-b border-gray-100 px-5 py-4 last:border-b-0 ${
              item.unread ? "bg-blue-50/60" : "bg-white"
            }`}
          >
            <div
              className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getNotificationStyle(
                item.type
              ).iconBg}`}
            >
              {getNotificationIcon(item.type)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-[#111827]">{item.title}</p>
                {item.unread && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
              <p className="mt-1 text-sm leading-5 text-gray-600">
                {item.message}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                <Clock3 size={13} />
                <span>{item.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-5 py-3">
        <button
          type="button"
          onClick={onViewAll}
          className="w-full rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          전체 알림 보기
        </button>
      </div>
    </div>
  );
}

function NotificationDetailModal({
  notifications,
  onClose,
}: {
  notifications: readonly NotificationItem[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white text-[#111827] shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold">전체 알림 상세</h3>
            <p className="mt-1 text-sm text-gray-600">
              알림별 탐지 정보와 권장 조치를 확인하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100 hover:text-[#111827]"
            aria-label="전체 알림 상세 닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-5 ${
                  item.unread
                    ? "border-blue-200 bg-blue-50/60"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${getNotificationStyle(
                      item.type
                    ).iconBg}`}
                  >
                    {getNotificationIcon(item.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[#111827]">{item.title}</p>
                        <p className="mt-1 text-sm text-gray-600">
                          {item.message}
                        </p>
                      </div>
                      {item.unread && (
                        <span className="rounded-full bg-blue-500 px-2 py-1 text-xs font-semibold text-white">
                          신규
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <DetailRow label="발생 시각" value={item.detectedAt} />
                  <DetailRow label="출발지" value={item.source} />
                  <DetailRow label="대상" value={item.target} />
                </div>

                <div className="mt-5 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="mb-2 text-sm font-semibold">상세 내용</p>
                  <p className="text-sm leading-6 text-gray-700">
                    {item.detail}
                  </p>
                </div>

                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="mb-2 text-sm font-semibold">권장 조치</p>
                  <p className="text-sm leading-6 text-gray-700">
                    {item.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getNotificationStyle(type: NotificationType) {
  const styles = {
    danger: {
      iconBg: "bg-red-100 text-red-600",
    },
    warning: {
      iconBg: "bg-yellow-100 text-yellow-700",
    },
    info: {
      iconBg: "bg-blue-100 text-blue-600",
    },
    success: {
      iconBg: "bg-green-100 text-green-600",
    },
  };

  return styles[type];
}

function getNotificationIcon(type: NotificationType) {
  const className = "h-5 w-5";

  if (type === "success") return <CheckCircle2 className={className} />;
  if (type === "info") return <Activity className={className} />;

  return <ShieldAlert className={className} />;
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
            <h3 className="text-xl font-bold">트래픽 상세 정보</h3>
            <p className="mt-1 text-sm text-gray-600">흐름 ID {detail.flowId}</p>
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
              <DetailRow label="출발지 IP" value={detail.srcIp} />
              <DetailRow label="출발지 포트" value={detail.srcPort} />
              <DetailRow label="목적지 IP" value={detail.dstIp} />
              <DetailRow label="목적지 포트" value={detail.dstPort} />
              <DetailRow label="통신 방식" value={detail.protocol} />
              <DetailRow label="시작 시간" value={detail.startTime} />
              <DetailRow label="종료 시간" value={detail.endTime} />
              <DetailRow label="TCP 플래그" value={detail.tcpFlags} />
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 border border-gray-200">
            <h4 className="mb-4 font-semibold">AI Analysis</h4>
            {aiResult ? (
              <div className="space-y-3 text-sm">
                <DetailRow label="모델" value={aiResult.modelName} />
                <DetailRow label="분석 결과" value={aiResult.prediction} />
                <DetailRow label="공격 유형" value={aiResult.attackType} />
                <DetailRow label="신뢰도" value={aiResult.confidence} />
                <DetailRow label="위험 점수" value={aiResult.riskScore} />
                <DetailRow label="권장 조치" value={aiResult.action} />
                <DetailRow label="분석 시각" value={aiResult.analyzedAt} />
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
