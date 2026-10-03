import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import useOrgRole from "../hooks/useOrgRole";
import { attentionList, flow, summarize, workloadByPerson } from "../lib/analytics";
import KpiTiles from "./analytics/KpiTiles";
import AttentionList from "./analytics/AttentionList";
import FlowChart from "./analytics/FlowChart";
import WorkloadByPerson from "./analytics/WorkloadByPerson";
import Breakdown from "./analytics/Breakdown";

const RANGES = [7, 30, 90];
const RANGE_KEY = "analyticsRange";
const readSavedRange = () => {
    try {
        const saved = Number(localStorage.getItem(RANGE_KEY));
        return RANGES.includes(saved) ? saved : 30;
    } catch {
        return 30;
    }
};

// Everything here is derived from the tasks already loaded for the project.
// Employees are only sent their own tasks, so the same page reads as "the
// team" for an owner and "my work" for an employee.
const ProjectAnalytics = ({ project, tasks }) => {
    const { isOwner } = useOrgRole();
    const weekStartsOn = useSelector((state) => state.workspace.settings.weekStartsOn);
    const [rangeDays, setRangeDays] = useState(readSavedRange);
    // Fixed for the visit so ages and ranges don't shift between renders.
    const [now] = useState(() => new Date());

    const chooseRange = (days) => {
        setRangeDays(days);
        try {
            localStorage.setItem(RANGE_KEY, String(days));
        } catch {
            // storage unavailable (private mode) — the choice just won't persist
        }
    };

    const summary = useMemo(() => summarize(tasks, { rangeDays, now }), [tasks, rangeDays, now]);
    const flowData = useMemo(() => flow(tasks, { rangeDays, weekStartsOn, now }), [tasks, rangeDays, weekStartsOn, now]);
    const attention = useMemo(() => attentionList(tasks, { now }), [tasks, now]);
    const workload = useMemo(
        () => (isOwner ? workloadByPerson(tasks, (project?.members || []).map((m) => m.user), { rangeDays, now }) : []),
        [isOwner, tasks, project?.members, rangeDays, now]
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {isOwner ? "Everyone's tasks in this project." : "Your tasks in this project."}
                </p>
                <div role="tablist" aria-label="Time range" className="inline-flex p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80">
                    {RANGES.map((days) => (
                        <button
                            key={days}
                            type="button"
                            role="tab"
                            aria-selected={rangeDays === days}
                            onClick={() => chooseRange(days)}
                            className={`px-3 py-1.5 rounded text-sm transition ${rangeDays === days ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
                        >
                            {days} days
                        </button>
                    ))}
                </div>
            </div>

            <KpiTiles summary={summary} rangeDays={rangeDays} />
            <AttentionList attention={attention} now={now} />
            <FlowChart data={flowData} rangeDays={rangeDays} />
            {isOwner && <WorkloadByPerson rows={workload} rangeDays={rangeDays} />}
            <Breakdown summary={summary} />
        </div>
    );
};

export default ProjectAnalytics;
