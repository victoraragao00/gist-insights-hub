import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTechDashboard } from "@/hooks/useTechDashboard";
import { useDemandAreas } from "@/hooks/useDemandAreas";
import { useProjects } from "@/hooks/useProjects";
import { DashboardSkeleton } from "@/components/tech-dashboard/DashboardSkeleton";
import { FilterChips } from "@/components/tech-dashboard/FilterChips";
import { AlertCards } from "@/components/tech-dashboard/AlertCards";
import { ThroughputChart } from "@/components/tech-dashboard/ThroughputChart";
import { CycleTimeCard } from "@/components/tech-dashboard/CycleTimeCard";
import { PeopleCard } from "@/components/tech-dashboard/PeopleCard";
import { ForecastCard } from "@/components/tech-dashboard/ForecastCard";
import { ColumnTimeCard } from "@/components/tech-dashboard/ColumnTimeCard";
import { HoursCard } from "@/components/tech-dashboard/HoursCard";
import { useBlockingStalledAlert } from "@/hooks/useBlockingStalledAlert";

const PERIODS: number[] = [7, 30, 90];

export default function TechDashboardPage() {
  const [period, setPeriod] = useState<number>(30);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, error } = useTechDashboard(
    period,
    areaId ?? undefined,
    projectId ?? undefined,
  );
  const { data: areas } = useDemandAreas();
  const { data: projects } = useProjects();
  const { data: blockingStalled } = useBlockingStalledAlert();

  useEffect(() => {
    if (error) toast.error("Não foi possível carregar o Dashboard TECH");
  }, [error]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-medium">Dashboard TECH</h1>
        <div className="flex items-center gap-2">
          {PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setPeriod(d)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all",
                period === d
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/40",
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="px-6 py-4 space-y-5">
          <FilterChips
            areas={areas}
            projects={projects}
            selectedArea={areaId}
            selectedProject={projectId}
            onAreaChange={setAreaId}
            onProjectChange={setProjectId}
          />

          <AlertCards data={data.alerts} period={period} onNavigate={navigate} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ThroughputChart data={data.throughput} />
            <CycleTimeCard data={data.cycle_time} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PeopleCard data={data.people} isAdmin={data.is_admin} />
            <ForecastCard data={data.forecast} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ColumnTimeCard data={data.column_time} />
            <HoursCard data={data.hours} />
          </div>
        </div>
      )}
    </div>
  );
}
