"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";

const STANDARD_ROW_HEIGHT = 44;
const STANDARD_VISIBLE_ROWS = 11;
const STANDARD_OVERSCAN_ROWS = 4;
const COMPACT_ROW_HEIGHT = 16;
const COMPACT_VISIBLE_ROWS = 3;
const COMPACT_OVERSCAN_ROWS = 2;

interface WheelPickerProps {
  label: string;
  value: number;
  values: readonly number[];
  formatValue?: (value: number) => string;
  ariaLabel?: string;
  compact?: boolean;
  quickSteps?: readonly number[];
  onChange: (value: number) => void;
}

export function WheelPicker({
  label,
  value,
  values,
  formatValue = String,
  ariaLabel = label,
  compact = false,
  quickSteps = [],
  onChange,
}: WheelPickerProps) {
  const rowHeight = compact ? COMPACT_ROW_HEIGHT : STANDARD_ROW_HEIGHT;
  const visibleRows = compact ? COMPACT_VISIBLE_ROWS : STANDARD_VISIBLE_ROWS;
  const overscanRows = compact ? COMPACT_OVERSCAN_ROWS : STANDARD_OVERSCAN_ROWS;
  const centerOffset = Math.floor(visibleRows / 2);
  const pickerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIndex = values.reduce(
    (closestIndex, option, index) =>
      Math.abs(option - value) < Math.abs(values[closestIndex] - value)
        ? index
        : closestIndex,
    0,
  );
  const firstVisibleIndex = Math.min(
    Math.max(0, values.length - visibleRows),
    Math.max(0, selectedIndex - overscanRows),
  );
  const lastReportedIndex = useRef(selectedIndex);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container && !isScrolling.current) {
      container.scrollTop = selectedIndex * rowHeight;
      lastReportedIndex.current = selectedIndex;
    }
  }, [rowHeight, selectedIndex, isScrolling]);

  useEffect(
    () => () => {
      if (scrollTimeout.current !== undefined) clearTimeout(scrollTimeout.current);
    },
    [],
  );

  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;

    isScrolling.current = true;
    if (scrollTimeout.current !== undefined) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
    }, 120);
    const nextIndex = Math.min(
      values.length - 1,
      Math.max(0, Math.round(container.scrollTop / rowHeight)),
    );
    if (nextIndex !== lastReportedIndex.current) {
      lastReportedIndex.current = nextIndex;
      onChange(values[nextIndex]);
    }
  }

  function selectIndex(index: number) {
    const container = containerRef.current;
    if (!container) return;
    isScrolling.current = true;
    if (scrollTimeout.current !== undefined) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
    }, 200);
    container.scrollTo({ top: index * rowHeight, behavior: "smooth" });
    onChange(values[index]);
  }

  function stepBy(amount: number) {
    selectIndex(
      Math.min(values.length - 1, Math.max(0, selectedIndex + amount)),
    );
  }

  const endVisibleIndex = Math.min(values.length, firstVisibleIndex + visibleRows);
  const visibleValues = values.slice(firstVisibleIndex, endVisibleIndex);

  return (
    <div className={`wheel-field${compact ? " is-compact" : ""}`}>
      <div className="wheel-label-row">
        <div className="wheel-label">{label}</div>
        {quickSteps.length > 0 && (
          <div className="wheel-step-controls" aria-label={`${label}を素早く変更`}>
            {quickSteps.map((step) => (
              <button
                type="button"
                key={`decrease-${step}`}
                aria-label={`${label}を${step}減らす`}
                onClick={() => stepBy(-step)}
              >
                −{step}
              </button>
            ))}
            {quickSteps.map((step) => (
              <button
                type="button"
                key={`increase-${step}`}
                aria-label={`${label}を${step}増やす`}
                onClick={() => stepBy(step)}
              >
                +{step}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`wheel-shell${compact ? " is-compact" : ""}`}>
        <div
          className={`wheel-highlight${compact ? " is-compact" : ""}`}
          aria-hidden="true"
        />
        <div
          ref={containerRef}
          className={`wheel-scroll${compact ? " is-compact" : ""}`}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={`${pickerId}-${value}`}
          onScroll={handleScroll}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              selectIndex(Math.max(0, selectedIndex - 1));
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              selectIndex(Math.min(values.length - 1, selectedIndex + 1));
            }
          }}
          tabIndex={0}
        >
          <div
            className="wheel-spacer"
            style={{ height: rowHeight * (firstVisibleIndex + centerOffset) }}
            aria-hidden="true"
          />
          {visibleValues.map((option, offset) => {
            const index = firstVisibleIndex + offset;
            return (
              <button
                id={`${pickerId}-${option}`}
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                className={`wheel-option${compact ? " is-compact" : ""}${option === value ? " is-selected" : ""}`}
                onClick={() => selectIndex(index)}
                tabIndex={-1}
              >
                {formatValue(option)}
              </button>
            );
          })}
          <div
            className="wheel-spacer"
            style={{
              height: rowHeight * (values.length - endVisibleIndex + centerOffset),
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
