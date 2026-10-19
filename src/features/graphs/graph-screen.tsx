"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BottomNavigation } from "@/components/common/bottom-navigation";
import {
  filterGraphPoints,
  loadWorkoutGraphData,
} from "@/services/workout-graph-service";
import type {
  ExerciseGraphPoint,
  GraphMetric,
  GraphPeriod,
  WorkoutGraphData,
} from "@/services/workout-graph-service";

const PERIODS: { value: GraphPeriod; label: string }[] = [
  { value: "all", label: "全期間" },
  { value: "year", label: "1年" },
  { value: "sixMonths", label: "6か月" },
  { value: "month", label: "1か月" },
  { value: "week", label: "1週間" },
];

const METRICS: { value: GraphMetric; label: string }[] = [
  { value: "maxWeight", label: "最大重量" },
  { value: "estimatedOneRepMax", label: "推定1RM" },
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ExerciseGraphPoint }>;
  metric: GraphMetric;
}

function formatWeight(value: number | null): string {
  return value === null ? "—" : `${Number(value.toFixed(1))} kg`;
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatLongDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function GraphTooltip({ active, payload, metric }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="graph-tooltip">
      <p className="graph-tooltip-date">{formatLongDate(point.date)}</p>
      <div className="graph-tooltip-metric">
        <span>{metric === "maxWeight" ? "最大重量" : "推定1RM"}</span>
        <strong>
          {formatWeight(
            metric === "maxWeight" ? point.value : point.estimatedOneRepMax,
          )}
        </strong>
      </div>
      <div className="graph-tooltip-sets">
        <span className="graph-tooltip-caption">全セット</span>
        {point.sets.map((set, index) => (
          <div className="graph-tooltip-set" key={set.id}>
            <span>セット {index + 1}</span>
            <span>{formatWeight(set.externalWeight)} × {set.reps}回</span>
            <small>
              実効負荷 {formatWeight(set.effectiveWeight)}
              {" · "}推定1RM {formatWeight(set.estimatedOneRepMax)}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GraphScreen() {
  const [data, setData] = useState<WorkoutGraphData>({
    exercises: [],
    pointsByExercise: {},
  });
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [metric, setMetric] = useState<GraphMetric>("maxWeight");
  const [period, setPeriod] = useState<GraphPeriod>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    loadWorkoutGraphData()
      .then((graphData) => {
        if (!active) return;
        setData(graphData);
        setSelectedExerciseId((current) =>
          graphData.exercises.some((exercise) => exercise.id === current)
            ? current
            : graphData.exercises[0]?.id ?? "",
        );
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "グラフデータを読み込めませんでした。");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedExercise = data.exercises.find(
    (exercise) => exercise.id === selectedExerciseId,
  );
  const points = useMemo(
    () =>
      filterGraphPoints(
        data.pointsByExercise[selectedExerciseId] ?? [],
        period,
      ).map((point) => ({
        ...point,
        value:
          metric === "maxWeight"
            ? point.value
            : point.estimatedOneRepMax,
      })),
    [data.pointsByExercise, metric, period, selectedExerciseId],
  );
  const hasPlottablePoints = points.some((point) => Number.isFinite(point.value));
  const peakValue = points.reduce<number | null>(
    (peak, point) =>
      point.value !== null && Number.isFinite(point.value) && (peak === null || point.value > peak)
        ? point.value
        : peak,
    null,
  );

  return (
    <main className="graph-page">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">I</div>
        <div>
          <p className="eyebrow">TRAINING JOURNAL</p>
          <h1>IronLog</h1>
        </div>
        <span className="header-status"><span /> LOCAL</span>
      </header>

      <section className="graph-heading">
        <div>
          <p className="eyebrow">PERFORMANCE</p>
          <h2>トレーニンググラフ</h2>
        </div>
      </section>

      {error && <p className="feedback feedback-error" role="alert">{error}</p>}

      <section className="graph-controls panel">
        <label className="graph-control-label" htmlFor="graph-exercise">
          <span>種目</span>
          <select
            id="graph-exercise"
            value={selectedExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
            disabled={data.exercises.length === 0}
          >
            {data.exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.category} · {exercise.name}
              </option>
            ))}
          </select>
        </label>

        <div className="graph-control-label">
          <span>グラフ</span>
          <div className="graph-segmented" role="group" aria-label="グラフの種類">
            {METRICS.map((option) => (
              <button
                className={metric === option.value ? "is-selected" : ""}
                type="button"
                key={option.value}
                aria-pressed={metric === option.value}
                onClick={() => setMetric(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="graph-panel panel">
        <div className="graph-panel-heading">
          <div>
            <p className="eyebrow">{selectedExercise?.category ?? "PROGRESS"}</p>
            <h3>{selectedExercise?.name ?? "種目を選択"}</h3>
            {selectedExercise?.weightUnit === "per-hand" && (
              <span className="helper-text">片手あたり</span>
            )}
          </div>
          {selectedExercise && selectedExercise.bodyweightRatio > 0 && (
            <span className="bodyweight-badge">実効負荷</span>
          )}
        </div>

        <div className="graph-legend">
          <span className="graph-legend-dot" />
          <span>{metric === "maxWeight" ? "最大重量" : "推定1RM"}</span>
          <strong>{formatWeight(peakValue)}</strong>
        </div>

        {isLoading ? (
          <div className="graph-empty">グラフを読み込んでいます…</div>
        ) : data.exercises.length === 0 ? (
          <div className="graph-empty">
            <strong>グラフに表示できる記録がありません</strong>
            <span>記録画面でトレーニングを保存してください。</span>
          </div>
        ) : !hasPlottablePoints ? (
          <div className="graph-empty">
            <strong>この期間に表示できるデータがありません</strong>
            <span>
              {selectedExercise?.bodyweightRatio
                ? "自重種目は、実効負荷の計算に体重記録が必要です。"
                : "期間を変更するか、別のグラフを選択してください。"}
            </span>
          </div>
        ) : (
          <div className="graph-chart" role="img" aria-label={`${selectedExercise?.name}の${metric === "maxWeight" ? "最大重量" : "推定1RM"}グラフ`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 14, right: 14, left: -17, bottom: 2 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#e9eee7"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fill: "#87948a", fontSize: 10 }}
                  axisLine={{ stroke: "#dce5da" }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, "auto"]}
                  tick={{ fill: "#87948a", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => `${value}`}
                  width={39}
                />
                <ReferenceLine y={0} stroke="#dce5da" />
                <Tooltip
                  trigger="click"
                  content={<GraphTooltip metric={metric} />}
                  cursor={{ stroke: "#9bb09a", strokeDasharray: "4 4" }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={metric === "maxWeight" ? "最大重量" : "推定1RM"}
                  stroke="#356a4f"
                  strokeWidth={2.5}
                  connectNulls={false}
                  activeDot={{ r: 10, strokeWidth: 3, stroke: "#e5f0d9" }}
                  dot={{
                    r: 6,
                    fill: "#356a4f",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="graph-tap-hint">データポイントをタップするとセット詳細を表示</p>
      </section>

      <section className="period-panel">
        <div className="period-heading">
          <span className="eyebrow">PERIOD</span>
          <span>{points.length} データ</span>
        </div>
        <div className="period-options" role="group" aria-label="表示期間">
          {PERIODS.map((option) => (
            <button
              className={period === option.value ? "is-selected" : ""}
              type="button"
              key={option.value}
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <BottomNavigation active="graph" />
    </main>
  );
}
