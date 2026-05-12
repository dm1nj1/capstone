const API_BASE = "";

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

export interface TrafficPageResult {
  items: TrafficItem[];
  totalPages: number;
  hasNext: boolean;
}

export interface AIResult {
  risk: string;
  detect: string;
  percent: string;
}

async function request<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${url}`);

    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("API request failed:", err);
    return null;
  }
}

function convertRisk(level?: string): string {
  if (level === "HIGH") return "위험";
  if (level === "MEDIUM") return "주의";
  return "안전";
}

function getCount(row: any, key: string): number {
  const value = row[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}

function formatTcpFlags(row: any): string {
  const flagCounts: Array<[string, number]> = [
    ["SYN", getCount(row, "synCount")],
    ["ACK", getCount(row, "ackCount")],
    ["FIN", getCount(row, "finCount")],
    ["RST", getCount(row, "rstCount")],
    ["PSH", getCount(row, "pshCount")],
    ["URG", getCount(row, "urgCount")],
  ];
  const flags = flagCounts
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}:${count}`);

  return flags.length > 0 ? flags.join(" ") : row.flag ?? row.tcpFlags ?? "-";
}

function getFlowLevel(row: any): string {
  if (row.level || row.risk) {
    return convertRisk(row.level ?? row.risk);
  }

  const synCount = getCount(row, "synCount");
  const rstCount = getCount(row, "rstCount");
  const finCount = getCount(row, "finCount");

  if (synCount >= 1 || rstCount >= 1) return "주의";
  if (finCount >= 1) return "알림";
  return "정상";
}

export async function fetchSummary(): Promise<SummaryData | null> {
  const json: any = await request("/api/dashboard/summary");
  if (!json) return null;

  return {
    attackCount: json.todayAttacks ?? 0,
    dangerLevel: json.avgRisk >= 70 ? "위험" : "주의",
    averageRisk: Math.round(json.avgRisk ?? 0),
    realtimeStatus: json.realtimeAttack ? "ATTACK" : "NORMAL",
  };
}

export async function fetchAttackTypes(): Promise<ChartItem[]> {
  const json: any[] | null = await request("/api/dashboard/attack-types");
  if (!json) return [];

  return json.map((item) => ({
    name: item.type,
    value: item.count,
  }));
}

export async function fetchTimeline(): Promise<TimelineItem[]> {
  const json: any[] | null = await request("/api/dashboard/timeline");
  if (!json) return [];

  return json.map((item) => ({
    t: `${item.hour}시`,
    v: item.count ?? 0,
  }));
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  const json: any = await request("/api/flows?page=0&size=50");
  if (!json) return [];

  const rows: any[] = Array.isArray(json)
    ? json
    : json.content ?? json.data ?? json.flows ?? json.items ?? [];

  return rows.map((item) => ({
    level: getFlowLevel(item),
    ip: `${item.srcIp ?? item.sourceIp ?? "-"} -> ${
      item.destIp ?? item.dstIp ?? item.destinationIp ?? "-"
    }:${item.destPort ?? item.destport ?? item.dstPort ?? item.port ?? "-"} · ${formatTcpFlags(
      item
    )}`,
  }));
}

function toTrafficItems(rows: any[]): TrafficItem[] {
  return rows.map((row: any) => ({
    flowId: String(row.flowId ?? row.id ?? ""),
    time: row.startTime ? row.startTime.split("T")[1] ?? row.startTime : "-",
    srcIp: row.srcIp ?? row.sourceIp ?? "-",
    dstIp: row.destIp ?? row.dstIp ?? row.destinationIp ?? "-",
    port: row.destPort ?? row.destport ?? row.dstPort ?? row.port ?? 0,
    protocol: row.protocol ?? "-",
    flag: formatTcpFlags(row),
    result: row.result ?? row.aiResult ?? "분석 완료",
  }));
}

export async function fetchTraffic(
  page = 1,
  size = 10
): Promise<TrafficPageResult> {
  const pageIndex = Math.max(0, page - 1);
  const json: any = await request(`/api/flows?page=${pageIndex}&size=${size}`);
  if (!json) return { items: [], totalPages: Math.max(1, page), hasNext: false };

  if (Array.isArray(json)) {
    const start = pageIndex * size;
    const totalPages = Math.max(1, Math.ceil(json.length / size));
    return {
      items: toTrafficItems(json.slice(start, start + size)),
      totalPages,
      hasNext: page < totalPages,
    };
  }

  const rows: any[] = json.content ?? json.data ?? json.flows ?? json.items ?? [];
  const totalPages =
    json.totalPages ??
    (json.totalElements ? Math.ceil(json.totalElements / size) : undefined) ??
    Math.max(1, Math.ceil(rows.length / size), page);
  const hasNext =
    json.last === false ||
    json.hasNext === true ||
    json.next === true ||
    (rows.length === size && rows.length > 0);

  return {
    items: toTrafficItems(rows),
    totalPages: Math.max(1, totalPages, page + (hasNext ? 1 : 0)),
    hasNext,
  };
}

export async function getAIResult(flowId: number): Promise<AIResult | null> {
  const json: any = await request(`/api/flows/${flowId}/ai-results`);
  if (!json || json.length === 0) return null;

  const result = json[0];
  return {
    risk: result.riskScore > 60 ? "위험" : "보통",
    detect: result.attackType,
    percent: `${(result.confidence * 100).toFixed(1)}%`,
  };
}
