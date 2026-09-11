import type { BookingStats, SalesRowDTO } from "./performance-types";

const ACCENT = "#4A4DE7";
const PEACH = "#D88455";
const INK = "#3E4154";
const AGE_LABELS = ["10대","20/30대","40대","50대","60대 이상"];

type Props = { row: SalesRowDTO; index: number; total: number; onStep: (delta: 1 | -1) => void; onTo: (i: number) => void };

export function SalesDetail({ row, index, total, onStep, onTo }: Props) {
  return (
    <div className="sales-detail-wrap">
      <section className="sales-detail-card mv-swipe" role="region" aria-label={`${row.displayName} 판매 상세`} data-is-exhibition={row.isExhibition ? "1" : "0"} data-picked-id={row.key}>
        <header className="sales-detail-head">
          <div className="sales-detail-title"><span className="sales-detail-bullet" /> <strong>{row.displayName}</strong><span className="sales-detail-dday">{row.ddayLabel}</span></div>
          <div className="sales-detail-overview">{row.metaLine}</div>
        </header>
        {row.noData ? <div className="sales-detail-empty">판매·관람 데이터가 아직 집계되지 않았습니다.</div> : row.isExhibition ? <ExhibitionBody row={row} /> : <PerformanceBody row={row} />}
      </section>
      <PageControl index={index} total={total} onStep={onStep} onTo={onTo} />
    </div>
  );
}

function PageControl({ index, total, onStep, onTo }: Omit<Props, "row">) {
  return <div className="sales-detail-nav" aria-label="상세 카드 이동">
    <button type="button" className="sales-detail-nav-btn" aria-label="이전 프로그램" onClick={() => onStep(-1)}>‹</button>
    <div className="sales-detail-dots" role="tablist">{Array.from({ length: total }).map((_, i) => <button key={i} type="button" className={`sales-detail-dot${i === index ? " on" : ""}`} role="tab" aria-selected={i === index} aria-label={`${i + 1}번째 카드`} onClick={() => onTo(i)} />)}</div>
    <button type="button" className="sales-detail-nav-btn" aria-label="다음 프로그램" onClick={() => onStep(1)}>›</button>
  </div>;
}

function PerformanceBody({ row }: { row: SalesRowDTO }) {
  const sold = row.sold ?? 0, total = row.totalSlots ?? 0, occupancy = row.occupancy ?? 0, target = row.targetOccupancy ?? 0, gap = row.gapPct ?? 0;
  return <>
    <SparkChart sold={sold} vals={row.sparkVals} dates={row.sparkDates} fc14={forecastSeatsFromOcc(row, 14)} />
    <KpiRow label="점유율" value={`${occupancy.toFixed(1)}%`} delta={`${gap >= 0 ? "+" : ""}${gap.toFixed(1)}%p`} sub={`(${sold.toLocaleString("ko-KR")} / ${total.toLocaleString("ko-KR")})`} target={`목표 ${target}% ±${Math.abs(gap).toFixed(1)}%p`} />
    <Progress value={occupancy} />
    <AiForecast row={row} current={sold} unit="석" />
    {row.booking && <BookingSection booking={row.booking} />}
  </>;
}

function ExhibitionBody({ row }: { row: SalesRowDTO }) {
  const current = row.sold ?? 0, occupancy = row.occupancy ?? 0;
  return <>
    <SparkChart sold={current} vals={row.sparkVals} dates={row.sparkDates} fc14={forecastSeatsFromOcc(row, 14)} exhibition />
    <KpiRow label="점유율" value={`${occupancy.toFixed(1)}%`} delta="±0.0%p" sub="(누계인원)" target={row.targetAttendance ? `목표 ${row.targetAttendance.toLocaleString("ko-KR")}명` : "목표 —"} />
    <Progress value={occupancy} />
    <AiForecast row={row} current={current} unit="명" />
  </>;
}

function KpiRow({ label, value, delta, sub, target }: { label: string; value: string; delta: string; sub: string; target: string }) {
  return <div className="sales-kpi-row"><div><span className="sales-kpi-label">{label}</span><strong className="sales-kpi-value">{value}</strong><span className="sales-kpi-delta">{delta}</span><span className="sales-kpi-sub">{sub}</span></div><span className="sales-kpi-target">{target}</span></div>;
}

function Progress({ value }: { value: number }) { const safe = Math.max(0, Math.min(100, value)); return <div className="sales-progress" role="progressbar" aria-label="현재 점유율" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safe}><i style={{ width: `${safe}%` }} /></div>; }

function AiForecast({ row, current, unit }: { row: SalesRowDTO; current: number; unit: "석" | "명" }) {
  const fc7 = forecastSeatsFromOcc(row, 7), fc14 = forecastSeatsFromOcc(row, 14);
  return <div className="sales-ai"><b><span aria-hidden="true">⚡</span> AI 예상</b> {fc7 == null || fc14 == null ? "예측 생성 중" : `이 추세면, 7일 뒤 예상 누적 ${fc7.toLocaleString("ko-KR")}${unit} (+${(fc7 - current).toLocaleString("ko-KR")}), 2주 뒤 예상 누적 ${fc14.toLocaleString("ko-KR")}${unit} (+${(fc14 - current).toLocaleString("ko-KR")})`}</div>;
}

function BookingSection({ booking }: { booking: BookingStats }) {
  const totalAge = AGE_LABELS.reduce((n, key) => n + (booking.ages[key] || 0), 0);
  const ages = AGE_LABELS.map((label) => ({ label, value: totalAge ? ((booking.ages[label] || 0) / totalAge) * 100 : 0 }));
  return <section className="booking-section"><h3><span className="sales-detail-bullet" /> 예매자 정보</h3><div className="booking-grid">
    <BookingBox label="예매 정보"><div className="booking-numbers"><Metric n={booking.count} unit="건" /><Metric n={booking.tickets} unit="매" /><Metric n={booking.count ? booking.tickets / booking.count : 0} unit="매/인" peach decimals /></div></BookingBox>
    <BookingBox label="연령대"><div className="age-list">{ages.map((age) => <div className="age-row" key={age.label}><span>{age.label}</span><i><b style={{ width: `${age.value}%` }} /></i><strong>{age.value.toFixed(1)}%</strong></div>)}</div></BookingBox>
    <BookingBox label="거주지"><RankedChart items={booking.residences} accent={ACCENT} /></BookingBox>
    <BookingBox label="예매 경로"><RankedChart items={booking.channels} accent={PEACH} /></BookingBox>
  </div><div className="booking-top3">함께 예매한 공연 <b>TOP3</b> · {booking.topPrograms.length ? booking.topPrograms.map((item, i) => <span key={item.label}><em>{i + 1}.</em> {item.label} {item.value}명{i < booking.topPrograms.length - 1 ? " · " : ""}</span>) : "데이터 없음"}</div></section>;
}

function Metric({ n, unit, peach, decimals }: { n: number; unit: string; peach?: boolean; decimals?: boolean }) { return <div className={`booking-metric${peach ? " peach" : ""}`}><strong>{decimals ? n.toFixed(2) : n.toLocaleString("ko-KR")}</strong><span>{unit}</span></div>; }
function BookingBox({ label, children }: { label: string; children: React.ReactNode }) { return <div className="booking-box"><div className="booking-tab">{label}</div><div className="booking-box-body">{children}</div></div>; }

function RankedChart({ items, accent }: { items: Array<{ label: string; value: number }>; accent: string }) {
  const top = items.slice(0, 5), sum = top.reduce((n, x) => n + x.value, 0) || 1;
  const colors = accent === PEACH ? [PEACH, "#E5A883", "#8A8DA0", "#C9CBD4"] : [ACCENT, "#7B7DEE", "rgba(62,65,84,.55)", "rgba(62,65,84,.40)", "rgba(62,65,84,.25)"];
  return <div className="ranked-chart"><div className="donut" style={{ background: `conic-gradient(${top.map((_, i) => `${colors[i] || colors[colors.length - 1]} ${(top.slice(0, i).reduce((n, y) => n + y.value, 0) / sum) * 360}deg ${((top.slice(0, i + 1).reduce((n, y) => n + y.value, 0) / sum) * 360)}deg`).join(", ")})` }} /><div className="rank-legend">{top.map((x, i) => <div key={x.label} className={i < 2 ? "rank-top" : ""} style={i < 2 ? { color: colors[i] } : undefined}><span>{x.label}</span><b>{((x.value / sum) * 100).toFixed(1)}%</b></div>)}</div></div>;
}

function forecastSeatsFromOcc(row: SalesRowDTO, days: number): number | null {
  const vals = row.sparkVals || [];
  if (vals.length < 2 || row.fcRate == null) return null;
  const increment = row.isExhibition ? row.fcRate * days : (row.fcRate / 100) * (row.totalOpen || row.totalSlots || 0) * days;
  return Math.round(vals[vals.length - 1]! + increment);
}

function SparkChart({ sold, vals, dates = [], fc14, exhibition }: { sold: number; vals: number[]; dates?: string[]; fc14: number | null; exhibition?: boolean }) {
  if (vals.length < 2) return null;
  const W = 844, H = 205, pad = { l: 16, r: 16, t: 34, b: 32 }, ys = vals.concat(fc14 == null ? [] : [fc14]), min = Math.min(...ys), max = Math.max(...ys), range = Math.max(1, max - min), step = (W - pad.l - pad.r) / (ys.length - 1);
  const pts = ys.map((v, i) => ({ x: pad.l + i * step, y: pad.t + (H - pad.t - pad.b) - ((v - min) / range) * (H - pad.t - pad.b) })), today = vals.length - 1, real = pts.slice(0, vals.length);
  const path = real.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const forecast = fc14 == null ? "" : `M ${pts[today]!.x} ${pts[today]!.y} L ${pts[pts.length - 1]!.x} ${pts[pts.length - 1]!.y}`;
  const dateLabel = (v: string | undefined, fallback: number) => v ? `${Number(v.slice(5, 7))}.${Number(v.slice(8, 10))}` : `+${fallback}`;
  return <div className="sales-spark"><svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" aria-label={`${exhibition ? "누계 관객" : "누적 좌석"} 추이`}><path d={`${path} L ${real[real.length - 1]!.x} ${H - pad.b} L ${real[0]!.x} ${H - pad.b} Z`} fill="rgba(74,77,231,.08)" /><path d={path} fill="none" stroke={ACCENT} strokeWidth="2" />{forecast && <path d={forecast} fill="none" stroke={PEACH} strokeWidth="2" strokeDasharray="5 4" />}{real.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === today ? 5 : 3.5} fill={i === today ? "#D64242" : ACCENT} stroke="#fff" strokeWidth="1.5" />)}{[0, Math.floor(today / 2), today].filter((v, i, a) => a.indexOf(v) === i).map((i) => <text key={`d${i}`} x={real[i]!.x} y={H - 9} textAnchor="middle" fontSize="12" fill={i === today ? "#D64242" : INK}>{dateLabel(dates[i], vals[i]!)}</text>)}<text x={real[today]!.x} y={Math.max(15, real[today]!.y - 22)} textAnchor="middle" fontSize="13.1" fontWeight="700" fill="#D64242">오늘 {sold.toLocaleString("ko-KR")}</text>{fc14 != null && <text x={pts[pts.length - 1]!.x} y={H - 9} textAnchor="middle" fontSize="12" fill={PEACH}>종료 +{fc14 - sold}</text>}</svg></div>;
}
