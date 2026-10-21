"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BottomNavigation } from "@/components/common/bottom-navigation";
import { WORKOUT_SET_LIMITS } from "@/constants/training";
import {
  addExercise,
  clearWorkoutDraft,
  deleteWorkoutRecording,
  loadWorkoutDraft,
  loadWorkoutRecordingData,
  saveWorkoutRecording,
} from "@/services/workout-recording-service";
import type { Exercise, Workout, WorkoutDraft, WorkoutExercise, WorkoutSet } from "@/types";
import { prioritizeRecentlyUsedExercises, searchExercises } from "@/utils";

const inMemoryWorkoutDrafts = new Map<string, WorkoutDraft>();

function roundToHalfKilogram(weight: number): number {
  return Math.round(weight * 2) / 2;
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId(): string {
  return crypto.randomUUID();
}

function createWorkoutExercise(
  exercise: Exercise,
  previous?: WorkoutExercise,
): WorkoutExercise {
  const previousSets = previous?.sets ?? [];
  const sets =
    previousSets.length > 0
      ? previousSets.map((set) => ({ ...set, id: createId() }))
      : [{ id: createId(), reps: 8, externalWeight: 0 }];

  return {
    id: createId(),
    exerciseId: exercise.id,
    exerciseSnapshot: {
      name: exercise.name,
      category: exercise.category,
      weightUnit: exercise.weightUnit,
      bodyweightRatio: exercise.bodyweightRatio,
    },
    sets,
  };
}

function createEmptySet(previousSet?: WorkoutSet): WorkoutSet {
  return {
    id: createId(),
    reps: previousSet?.reps ?? 8,
    externalWeight: previousSet?.externalWeight ?? 0,
  };
}

function duplicateWorkoutExercise(exercise: WorkoutExercise): WorkoutExercise {
  return {
    ...exercise,
    id: createId(),
    exerciseSnapshot: { ...exercise.exerciseSnapshot },
    sets: exercise.sets.map((set) => ({ ...set, id: createId() })),
  };
}

export function RecordingScreen() {
  const [date, setDate] = useState(localDateString);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutId, setWorkoutId] = useState<string>();
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [bodyWeight, setBodyWeight] = useState(30);
  const [bodyWeightInput, setBodyWeightInput] = useState("30");
  const [bodyWeightInputError, setBodyWeightInputError] = useState<string>();
  const [hasPreviousBodyWeight, setHasPreviousBodyWeight] = useState(false);
  const [isBodyWeightModalOpen, setIsBodyWeightModalOpen] = useState(false);
  const [isPastWorkoutModalOpen, setIsPastWorkoutModalOpen] = useState(false);
  const [selectedPastWorkoutIndex, setSelectedPastWorkoutIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [draftReadyDate, setDraftReadyDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("胸");
  const bodyWeightInputRef = useRef<HTMLInputElement>(null);
  const shouldPersistDraftRef = useRef(false);
  const draftSnapshotRef = useRef<WorkoutDraft | undefined>(undefined);

  draftSnapshotRef.current = {
    date,
    ...(workoutId === undefined ? {} : { workoutId }),
    exercises: workoutExercises,
    bodyWeight,
  };
  shouldPersistDraftRef.current = isDirty && draftReadyDate === date;

  useEffect(() => {
    let active = true;
    setDraftReadyDate("");
    setIsLoading(true);
    setError(undefined);

    loadWorkoutRecordingData(date)
      .then((data) => {
        if (!active) return;
        const draft =
          inMemoryWorkoutDrafts.get(date) ?? loadWorkoutDraft();
        const matchingDraft = draft?.date === date ? draft : undefined;
        const loadedWorkoutExercises =
          matchingDraft?.exercises ?? data.workoutForDate?.exercises ?? [];
        setExercises(data.exercises);
        setWorkouts(data.workouts);
        setWorkoutId(matchingDraft?.workoutId ?? data.workoutForDate?.id);
        setWorkoutExercises(loadedWorkoutExercises);
        setSelectedExerciseId(loadedWorkoutExercises[0]?.exerciseId ?? "");
        setIsDirty(matchingDraft !== undefined);
        const savedWeight = data.bodyWeightRecords.find((record) => record.date === date);
        const latestBodyWeight = data.bodyWeightRecords.reduce<
          (typeof data.bodyWeightRecords)[number] | undefined
        >(
          (latest, record) =>
            !latest || record.date > latest.date ? record : latest,
          undefined,
        );
        setBodyWeight(
          roundToHalfKilogram(
            matchingDraft?.bodyWeight ??
              latestBodyWeight?.weight ??
              savedWeight?.weight ??
              30,
          ),
        );
        setHasPreviousBodyWeight(latestBodyWeight !== undefined);

        setDraftReadyDate(date);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "記録を読み込めませんでした。");
          setDraftReadyDate(date);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  useEffect(
    () => () => {
      if (!shouldPersistDraftRef.current || !draftSnapshotRef.current) return;
      inMemoryWorkoutDrafts.set(
        draftSnapshotRef.current.date,
        draftSnapshotRef.current,
      );
    },
    [],
  );

  useEffect(() => {
    if (!isExercisePickerOpen && !isBodyWeightModalOpen && !isPastWorkoutModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isBodyWeightModalOpen, isExercisePickerOpen, isPastWorkoutModalOpen]);

  const recentExercises = useMemo(
    () => prioritizeRecentlyUsedExercises(exercises, workouts.filter((workout) => workout.date <= date)),
    [date, exercises, workouts],
  );
  const filteredExercises = useMemo(
    () => searchExercises(recentExercises, searchQuery),
    [recentExercises, searchQuery],
  );
  const workoutExerciseIds = new Set(workoutExercises.map((item) => item.exerciseId));
  const pastWorkouts = useMemo(
    () => workouts
      .filter((workout) => workout.date < date)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [date, workouts],
  );
  const selectedPastWorkout = pastWorkouts[selectedPastWorkoutIndex];

  function openBodyWeightModal() {
    setBodyWeightInput(String(bodyWeight));
    setBodyWeightInputError(undefined);
    setIsBodyWeightModalOpen(true);
  }

  function applyBodyWeightInput() {
    const input = bodyWeightInputRef.current;
    if (!input?.validity.valid) {
      setBodyWeightInputError(
        input?.validity.stepMismatch
          ? "体重は0.5kg刻みで入力してください。"
          : "体重は0より大きい数値を入力してください。",
      );
      input?.reportValidity();
      return;
    }

    setBodyWeight(roundToHalfKilogram(Number(bodyWeightInput)));
    setIsDirty(true);
    setIsBodyWeightModalOpen(false);
  }

  function previousExercise(exerciseId: string): WorkoutExercise | undefined {
    return workouts
      .filter((workout) => workout.date < date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap((workout) => workout.exercises)
      .find((item) => item.exerciseId === exerciseId);
  }

  function addExerciseToWorkout(exercise: Exercise) {
    const previous = previousExercise(exercise.id);
    setWorkoutExercises((current) => [...current, createWorkoutExercise(exercise, previous)]);
    setSelectedExerciseId(exercise.id);
    setIsDirty(true);
    setIsExercisePickerOpen(false);
    setSearchQuery("");
    setNotice(undefined);
  }

  function openPastWorkoutModal() {
    if (pastWorkouts.length === 0) return;
    setSelectedPastWorkoutIndex(0);
    setIsPastWorkoutModalOpen(true);
  }

  function handleLoadPastWorkout() {
    if (!selectedPastWorkout) return;
    if (!window.confirm("この内容で置き換えますか？")) {
      return;
    }

    const copiedExercises = selectedPastWorkout.exercises.map(duplicateWorkoutExercise);
    setWorkoutExercises(copiedExercises);
    setSelectedExerciseId(copiedExercises[0]?.exerciseId ?? "");
    setIsDirty(true);
    setError(undefined);
    setNotice("過去トレーニングを読み込みました。保存はまだ行われていません。");
    setIsPastWorkoutModalOpen(false);
  }

  function adjustSet(
    workoutExerciseId: string,
    setId: string,
    field: "externalWeight" | "reps",
    amount: number,
  ) {
    const min = field === "externalWeight"
      ? WORKOUT_SET_LIMITS.minWeight
      : WORKOUT_SET_LIMITS.minReps;
    const max = field === "externalWeight"
      ? WORKOUT_SET_LIMITS.maxWeight
      : WORKOUT_SET_LIMITS.maxReps;
    setIsDirty(true);
    setWorkoutExercises((current) =>
      current.map((item) =>
        item.id === workoutExerciseId
          ? {
              ...item,
              sets: item.sets.map((set) => {
                if (set.id !== setId) return set;
                const nextValue = Math.min(max, Math.max(min, set[field] + amount));
                return field === "externalWeight"
                  ? { ...set, externalWeight: nextValue }
                  : { ...set, reps: nextValue };
              }),
            }
          : item,
      ),
    );
  }

  async function handleAddCustomExercise() {
    const name = newExerciseName.trim();
    if (!name) return;

    const exercise: Exercise = {
      id: createId(),
      name,
      category: newExerciseCategory,
      weightUnit: "total",
      bodyweightRatio: 0,
      isArchived: false,
    };
    try {
      await addExercise(exercise);
      setExercises((current) => [...current, exercise]);
      addExerciseToWorkout(exercise);
      setNewExerciseName("");
      setIsAddingExercise(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "種目を追加できませんでした。");
    }
  }

  async function handleSave(): Promise<boolean> {
    setIsSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      if (workoutExercises.length === 0) {
        await saveWorkoutRecording(undefined, bodyWeight, date, workoutId);
        shouldPersistDraftRef.current = false;
        inMemoryWorkoutDrafts.delete(date);
        setWorkoutId(undefined);
        setNotice(workoutId ? "トレーニングを削除し、体重を保存しました" : "体重を保存しました");
        setIsDirty(false);
        const data = await loadWorkoutRecordingData(date);
        setWorkouts(data.workouts);
        return true;
      }

      const workout: Workout = {
        id: workoutId ?? createId(),
        date,
        exercises: workoutExercises,
      };
      await saveWorkoutRecording(workout, bodyWeight, date);
      shouldPersistDraftRef.current = false;
      inMemoryWorkoutDrafts.delete(date);
      setWorkoutId(workout.id);
      setIsDirty(false);
      setNotice("トレーニングを保存しました");
      const data = await loadWorkoutRecordingData(date);
      setExercises(data.exercises);
      setWorkouts(data.workouts);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteWorkout() {
    if (!workoutId || !window.confirm("この日のトレーニング記録を削除しますか？")) return;

    setIsSaving(true);
    setError(undefined);
    try {
      await deleteWorkoutRecording(workoutId);
      shouldPersistDraftRef.current = false;
      inMemoryWorkoutDrafts.delete(date);
      setWorkoutId(undefined);
      setWorkoutExercises([]);
      setIsDirty(false);
      setNotice("トレーニング記録を削除しました。体重記録は保持されています。");
      const data = await loadWorkoutRecordingData(date);
      setWorkouts(data.workouts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "削除できませんでした。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="recording-page">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">I</div>
        <div>
          <p className="eyebrow">TRAINING JOURNAL</p>
          <h1>IronLog</h1>
        </div>
        <span className="header-status"><span /> LOCAL</span>
      </header>

      <section className="date-card">
        <div>
          <p className="eyebrow">WORKOUT DATE</p>
          <h2>トレーニング記録</h2>
        </div>
        <input
          className="date-input"
          type="date"
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value;
            if (!nextDate) return;
            if (
              isDirty &&
              !window.confirm("未保存の変更は破棄されます。日付を変更しますか？")
            ) {
              return;
            }
            try {
              clearWorkoutDraft();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "入力途中の記録を削除できませんでした。");
              return;
            }
            inMemoryWorkoutDrafts.delete(date);
            shouldPersistDraftRef.current = false;
            setIsDirty(false);
            setDate(nextDate);
          }}
          aria-label="トレーニング日"
        />
      </section>

      {error && <p className="feedback feedback-error" role="alert">{error}</p>}
      {notice && <p className="feedback feedback-success" role="status">{notice}</p>}

      <section className="section-title-row">
        <div>
          <p className="eyebrow">YOUR SESSION</p>
          <h2>種目とセット</h2>
        </div>
        <span className={`save-state${isDirty ? " is-dirty" : ""}`} role="status">
          {isDirty ? "💾 保存する" : "✅ 保存済み"}
        </span>
      </section>
      <div className="record-actions">
        <button
          className="load-previous-button"
          type="button"
          disabled={pastWorkouts.length === 0 || isLoading || isSaving}
          onClick={openPastWorkoutModal}
        >
          過去トレーニングを読み込み
        </button>
        <button
          className="add-exercise-action"
          type="button"
          disabled={isLoading || isSaving}
          onClick={() => setIsExercisePickerOpen(true)}
        >
          ＋ 種目を追加
        </button>
      </div>

      {isLoading ? (
        <div className="loading-card">記録を読み込んでいます…</div>
      ) : (
        <>
          <div className="exercise-tabs" role="tablist" aria-label="記録する種目">
            {workoutExercises.map((item) => (
              <button
                className={`exercise-tab${selectedExerciseId === item.exerciseId ? " is-selected" : ""}`}
                id={`record-exercise-tab-${item.exerciseId}`}
                type="button"
                role="tab"
                aria-selected={selectedExerciseId === item.exerciseId}
                key={item.id}
                onClick={() => setSelectedExerciseId(item.exerciseId)}
              >
                {item.exerciseSnapshot.name}
              </button>
            ))}
            {workoutExercises.length === 0 && (
              <p className="exercise-tabs-empty">種目を追加して記録を始めましょう</p>
            )}
          </div>
          <div className="exercise-stack">
          {workoutExercises
            .filter((item) => item.exerciseId === selectedExerciseId)
            .map((item) => {
            return (
              <article className="exercise-card" key={item.id}>
                <div className="exercise-card-heading">
                  <div>
                    <span className="category-label">{item.exerciseSnapshot.category}</span>
                    <h3>{item.exerciseSnapshot.name}</h3>
                    {item.exerciseSnapshot.weightUnit === "per-hand" && (
                      <span className="helper-text">片手あたり</span>
                    )}
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`${item.exerciseSnapshot.name}を削除`}
                    onClick={() => {
                      setIsDirty(true);
                      setWorkoutExercises((current) =>
                        current.filter((entry) => entry.id !== item.id),
                      );
                      if (selectedExerciseId === item.exerciseId) {
                        setSelectedExerciseId(
                          workoutExercises.find(
                            (entry) => entry.id !== item.id,
                          )?.exerciseId ?? "",
                        );
                      }
                    }}
                  >
                    ×
                  </button>
                </div>

                <div className="set-list">
                  {item.sets.map((set, index) => (
                    <div className="set-row" key={set.id}>
                      <span className="set-index">{String(index + 1).padStart(2, "0")}</span>
                      <div className="set-value-control">
                        <output
                          className="set-value"
                          aria-label={`${item.exerciseSnapshot.name} セット${index + 1} 重量`}
                        >
                          {set.externalWeight}kg
                        </output>
                        <div className="set-step-buttons" aria-label="重量を変更">
                          {[-10, -5, 5, 10].map((amount) => (
                            <button
                              type="button"
                              key={amount}
                              aria-label={`重量を${amount > 0 ? "増やす" : "減らす"} ${Math.abs(amount)}kg`}
                              onClick={() => adjustSet(item.id, set.id, "externalWeight", amount)}
                            >
                              {amount > 0 ? `+${amount}` : amount}
                            </button>
                          ))}
                        </div>
                      </div>
                      <span className="multiply-sign">×</span>
                      <div className="set-value-control">
                        <output
                          className="set-value"
                          aria-label={`${item.exerciseSnapshot.name} セット${index + 1} 回数`}
                        >
                          {set.reps}回
                        </output>
                        <div className="set-step-buttons" aria-label="回数を変更">
                          {[-5, -1, 1, 5].map((amount) => (
                            <button
                              type="button"
                              key={amount}
                              aria-label={`回数を${amount > 0 ? "増やす" : "減らす"} ${Math.abs(amount)}回`}
                              onClick={() => adjustSet(item.id, set.id, "reps", amount)}
                            >
                              {amount > 0 ? `+${amount}` : amount}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        className="remove-set-button"
                        type="button"
                        aria-label={`${item.exerciseSnapshot.name} セット${index + 1}を削除`}
                        onClick={() => {
                          setIsDirty(true);
                          setWorkoutExercises((current) =>
                            current.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, sets: entry.sets.filter((row) => row.id !== set.id) }
                                : entry,
                            ),
                          )
                        }}
                      >
                        −
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="add-set-button"
                  type="button"
                  onClick={() => {
                    setIsDirty(true);
                    setWorkoutExercises((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              sets: [...entry.sets, createEmptySet(entry.sets.at(-1))],
                            }
                          : entry,
                      ),
                    )
                  }}
                >
                  <span>＋</span> セットを追加
                </button>
              </article>
            );
          })}
          </div>
        </>
      )}

      <div className="save-bar">
        <button
          className="bodyweight-input-button"
          type="button"
          disabled={isLoading || isSaving}
          onClick={openBodyWeightModal}
        >
          <span className="bodyweight-input-label">体重を入力</span>
          <strong>{bodyWeight}kg</strong>
        </button>
        {workoutId && (
          <button
            className="delete-workout-button"
            type="button"
            disabled={isSaving}
            onClick={handleDeleteWorkout}
          >
            削除
          </button>
        )}
        <button
          className="save-button"
          type="button"
          disabled={isLoading || isSaving}
          onClick={handleSave}
        >
          {isSaving
            ? "保存中…"
            : workoutExercises.length === 0
              ? "体重を保存"
              : workoutId
                ? "変更を保存"
                : "トレーニングを保存"}
          {!isSaving && <span aria-hidden="true">→</span>}
        </button>
      </div>

      {isBodyWeightModalOpen && (
        <div
          className="sheet-backdrop bodyweight-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsBodyWeightModalOpen(false);
          }}
        >
          <section
            className="bodyweight-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bodyweight-sheet-title"
          >
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div>
                <p className="eyebrow">BODY WEIGHT</p>
                <h2 id="bodyweight-sheet-title">体重を入力</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="閉じる"
                onClick={() => setIsBodyWeightModalOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="bodyweight-keyboard-field">
              体重（kg）
              <input
                ref={bodyWeightInputRef}
                type="number"
                inputMode="decimal"
                min="0.5"
                step="0.5"
                required
                value={bodyWeightInput}
                aria-label="体重（kg）"
                aria-invalid={bodyWeightInputError !== undefined}
                aria-describedby={
                  bodyWeightInputError ? "bodyweight-input-error" : undefined
                }
                onChange={(event) => {
                  setBodyWeightInput(event.target.value);
                  setBodyWeightInputError(undefined);
                }}
              />
            </label>
            {bodyWeightInputError && (
              <p className="feedback feedback-error" id="bodyweight-input-error" role="alert">
                {bodyWeightInputError}
              </p>
            )}
            <p className="helper-text bodyweight-helper">
              {hasPreviousBodyWeight
                ? "最新の体重記録を初期表示しています"
                : "体重記録がないため、30 kgを初期値にしています"}
            </p>
            <div className="bodyweight-modal-actions">
              <button
                className="bodyweight-cancel-button"
                type="button"
                onClick={() => setIsBodyWeightModalOpen(false)}
              >
                キャンセル
              </button>
              <button
                className="bodyweight-save-button"
                type="button"
                onClick={applyBodyWeightInput}
              >
                入力を反映
              </button>
            </div>
          </section>
        </div>
      )}

      {isPastWorkoutModalOpen && selectedPastWorkout && (
        <div
          className="sheet-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsPastWorkoutModalOpen(false);
          }}
        >
          <section
            className="past-workout-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="past-workout-title"
          >
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div>
                <p className="eyebrow">PAST TRAINING</p>
                <h2 id="past-workout-title">過去トレーニングを読み込み</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="閉じる"
                onClick={() => setIsPastWorkoutModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="past-workout-navigation">
              <button
                type="button"
                aria-label="より古いトレーニング"
                disabled={selectedPastWorkoutIndex >= pastWorkouts.length - 1}
                onClick={() => setSelectedPastWorkoutIndex((index) => index + 1)}
              >
                ＜
              </button>
              <strong>{selectedPastWorkout.date.replaceAll("-", "/")}</strong>
              <button
                type="button"
                aria-label="より新しいトレーニング"
                disabled={selectedPastWorkoutIndex === 0}
                onClick={() => setSelectedPastWorkoutIndex((index) => index - 1)}
              >
                ＞
              </button>
            </div>
            <div className="past-workout-exercises">
              {selectedPastWorkout.exercises.map((item) => (
                <article className="past-workout-exercise" key={item.id}>
                  <strong>{item.exerciseSnapshot.name}</strong>
                  <span>
                    {item.sets
                      .map((set) => `${set.externalWeight}×${set.reps}`)
                      .join("　")}
                  </span>
                </article>
              ))}
            </div>
            <button
              className="past-workout-apply"
              type="button"
              disabled={isSaving}
              onClick={handleLoadPastWorkout}
            >
              この内容を読み込む
            </button>
          </section>
        </div>
      )}

      {isExercisePickerOpen && (
        <div
          className="sheet-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsExercisePickerOpen(false);
          }}
        >
          <section className="exercise-sheet" role="dialog" aria-modal="true" aria-labelledby="exercise-sheet-title">
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div>
                <p className="eyebrow">EXERCISE LIBRARY</p>
                <h2 id="exercise-sheet-title">種目を選択</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="閉じる"
                onClick={() => setIsExercisePickerOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="種目名・部位で検索"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="exercise-results">
              {filteredExercises.map((exercise, index) => (
                <button
                  className="exercise-result"
                  type="button"
                  key={exercise.id}
                  disabled={workoutExerciseIds.has(exercise.id)}
                  onClick={() => addExerciseToWorkout(exercise)}
                >
                  <span className="result-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="result-name">
                    <strong>{exercise.name}</strong>
                    <small>{exercise.category}{exercise.weightUnit === "per-hand" ? " · 片手" : ""}</small>
                  </span>
                  <span className="result-action">
                    {workoutExerciseIds.has(exercise.id) ? "追加済み" : "＋"}
                  </span>
                </button>
              ))}
              {filteredExercises.length === 0 && (
                <p className="empty-search">該当する種目がありません。新しい種目を追加できます。</p>
              )}
            </div>

            <button
              className="custom-exercise-toggle"
              type="button"
              onClick={() => setIsAddingExercise((current) => !current)}
            >
              <span>＋</span> 新しい種目を作成
            </button>
            {isAddingExercise && (
              <div className="custom-exercise-form">
                <label>
                  種目名
                  <input
                    value={newExerciseName}
                    onChange={(event) => setNewExerciseName(event.target.value)}
                    placeholder="例：ケーブルフライ"
                    maxLength={60}
                  />
                </label>
                <label>
                  部位
                  <select
                    value={newExerciseCategory}
                    onChange={(event) => setNewExerciseCategory(event.target.value)}
                  >
                    {["胸", "背中", "脚", "肩", "腕", "その他"].map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="create-exercise-button"
                  type="button"
                  disabled={!newExerciseName.trim()}
                  onClick={handleAddCustomExercise}
                >
                  作成して記録に追加
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      <BottomNavigation
        active="record"
      />
    </main>
  );
}
