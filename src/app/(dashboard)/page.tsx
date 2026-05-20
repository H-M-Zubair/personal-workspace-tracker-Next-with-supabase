"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/lib/hooks/use-stats";
import { getTodayLabel } from "@/lib/utils/date";
import { formatDuration } from "@/lib/utils/time";
import { useUiStore } from "@/lib/stores/ui-store";
import WeeklyAbsencesDialog from "@/components/dashboard/weekly-absences-dialog";

type RangeKey = "weekly" | "monthly" | "yearly";

function StatsCards({
  range,
  totalSeconds,
  completed,
  totalTasks,
  absenceCount,
  success,
  streak,
  onViewAbsences,
}: {
  range: RangeKey;
  totalSeconds: number;
  completed: number;
  totalTasks: number;
  absenceCount: number;
  success: number;
  streak: number;
  onViewAbsences: () => void;
}) {
  const rangeLabel = `${range[0].toUpperCase()}${range.slice(1)}`;
  const cards = [
    { label: "Hours logged today", value: formatDuration(totalSeconds), action: null as (() => void) | null },
    { label: `${rangeLabel} completed`, value: `${completed}/${totalTasks}`, action: null },
    {
      label: `${rangeLabel} absences`,
      value: String(absenceCount),
      action: onViewAbsences,
    },
    { label: `${rangeLabel} success`, value: `${success}%`, action: null },
    { label: "Current streak", value: `${streak} days`, action: null },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {cards.map((card) => (
        <Card
          key={card.label}
          className={card.action ? "cursor-pointer transition hover:border-blue-300 hover:shadow-md" : undefined}
          onClick={card.action ?? undefined}
          role={card.action ? "button" : undefined}
          tabIndex={card.action ? 0 : undefined}
          onKeyDown={
            card.action
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    card.action?.();
                  }
                }
              : undefined
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">{card.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
            {card.action ? (
              <p className="mt-1 text-[11px] text-blue-700">Tap to view absence dates</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { stats, loading } = useStats();
  const setWeeklyAbsencesOpen = useUiStore((state) => state.setWeeklyAbsencesOpen);
  const absencesRange = useUiStore((state) => state.absencesRange);
  const [activeTab, setActiveTab] = useState<RangeKey>("weekly");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const rangeData = useMemo(() => {
    if (!stats) return null;

    return {
      weekly: stats.ranges.weekly,
      monthly: stats.ranges.monthly,
      yearly: stats.ranges.yearly,
    };
  }, [stats]);

  const renderCharts = (range: RangeKey) => {
    if (!stats || !rangeData) return null;

    const rangeStats = rangeData[range];
    const absenceSummary = stats.attendanceAbsences[range];
    const gaugeData = [{ name: "Success", value: rangeStats.successRatio, fill: "#10B981" }];

    return (
      <>
        <StatsCards
          range={range}
          totalSeconds={stats.today.totalSeconds}
          completed={rangeStats.tasksCompleted}
          totalTasks={rangeStats.totalTasks}
          absenceCount={absenceSummary.count}
          success={rangeStats.successRatio}
          streak={stats.today.streak}
          onViewAbsences={() => setWeeklyAbsencesOpen(true, range)}
        />

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Weekly hours breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                {!mounted ? <Skeleton className="h-full w-full" /> : null}
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.charts.weeklyHours}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="hours" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Success ratio gauge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                {!mounted ? <Skeleton className="h-full w-full" /> : null}
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={20} data={gaugeData} startAngle={180} endAngle={0}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar background dataKey="value" cornerRadius={10} />
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 text-xl font-semibold">
                        {`${rangeStats.successRatio}%`}
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Task completion trend (last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              {!mounted ? <Skeleton className="h-full w-full" /> : null}
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.charts.completionTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const point = payload[0]?.payload as {
                          ratio: number;
                          assigned: number;
                          completed: number;
                          excused: number;
                          missed: number;
                        };
                        if (!point) return null;
                        return (
                          <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-sm">
                            <p className="font-semibold text-slate-900">{label}</p>
                            <p className="mt-1 text-slate-700">Completion: {point.ratio}%</p>
                            <p className="text-slate-600">
                              Done {point.completed}/{point.assigned}
                            </p>
                            <p className="text-slate-600">Excused: {point.excused}</p>
                            <p className="text-rose-700">Missed (no reason): {point.missed}</p>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="ratio" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly hours trend (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              {!mounted ? <Skeleton className="h-full w-full" /> : null}
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.charts.monthlyHours}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#6366F1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-600">{getTodayLabel()}</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <TrendingUp className="h-3.5 w-3.5" /> Insights Ready
        </Badge>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RangeKey)}>
        <TabsList>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly" className="space-y-4">{renderCharts("weekly")}</TabsContent>
        <TabsContent value="monthly" className="space-y-4">{renderCharts("monthly")}</TabsContent>
        <TabsContent value="yearly" className="space-y-4">{renderCharts("yearly")}</TabsContent>
      </Tabs>

      <WeeklyAbsencesDialog summary={stats?.attendanceAbsences[absencesRange]} />
    </section>
  );
}
