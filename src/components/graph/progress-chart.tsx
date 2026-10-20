"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export interface ProgressChartPoint {
  date: string;
  value: number | null;
}

interface ProgressChartProps {
  points: readonly ProgressChartPoint[];
  selectedDate: string;
  label: string;
  onSelectDate: (date: string) => void;
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function ProgressChart({
  points,
  selectedDate,
  label,
  onSelectDate,
}: ProgressChartProps) {
  return (
    <div className="review-chart" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={[...points]}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          onClick={(state) => {
            const point = state?.activePayload?.[0]?.payload;
            if (point && typeof point.date === "string") {
              onSelectDate(point.date);
            }
          }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#e9eee7"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: "#87948a", fontSize: 9 }}
            axisLine={{ stroke: "#dce5da" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[0, "auto"]}
            tick={{ fill: "#87948a", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value}`}
            width={34}
          />
          <ReferenceLine y={0} stroke="#dce5da" />
          {points.some((point) => point.date === selectedDate) && (
            <ReferenceLine
              x={selectedDate}
              stroke="#9bb09a"
              strokeDasharray="4 4"
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#356a4f"
            strokeWidth={2.5}
            connectNulls={false}
            activeDot={{ r: 8, strokeWidth: 3, stroke: "#e5f0d9" }}
            dot={{
              r: 4,
              fill: "#356a4f",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
