// Small, dependency-free SVG charts for the dashboard: a column chart, a line chart and a
// meter. Single series each, so no legend (the section heading names the series). Every
// chart has hover/focus tooltips and a table view.

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./charts.module.css";

export interface Point {
  /** Stable key, e.g. "2026-10-10". */
  key: string;
  /** Axis/tooltip label, e.g. "10 Oct". */
  label: string;
  value: number | null;
}

const PLOT_HEIGHT = 160;
const AXIS_BAND = 24;
const TOP = 20;
const LEFT = 44;
const RIGHT = 16;

const formatNumber = (value: number) => value.toLocaleString("en-GB");
const formatTick = (value: number) =>
  value >= 1000 ? `${(value / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}K` : String(value);

/** Up to five round ticks from 0 to just above max. */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let tick = 0; tick < max + step; tick += step) ticks.push(Math.round(tick * 1000) / 1000);
  return ticks;
}

function useWidth(fallback = 600) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(Math.max(240, element.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Shows every nth x label so they never collide. */
const labelEvery = (count: number, plotWidth: number) => Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotWidth / 56))));

function ChartFrame({
  points,
  valueHeading,
  children,
}: {
  points: Point[];
  valueHeading: string;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div>
      {children}
      <div className={styles.tableToggle}>
        <s-button variant="tertiary" onClick={() => setShowTable((shown) => !shown)}>
          {showTable ? "Hide table" : "Show as table"}
        </s-button>
      </div>
      {showTable && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">{valueHeading}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.key}>
                <td>{point.label}</td>
                <td>{point.value === null ? "–" : formatNumber(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function YAxis({ ticks, scale, width }: { ticks: number[]; scale: (value: number) => number; width: number }) {
  return (
    <g>
      {ticks.map((tick) => (
        <g key={tick}>
          <line className={styles.gridLine} x1={LEFT} x2={width - RIGHT} y1={scale(tick)} y2={scale(tick)} />
          <text className={styles.axisText} x={LEFT - 8} y={scale(tick)} dy="0.32em" textAnchor="end">
            {formatTick(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}

function Tooltip({ x, y, value, label }: { x: number; y: number; value: string; label: string }) {
  return (
    <div className={styles.tooltip} style={{ left: x, top: y }} role="status">
      <span className={styles.tooltipValue}>{value}</span>
      <span className={styles.tooltipLabel}>{label}</span>
    </div>
  );
}

/** One column per day. Rounded 4px tops, square at the baseline, at most 24px wide. */
export function ColumnChart({
  points,
  valueHeading,
  describe,
  emptyMessage,
}: {
  points: Point[];
  valueHeading: string;
  /** Tooltip/aria text for a value, e.g. "12 products moved". */
  describe: (value: number) => string;
  emptyMessage: string;
}) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((point) => point.value ?? 0);
  const max = Math.max(0, ...values);

  if (max === 0) {
    return (
      <div className={styles.viz} ref={ref}>
        <p className={styles.empty}>{emptyMessage}</p>
      </div>
    );
  }

  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const scale = (value: number) => TOP + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;
  const plotWidth = width - LEFT - RIGHT;
  const band = plotWidth / points.length;
  const barWidth = Math.max(2, Math.min(24, band - 2));
  const every = labelEvery(points.length, plotWidth);
  const peak = values.indexOf(max);

  return (
    <ChartFrame points={points} valueHeading={valueHeading}>
      <div className={styles.viz} ref={ref}>
        <svg className={styles.svg} height={TOP + PLOT_HEIGHT + AXIS_BAND} role="img" aria-label={`${valueHeading} per day`}>
          <YAxis ticks={ticks} scale={scale} width={width} />
          {points.map((point, index) => {
            const value = point.value ?? 0;
            const cx = LEFT + band * index + band / 2;
            const x = cx - barWidth / 2;
            const y = scale(value);
            const height = TOP + PLOT_HEIGHT - y;
            const radius = Math.min(4, height, barWidth / 2);
            return (
              <g key={point.key}>
                {value > 0 && (
                  <path
                    className={`${styles.bar} ${active === index ? styles.barActive : ""}`}
                    d={`M${x},${y + height} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + barWidth - radius} Q${x + barWidth},${y} ${x + barWidth},${y + radius} V${y + height} Z`}
                  />
                )}
                {index === peak && (
                  <text className={styles.valueText} x={cx} y={y - 6} textAnchor="middle">
                    {formatNumber(value)}
                  </text>
                )}
                {index % every === (points.length - 1) % every && (
                  <text className={styles.axisText} x={cx} y={TOP + PLOT_HEIGHT + 16} textAnchor="middle">
                    {point.label}
                  </text>
                )}
                <rect
                  className={styles.hit}
                  x={LEFT + band * index}
                  y={TOP}
                  width={band}
                  height={PLOT_HEIGHT}
                  tabIndex={0}
                  aria-label={`${point.label}: ${describe(value)}`}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <Tooltip
            x={LEFT + band * active + band / 2}
            y={scale(values[active])}
            value={describe(values[active])}
            label={points[active].label}
          />
        )}
      </div>
    </ChartFrame>
  );
}

/** A line with a soft area wash, an end dot labelled with the latest value, and a crosshair. */
export function LineChart({
  points,
  valueHeading,
  describe,
  emptyMessage,
}: {
  points: Point[];
  valueHeading: string;
  describe: (value: number) => string;
  emptyMessage: string;
}) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const known = points.map((point, index) => ({ ...point, index })).filter((point) => point.value !== null);

  if (known.length === 0) {
    return (
      <div className={styles.viz} ref={ref}>
        <p className={styles.empty}>{emptyMessage}</p>
      </div>
    );
  }

  const max = Math.max(...known.map((point) => point.value!));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const scale = (value: number) => TOP + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;
  const plotWidth = width - LEFT - RIGHT;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const xAt = (index: number) => (points.length > 1 ? LEFT + step * index : LEFT + plotWidth / 2);
  const every = labelEvery(points.length, plotWidth);

  // Gaps (days without data) break the line rather than inventing values.
  const segments: { index: number; value: number }[][] = [];
  points.forEach((point, index) => {
    if (point.value === null) return;
    const previous = segments[segments.length - 1];
    if (previous && previous[previous.length - 1].index === index - 1) previous.push({ index, value: point.value });
    else segments.push([{ index, value: point.value }]);
  });
  const baseline = TOP + PLOT_HEIGHT;
  const last = known[known.length - 1];

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left - LEFT;
    const index = Math.round(step ? x / step : 0);
    const clamped = Math.min(points.length - 1, Math.max(0, index));
    // Snap to the closest day that has data.
    return known.reduce((best, point) => (Math.abs(point.index - clamped) < Math.abs(best.index - clamped) ? point : best)).index;
  };

  return (
    <ChartFrame points={points} valueHeading={valueHeading}>
      <div className={styles.viz} ref={ref}>
        <svg
          className={styles.svg}
          height={TOP + PLOT_HEIGHT + AXIS_BAND}
          role="img"
          aria-label={`${valueHeading} per day`}
          onPointerMove={(event) => setActive(nearest(event.clientX, event.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(null)}
        >
          <YAxis ticks={ticks} scale={scale} width={width} />
          {segments.map((segment) => {
            const path = segment.map((p, i) => `${i ? "L" : "M"}${xAt(p.index)},${scale(p.value)}`).join(" ");
            const first = segment[0];
            const end = segment[segment.length - 1];
            return (
              <g key={first.index}>
                <path className={styles.area} d={`${path} L${xAt(end.index)},${baseline} L${xAt(first.index)},${baseline} Z`} />
                <path className={styles.line} d={path} />
              </g>
            );
          })}
          {points.map(
            (point, index) =>
              index % every === (points.length - 1) % every && (
                <text key={point.key} className={styles.axisText} x={xAt(index)} y={baseline + 16} textAnchor="middle">
                  {point.label}
                </text>
              ),
          )}
          {active !== null && points[active].value !== null && (
            <line className={styles.crosshair} x1={xAt(active)} x2={xAt(active)} y1={TOP} y2={baseline} />
          )}
          <circle className={styles.dot} cx={xAt(last.index)} cy={scale(last.value!)} r={4} />
          <text className={styles.valueText} x={xAt(last.index)} y={scale(last.value!) - 10} textAnchor="end">
            {formatNumber(last.value!)}
          </text>
          {active !== null && active !== last.index && points[active].value !== null && (
            <circle className={styles.dot} cx={xAt(active)} cy={scale(points[active].value!)} r={4} />
          )}
          {known.map((point) => (
            <rect
              key={point.key}
              className={styles.hit}
              x={xAt(point.index) - Math.max(12, step / 2)}
              y={TOP}
              width={Math.max(24, step)}
              height={PLOT_HEIGHT}
              tabIndex={0}
              aria-label={`${point.label}: ${describe(point.value!)}`}
              onFocus={() => setActive(point.index)}
              onBlur={() => setActive(null)}
            />
          ))}
        </svg>
        {active !== null && points[active].value !== null && (
          <Tooltip x={xAt(active)} y={scale(points[active].value!)} value={describe(points[active].value!)} label={points[active].label} />
        )}
      </div>
    </ChartFrame>
  );
}

/** Progress track: fill and track are steps of the same blue. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={styles.viz}>
      <div
        className={styles.meterTrack}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className={styles.meterFill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
