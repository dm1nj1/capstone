const API_BASE = " https://cristal-uninstructible-overthinly.ngrok-free.dev";

// ===============================
// 타입 정의
// ===============================
export interface SummaryData {
  attackCount: number;
  dangerLevel: string;
  averageRisk: number;
  realtimeStatus: string;
}

export interface ChartItem {
  name: string;
  value: number;
}

export interface TimelineItem {
  t: string;
  v: number;
}

export interface AlertItem {
  level: string;
  ip: string;
}

export interface TrafficItem {
  flowId: string;
  time: string;
  srcIp: string;
  dstIp: string;
  port: number;
  protocol: string;
  flag: string;
  result: string;
}

export interface AIResult {
  risk: string;
  detect: string;
  percent: string;
}

// ===============================
// 공통 fetch 함수
// ===============================
async function request<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${url}`);

    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("API 요청 실패:", err);
    return null;
  }
}

// ===============================
// 위험도 변환
// ===============================
function convertRisk(level?: string): string {
  if (level === "HIGH") return "위험";
  if (level === "MEDIUM") return "주의";
  return "안전";
}

// ===============================
// 1. 요약 카드
// ===============================
export async function fetchSummary(): Promise<SummaryData | null> {
  const json: any = await request("/api/dashboard/summary");
  if (!json) return null;

  return {
    attackCount: json.count ?? json.attackCount ?? 0,
    dangerLevel: convertRisk(json.risk_level ?? json.dangerLevel),
    averageRisk: json.avg_score ?? json.averageRisk ?? 0,
    realtimeStatus: json.status ?? json.realtimeStatus ?? "UNKNOWN",
  };
}

// ===============================
// 2. Pie Chart
// ===============================
export async function fetchAttackTypes(): Promise<ChartItem[]> {
  const json: any[] | null = await request("/api/dashboard/attack-types");
  if (!json) return [];

  return json.map((item) => ({
    name: item.name ?? item.type,
    value: item.value ?? item.cnt ?? 0,
  }));
}

// ===============================
// 3. Line Chart
// ===============================
export async function fetchTimeline(): Promise<TimelineItem[]> {
  const json: any[] | null = await request("/api/dashboard/timeline");
  if (!json) return [];

  return json.map((item) => ({
    t: item.t ?? item.time,
    v: item.v ?? item.value ?? item.count ?? 0,
  }));
}

// ===============================
// 4. 실시간 알림 로그
// ===============================
export async function fetchAlerts(): Promise<AlertItem[]> {
  const json: any[] | null = await request("/api/dashboard/alerts");
  if (!json) return [];

  return json.map((item) => ({
    level: convertRisk(item.level ?? item.risk),
    ip: item.ip ?? item.sourceIp,
  }));
}

// ===============================
// 5. 트래픽 테이블
// ===============================
export async function fetchTraffic(): Promise<TrafficItem[]> {
  const json: any[] | null = await request("/api/dashboard/traffic");
  if (!json) return [];

  return json.map((row) => ({
    flowId: row.flowId ?? row.id ?? "",
    time: row.timestamp ?? row.time ?? "",
    srcIp: row.srcIp ?? row.sourceIp ?? "",
    dstIp: row.dstIp ?? row.destinationIp ?? "",
    port: row.port ?? 0,
    protocol: row.protocol ?? "",
    flag: row.flag ?? row.tcpFlags ?? "",
    result: row.result ?? row.aiResult ?? "",
  }));
}

// ===============================
// 6. AI 결과
// ===============================
export async function getAIResult(
  flowId: number = 1
): Promise<AIResult | null> {
  const json: any = await request(`/api/flows/${flowId}/ai-results`);
  if (!json) return null;

  return {
    risk: convertRisk(json.risk),
    detect: json.detect ?? json.type ?? "",
    percent: json.percent ?? json.probability ?? "0%",
  };
}