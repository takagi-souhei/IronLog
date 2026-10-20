"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomNavigation } from "@/components/common/bottom-navigation";
import { ProgressChart, type ProgressChartPoint } from "@/components/graph/progress-chart";
import { filterGraphPoints, type GraphMetric, type GraphPeriod } from "@/services/workout-graph-service";
import {
  loadWorkoutReviewData,
  type WorkoutReviewData,
} from "@/services/workout-review-service";
import type { WorkoutDayHistory, WorkoutExerciseHistoryItem } from "@/services/workout-history-service";

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

const BODY_WEIGHT_TAB = "bodyweight";

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}

function formatWeight(weight: number | null): string {
  if (weight === null) return "—";
  return `${Number(weight.toFixed(1))} kg`;
}

function WorkoutExerciseRecord({
  exercise,
}: {
  exercise: WorkoutExerciseHistoryItem;
}) {
  return (
    <article className="review-exercise-record">
      <header>
        <div>
          <span className="category-label">{exercise.category}</span>
          <h4>{exercise.name}</h4>
          {exercise.weightUnit === "per-hand" && (
            <span className="helper-text">片手あたり</span>
          )}
        </div>
        {exercise.bodyweightRatio > 0 && (
          <span className="bodyweight-badge">自重換算</span>
        )}
      </header>
      <p className="review-set-values">
        {exercise.sets.length === 0
          ? "セット記録なし"
          : exercise.sets
              .map(
                (set) =>
                  `${formatWeight(set.effectiveWeight ?? set.externalWeight)}×${set.reps}`,
              )
              .join("　")}
      </p>
      <div className="review-one-rep-max">
        <span>推定1RM</span>
        <strong>{formatWeight(exercise.estimatedOneRepMax)}</strong>
      </div>
    </article>
  );
}

function TrainingDayRecord({
  day,
  selectedTab,
}: {
  day: WorkoutDayHistory | undefined;
  selectedTab: string;
}) {
  if (!day) {
    return (
      <p className="review-no-workout">
        この日はトレーニング記録がありません。
      </p>
    );
  }

  if (selectedTab === BODY_WEIGHT_TAB) {
    return (
      <div className="review-record-list">
        {day.exercises.map((exercise) => (
          <WorkoutExerciseRecord key={exercise.id} exercise={exercise} />
        ))}
      </div>
    );
  }

  const exercise = day.exercises.find((item) => item.id === selectedTab);
  if (!exercise) {
    return (
      <p className="review-no-workout">
        このトレーニングでは選択中の種目を記録していません。
      </p>
    );
  }

  return <WorkoutExerciseRecord exercise={exercise} />;
}

export function HistoryScreen() {
  const [data, setData] = useState<WorkoutReviewData>({
    history: [],
    graphData: { exercises: [], pointsByExercise: {} },
    bodyWeightPoints: [],
  });
  const [selectedTab, setSelectedTab] = useState(BODY_WEIGHT_TAB);
  const [selectedDate, setSelectedDate] = useState(localDateString);
  const [metric, setMetric] = useState<GraphMetric>("maxWeight");
  const [period, setPeriod] = useState<GraphPeriod>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    loadWorkoutReviewData()
      .then((reviewData) => {
        if (!active) return;
        setData(reviewData);
        setSelectedDate(
          reviewData.history[0]?.date ??
            reviewData.bodyWeightPoints.at(-1)?.date ??
            localDateString(),
        );
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "履歴を読み込めませんでした。");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const exerciseTabs = data.history[0]?.exercises ?? [];
  const selectedExercise = exerciseTabs.find((exercise) => exercise.id === selectedTab);
  const sourcePoints = useMemo<ProgressChartPoint[]>(
    () =>
      selectedTab === BODY_WEIGHT_TAB
        ? data.bodyWeightPoints
        : (data.graphData.pointsByExercise[selectedTab] ?? []).map((point) => ({
            date: point.date,
            value:
              metric === "maxWeight" ? point.value : point.estimatedOneRepMax,
          })),
    [data.bodyWeightPoints, data.graphData.pointsByExercise, metric, selectedTab],
  );
  const points = useMemo(
    () => filterGraphPoints(sourcePoints, period),
    [period, sourcePoints],
  );
  const hasPlottablePoints = points.some(
    (point) => point.value !== null && Number.isFinite(point.value),
  );
  const summaryValue =
    selectedTab === BODY_WEIGHT_TAB
      ? points.at(-1)?.value ?? null
      : points.reduce<number | null>(
          (peak, point) =>
            point.value !== null &&
            Number.isFinite(point.value) &&
            (peak === null || point.value > peak)
              ? point.value
              : peak,
          null,
        );
  const selectedDay = data.history.find((day) => day.date === selectedDate);
  const selectedBodyWeight = data.bodyWeightPoints.find(
    (point) => point.date === selectedDate,
  );

  function moveTraining(direction: "newer" | "older") {
    const nextDay =
      direction === "newer"
        ? data.history.find((day) => day.date > selectedDate)
        : data.history.find((day) => day.date < selectedDate);
    if (nextDay) setSelectedDate(nextDay.date);
  }

  const hasNewerTraining = data.history.some((day) => day.date > selectedDate);
  const hasOlderTraining = data.history.some((day) => day.date < selectedDate);

  return (
    <main className="history-page review-page">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">I</div>
        <div>
          <p className="eyebrow">TRAINING JOURNAL</p>
          <h1>IronLog</h1>
        </div>
        <span className="header-status"><span /> LOCAL</span>
      </header>

      <section className="history-heading">
        <div>
          <p className="eyebrow">YOUR PROGRESS</p>
          <h2>履歴と推移</h2>
        </div>
        {!isLoading && !error && (
          <span className="count-pill">{data.history.length} 日</span>
        )}
      </section>

      {error && <p className="feedback feedback-error" role="alert">{error}</p>}

      <div className="review-tabs" role="tablist" aria-label="表示する記録">
        <button
          className={`review-tab${selectedTab === BODY_WEIGHT_TAB ? " is-selected" : ""}`}
          id="review-tab-bodyweight"
          type="button"
          role="tab"
          aria-selected={selectedTab === BODY_WEIGHT_TAB}
          onClick={() => setSelectedTab(BODY_WEIGHT_TAB)}
        >
          体重
        </button>
        {exerciseTabs.map((exercise) => (
          <button
            className={`review-tab${selectedTab === exercise.id ? " is-selected" : ""}`}
            id={`review-tab-${exercise.id}`}
            type="button"
            role="tab"
            aria-selected={selectedTab === exercise.id}
            key={exercise.id}
            onClick={() => setSelectedTab(exercise.id)}
          >
            {exercise.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading-card">履歴を読み込んでいます…</div>
      ) : !error ? (
        <>
          <section className="review-graph-panel panel">
            <div className="review-graph-heading">
              <div>
                <p className="eyebrow">
                  {selectedTab === BODY_WEIGHT_TAB
                    ? "BODY WEIGHT"
                    : selectedExercise?.category ?? "PERFORMANCE"}
                </p>
                <h3>
                  {selectedTab === BODY_WEIGHT_TAB
                    ? "体重推移"
                    : selectedExercise?.name ?? "トレーニング推移"}
                </h3>
              </div>
              <strong className="review-graph-summary">
                {selectedTab === BODY_WEIGHT_TAB
                  ? "最新"
                  : metric === "maxWeight"
                    ? "最大"
                    : "推定1RM"}
                {" "}{formatWeight(summaryValue)}
              </strong>
            </div>

            {selectedTab !== BODY_WEIGHT_TAB && (
              <div className="graph-segmented review-metric" role="group" aria-label="グラフの種類">
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
            )}

            {hasPlottablePoints ? (
              <ProgressChart
                points={points}
                selectedDate={selectedDate}
                label={
                  selectedTab === BODY_WEIGHT_TAB
                    ? "体重推移グラフ"
                    : `${selectedExercise?.name ?? "選択中の種目"}の${metric === "maxWeight" ? "最大重量" : "推定1RM"}グラフ`
                }
                onSelectDate={setSelectedDate}
              />
            ) : (
              <div className="review-chart-empty">
                {selectedTab === BODY_WEIGHT_TAB
                  ? "体重記録がありません。記録画面で体重を保存してください。"
                  : "この期間に表示できるトレーニング記録がありません。"}
              </div>
            )}

            <div className="review-period-options" role="group" aria-label="表示期間">
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
            <p className="review-chart-hint">グラフの点を選択すると、その日の記録を表示</p>
          </section>

          <section className="review-training-panel panel" aria-labelledby="review-training-title">
            <header className="review-training-heading">
              <button
                className="review-day-button"
                type="button"
                aria-label="次のトレーニング"
                title="次のトレーニング"
                disabled={!hasNewerTraining}
                onClick={() => moveTraining("newer")}
              >
                ＜
              </button>
              <div>
                <p className="eyebrow">SELECTED TRAINING</p>
                <h3 id="review-training-title">
                  {formatDate(selectedDate)}
                </h3>
              </div>
              <button
                className="review-day-button"
                type="button"
                aria-label="前のトレーニング"
                title="前のトレーニング"
                disabled={!hasOlderTraining}
                onClick={() => moveTraining("older")}
              >
                ＞
              </button>
            </header>
            {selectedTab === BODY_WEIGHT_TAB && selectedBodyWeight && (
              <p className="review-body-weight">
                体重 <strong>{formatWeight(selectedBodyWeight.value)}</strong>
              </p>
            )}
            <TrainingDayRecord day={selectedDay} selectedTab={selectedTab} />
          </section>
        </>
      ) : null}

      <BottomNavigation active="history" />
    </main>
  );
}
