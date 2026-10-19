"use client";

import { useRef, useState } from "react";
import { BottomNavigation } from "@/components/common/bottom-navigation";
import {
  exportTrainingBackup,
  parseTrainingBackup,
  restoreTrainingBackup,
} from "@/services/backup-service";

export function SettingsScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function handleExport() {
    setError(undefined);
    setNotice(undefined);
    setIsExporting(true);
    try {
      const json = await exportTrainingBackup();
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "training-backup.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("バックアップをエクスポートしました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "エクスポートに失敗しました。");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleFileSelected(file?: File) {
    if (!file) return;
    setError(undefined);
    setNotice(undefined);
    setIsImporting(true);
    try {
      const backup = parseTrainingBackup(await file.text());
      const confirmed = window.confirm(
        `このバックアップを復元すると、現在の種目・トレーニング履歴・体重履歴・設定情報が置き換わります。\n\n種目 ${backup.exercises.length}件、トレーニング ${backup.workouts.length}件、体重記録 ${backup.bodyWeightRecords.length}件を復元します。続行しますか？`,
      );
      if (!confirmed) return;
      await restoreTrainingBackup(backup);
      setNotice("バックアップを復元しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "インポートに失敗しました。");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <main className="settings-page">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">I</div>
        <div>
          <p className="eyebrow">TRAINING JOURNAL</p>
          <h1>IronLog</h1>
        </div>
        <span className="header-status"><span /> LOCAL</span>
      </header>

      <section className="settings-heading">
        <div>
          <p className="eyebrow">APP PREFERENCES</p>
          <h2>設定</h2>
        </div>
      </section>

      {error && <p className="feedback feedback-error" role="alert">{error}</p>}
      {notice && <p className="feedback feedback-success" role="status">{notice}</p>}

      <section className="backup-panel panel" aria-labelledby="backup-title">
        <div className="backup-panel-heading">
          <span className="backup-icon" aria-hidden="true">↕</span>
          <div>
            <p className="eyebrow">DATA MANAGEMENT</p>
            <h3 id="backup-title">バックアップ</h3>
          </div>
        </div>
        <p className="backup-description">
          種目、トレーニング履歴、体重履歴、設定情報をJSONファイルで保存・復元します。
          データはこの端末内に保存され、復元すると現在のデータは置き換わります。
        </p>
        <div className="backup-actions">
          <button
            className="backup-button backup-export-button"
            type="button"
            onClick={handleExport}
            disabled={isExporting || isImporting}
          >
            {isExporting ? "作成中…" : "JSONをエクスポート"}
          </button>
          <button
            className="backup-button backup-import-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isExporting || isImporting}
          >
            {isImporting ? "復元中…" : "JSONをインポート"}
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            aria-label="バックアップJSONファイルを選択"
            onChange={(event) => {
              void handleFileSelected(event.currentTarget.files?.[0]);
            }}
          />
        </div>
        <p className="backup-file-hint">エクスポート時のファイル名: training-backup.json</p>
      </section>

      <BottomNavigation active="settings" />
    </main>
  );
}
