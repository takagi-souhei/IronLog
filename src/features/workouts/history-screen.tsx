"use client";

import { useEffect, useState } from "react";
import { BottomNavigation } from "@/components/common/bottom-navigation";
import { loadWorkoutHistory } from "@/services/workout-history-service";
import type { WorkoutDayHistory } from "@/services/workout-history-service";

function formatWeight(weight: number | null): string {
  if (weight === null) return "—";
  return `${Number(weight.toFixed(1))} kg`;
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

export function HistoryScreen() {
  const [days, setDays] = useState<WorkoutDayHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    loadWorkoutHistory()
      .then((history) => {
        if (active) setDays(history);
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

  return (
    <main className="history-page">
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
          <h2>トレーニング履歴</h2>
        </div>
        {!isLoading && !error && (
          <span className="count-pill">{days.length} 日</span>
        )}
      </section>

      {error && <p className="feedback feedback-error" role="alert">{error}</p>}
      {isLoading && <div className="loading-card">履歴を読み込んでいます…</div>}
      {!isLoading && !error && days.length === 0 && (
        <div className="history-empty">
          <span className="history-empty-icon" aria-hidden="true">↗</span>
          <h3>記録はまだありません</h3>
          <p>トレーニングを記録すると、ここに履歴が表示されます。</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="history-day-list">
          {days.map((day) => (
            <section className="history-day" key={day.date}>
              <header className="history-day-heading">
                <span className="history-day-mark" aria-hidden="true" />
                <div>
                  <p className="eyebrow">{day.date}</p>
                  <h3>{formatDate(day.date)}</h3>
                </div>
                <span className="day-exercise-count">{day.exercises.length} 種目</span>
              </header>

              <div className="history-exercise-list">
                {day.exercises.map((exercise) => (
                  <article className="history-exercise" key={exercise.id}>
                    <div className="history-exercise-heading">
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
                    </div>

                    <ol className="history-set-list">
                      {exercise.sets.map((set, index) => (
                        <li className="history-set-row" key={set.id}>
                          <span className="history-set-index">{String(index + 1).padStart(2, "0")}</span>
                          <span className="history-set-value">
                            {set.effectiveWeight === null
                              ? `有効重量未算出 · 外部重量 ${formatWeight(set.externalWeight)} × ${set.reps} 回`
                              : `${formatWeight(set.effectiveWeight)} × ${set.reps} 回`}
                          </span>
                          {set.effectiveWeight !== null && exercise.bodyweightRatio > 0 && (
                            <span className="history-set-detail">
                              外部重量 {formatWeight(set.externalWeight)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>

                    <footer className="history-exercise-stats">
                      <div>
                        <span>最大重量</span>
                        <strong>{formatWeight(exercise.maxWeight)}</strong>
                      </div>
                      <div>
                        <span>推定1RM</span>
                        <strong>{formatWeight(exercise.estimatedOneRepMax)}</strong>
                      </div>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <BottomNavigation active="history" />
    </main>
  );
}
