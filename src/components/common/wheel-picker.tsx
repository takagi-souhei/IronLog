"use client";

import { useEffect, useId, useRef, useState } from "react";

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 11;
const OVERSCAN_ROWS = 4;

interface WheelPickerProps {
  label: string;
  value: number;
  values: readonly number[];
  formatValue?: (value: number) => string;
  ariaLabel?: string;
  onChange: (value: number) => void;
}

export function WheelPicker({
  label,
  value,
  values,
  formatValue = String,
  ariaLabel = label,
  onChange,
}: WheelPickerProps) {
  const pickerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const exactIndex = values.findIndex((option) => Math.abs(option - value) < 0.000001);
  const selectedIndex = exactIndex === -1 ? 0 : exactIndex;
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(() =>
    Math.min(
      Math.max(0, values.length - VISIBLE_ROWS),
      Math.max(0, selectedIndex - OVERSCAN_ROWS),
    ),
  );
  const lastReportedIndex = useRef(selectedIndex);
  const initialized = useRef(false);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (container && (!initialized.current || !isScrolling.current)) {
      setFirstVisibleIndex(
        Math.min(
          Math.max(0, values.length - VISIBLE_ROWS),
          Math.max(0, selectedIndex - OVERSCAN_ROWS),
        ),
      );
      container.scrollTop = selectedIndex * ROW_HEIGHT;
      lastReportedIndex.current = selectedIndex;
      initialized.current = true;
    }
  }, [selectedIndex, values.length]);

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
      Math.max(0, Math.round(container.scrollTop / ROW_HEIGHT)),
    );
    if (
      nextIndex < firstVisibleIndex + OVERSCAN_ROWS ||
      nextIndex >= firstVisibleIndex + VISIBLE_ROWS - OVERSCAN_ROWS
    ) {
      setFirstVisibleIndex(
        Math.min(
          Math.max(0, values.length - VISIBLE_ROWS),
          Math.max(0, nextIndex - OVERSCAN_ROWS),
        ),
      );
    }
    if (nextIndex !== lastReportedIndex.current) {
      lastReportedIndex.current = nextIndex;
      onChange(values[nextIndex]);
    }
  }

  function selectIndex(index: number) {
    const container = containerRef.current;
    if (!container) return;
    setFirstVisibleIndex(
      Math.min(
        Math.max(0, values.length - VISIBLE_ROWS),
        Math.max(0, index - OVERSCAN_ROWS),
      ),
    );
    isScrolling.current = true;
    if (scrollTimeout.current !== undefined) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
    }, 200);
    container.scrollTo({ top: index * ROW_HEIGHT, behavior: "smooth" });
    onChange(values[index]);
  }

  const endVisibleIndex = Math.min(values.length, firstVisibleIndex + VISIBLE_ROWS);
  const visibleValues = values.slice(firstVisibleIndex, endVisibleIndex);

  return (
    <div className="wheel-field">
      <div className="wheel-label">{label}</div>
      <div className="wheel-shell">
        <div className="wheel-highlight" aria-hidden="true" />
        <div
          ref={containerRef}
          className="wheel-scroll"
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
            style={{ height: ROW_HEIGHT * (firstVisibleIndex + 1) }}
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
                className={`wheel-option${option === value ? " is-selected" : ""}`}
                onClick={() => selectIndex(index)}
                tabIndex={-1}
              >
                {formatValue(option)}
              </button>
            );
          })}
          <div
            className="wheel-spacer"
            style={{ height: ROW_HEIGHT * (values.length - endVisibleIndex + 1) }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
