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

export type AttackTypePeriod = "all" | "week";

export interface TimelineItem {
  t: string;
  v: number;
}

export interface AlertItem {
  level: string;
  ip: string;
  flowId: string;
  srcIp: string;
  srcPort: string | number;
  destIp: string;
  destPort: string | number;
  prediction: string;
  action: string;
  riskScore: string | number;
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
  attackType: string;
  startTime: string;
  endTime: string;
}

export interface TrafficDetail {
  flowId: string;
  srcIp: string;
  dstIp: string;
  srcPort: string | number;
  dstPort: string | number;
  protocol: string;
  startTime: string;
  endTime: string;
  tcpFlags: string;
  tcpFlagCounts: TrafficTcpFlagCounts;
  aiResult: TrafficAiResult | null;
}

export interface TrafficTcpFlagCounts {
  syn: number;
  ack: number;
  fin: number;
  rst: number;
  psh: number;
  urg: number;
}

export interface TrafficAiResult {
  id?: string | number;
  modelName: string;
  prediction: string;
  attackType: string;
  confidence: number | string;
  riskScore: number | string;
  action: string;
  actionDetail: string;
  analyzedAt: string;
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

interface AiResultRow {
  prediction?: string;
  attackType?: string;
  riskScore?: string | number;
  action?: string;
  actionDetail?: string;
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

function getTcpFlagCounts(row: any): TrafficTcpFlagCounts {
  return {
    syn: getCount(row, "synCount"),
    ack: getCount(row, "ackCount"),
    fin: getCount(row, "finCount"),
    rst: getCount(row, "rstCount"),
    psh: getCount(row, "pshCount"),
    urg: getCount(row, "urgCount"),
  };
}

function formatTcpFlags(row: any): string {
  const counts = getTcpFlagCounts(row);
  const flagCounts: Array<[string, number]> = [
    ["SYN", counts.syn],
    ["ACK", counts.ack],
    ["FIN", counts.fin],
    ["RST", counts.rst],
    ["PSH", counts.psh],
    ["URG", counts.urg],
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

function getPrediction(row: any): string {
  return String(
    row.prediction ??
      row.pridiction ??
      row.attackType ??
      row.result ??
      row.aiResult ??
      "-"
  );
}

function getFirstAiResult(row: any): AiResultRow | null {
  const direct = row.aiResult ?? row.ai_result ?? row.resultDetail;
  if (direct && typeof direct === "object") return direct;

  const list = row.aiResults ?? row.ai_results ?? row.results;
  if (Array.isArray(list) && list.length > 0) return list[0];

  return null;
}

function isNormalPrediction(value: unknown): boolean {
  const prediction = String(value ?? "").trim().toLowerCase();

  return ["normal", "benign", "safe", "?뺤긽", "?덉쟾"].some((normalValue) =>
    prediction.includes(normalValue)
  );
}

function isAttackTraffic(row: any): boolean {
  const values = [
    row.prediction,
    row.pridiction,
    row.result,
    row.aiResult,
    row.attackType,
    row.level,
    row.risk,
    row.status,
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim().toLowerCase());

  if (
    values.some((value) =>
      ["normal", "benign", "safe", "정상", "안전"].some((normalValue) =>
        value.includes(normalValue)
      )
    )
  ) {
    return false;
  }

  return getFlowLevel(row) !== "정상";
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

export async function fetchAttackTypes(
  period: AttackTypePeriod = "all"
): Promise<ChartItem[]> {
  const params = new URLSearchParams({ period });
  const res = await fetch(`${API_BASE}/api/dashboard/attack-types?${params}`);

  if (!res.ok) {
    throw new Error(`Attack types API Error: ${res.status}`);
  }

  const json: any[] = await res.json();

  return json.map((item) => ({
    name: item.attackType ?? item.type ?? "-",
    value: Number(item.count ?? 0),
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

  const rowsWithAiResults = await Promise.all(
    rows.map(async (item) => {
      const flowId = item.flowId ?? item.id;
      const embeddedAiResult = getFirstAiResult(item);

      if (embeddedAiResult || flowId === undefined || flowId === null) {
        return { item, aiResult: embeddedAiResult };
      }

      const aiResults: any[] | null = await request(
        `/api/flows/${flowId}/ai-results`
      );

      return {
        item,
        aiResult:
          Array.isArray(aiResults) && aiResults.length > 0 ? aiResults[0] : null,
      };
    })
  );

  return rowsWithAiResults.filter(({ item, aiResult }) => {
    if (aiResult) {
      return !isNormalPrediction(
        aiResult.prediction ?? aiResult.attackType ?? item.prediction
      );
    }

    return isAttackTraffic(item);
  }).map(({ item, aiResult }) => {
    const srcIp = item.srcIp ?? item.sourceIp ?? "-";
    const srcPort = item.srcPort ?? item.sourcePort ?? item.sport ?? "-";
    const destIp = item.destIp ?? item.dstIp ?? item.destinationIp ?? "-";
    const destPort =
      item.destPort ?? item.destport ?? item.dstPort ?? item.port ?? "-";
    const prediction = aiResult ? getPrediction(aiResult) : getPrediction(item);

    return {
      level: getFlowLevel(item),
      ip: `${srcIp}:${srcPort} -> ${destIp}:${destPort} · ${formatTcpFlags(
        item
      )}`,
      flowId: String(item.flowId ?? item.id ?? "-"),
      srcIp,
      srcPort,
      destIp,
      destPort,
      prediction,
      action:
        aiResult?.action ??
        aiResult?.actionDetail ??
        item.action ??
        item.recommendedAction ??
        item.responseAction ??
        "-",
      riskScore:
        aiResult?.riskScore ??
        item.riskScore ??
        item.risk_score ??
        item.score ??
        "-",
    };
  });
}

function toTrafficItems(rows: any[]): TrafficItem[] {
  return rows.map((row: any) => {
    const aiResult = getFirstAiResult(row);
    const prediction = aiResult ? getPrediction(aiResult) : getPrediction(row);

    return {
      flowId: String(row.flowId ?? row.id ?? ""),
      time: row.startTime ? row.startTime.split("T")[1] ?? row.startTime : "-",
      srcIp: row.srcIp ?? row.sourceIp ?? "-",
      dstIp: row.destIp ?? row.dstIp ?? row.destinationIp ?? "-",
      port: row.destPort ?? row.destport ?? row.dstPort ?? row.port ?? 0,
      protocol: row.protocol ?? "-",
      flag: formatTcpFlags(row),
      result: prediction === "-" ? "분석 완료" : prediction,
      attackType:
        aiResult?.attackType ?? row.attackType ?? row.type ?? prediction,
      startTime: row.startTime ?? "-",
      endTime: row.endTime ?? "-",
    };
  });
}

function toTrafficAiResult(row: any): TrafficAiResult | null {
  if (!row || typeof row !== "object") return null;

  return {
    id: row.id,
    modelName: row.modelName ?? "-",
    prediction: row.prediction ?? "-",
    attackType: row.attackType ?? "-",
    confidence: row.confidence ?? "-",
    riskScore: row.riskScore ?? "-",
    action: row.action ?? "-",
    actionDetail: row.actionDetail ?? "-",
    analyzedAt: row.analyzedAt ?? "-",
  };
}

function toTrafficDetail(row: any, aiResult?: any): TrafficDetail {
  const embeddedAiResult = getFirstAiResult(row);

  return {
    flowId: String(row.flowId ?? row.id ?? ""),
    srcIp: row.srcIp ?? row.sourceIp ?? "-",
    dstIp: row.destIp ?? row.dstIp ?? row.destinationIp ?? "-",
    srcPort: row.srcPort ?? row.sourcePort ?? row.sport ?? "-",
    dstPort: row.destPort ?? row.destport ?? row.dstPort ?? row.port ?? "-",
    protocol: row.protocol ?? "-",
    startTime: row.startTime ?? "-",
    endTime: row.endTime ?? "-",
    tcpFlags: formatTcpFlags(row),
    tcpFlagCounts: getTcpFlagCounts(row),
    aiResult: toTrafficAiResult(aiResult ?? embeddedAiResult),
  };
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

export async function fetchTrafficDetail(
  flowId: string | number
): Promise<TrafficDetail | null> {
  const detail: any = await request(`/api/flows/${flowId}`);
  if (!detail) return null;

  if (detail.aiResult || detail.ai_result || detail.resultDetail) {
    return toTrafficDetail(detail);
  }

  const aiResults: any[] | null = await request(
    `/api/flows/${flowId}/ai-results`
  );

  return toTrafficDetail(
    detail,
    Array.isArray(aiResults) && aiResults.length > 0 ? aiResults[0] : null
  );
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

export async function fetchRealtimeTimeline(): Promise<TimelineItem[]> {
  return fetchTimeline();
}
