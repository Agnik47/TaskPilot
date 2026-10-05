import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useUser } from '@clerk/clerk-react'
import { format } from 'date-fns'
import WorkspaceStats from '../components/home/WorkspaceStats'
import MyTasksCard from '../components/home/MyTasksCard'
import HomeProjects from '../components/home/HomeProjects'
import ReviewQueue from '../components/review/ReviewQueue'
import WaitingOnYou from '../components/blockers/WaitingOnYou'
import MyChecklistItems from '../components/checklist/MyChecklistItems'
import RecentActivity from '../components/RecentActivity'
import CreateProjectDialog from '../components/CreateProjectDialog'
import useOrgRole from '../hooks/useOrgRole'
import { groupTasks, selectTasks } from '../lib/myWork'

const greeting = (hour) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`

// One sentence on where your day stands, most pressing first.
function daySummary(groups, toReview) {
    const parts = [
        toReview > 0 && `${count(toReview, 'task is', 'tasks are')} waiting for your review`,
        groups.overdue.length > 0 && `${count(groups.overdue.length, 'task is', 'tasks are')} overdue`,
        groups.today.length > 0 && `${groups.today.length} due today`,
    ].filter(Boolean)
    if (parts.length) return `${parts.join(', ')}.`
    const upcoming = groups.week.length
    return upcoming > 0 ? `Nothing is due today. ${count(upcoming, 'task is', 'tasks are')} due in the next 7 days.` : "Nothing is due today. You're all caught up."
}

const Dashboard = () => {

    const { user } = useUser()
    const { isOwner } = useOrgRole()
    const projects = useSelector((state) => state.workspace.projects)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const summary = useMemo(() => {
        const toReview = isOwner ? projects.flatMap((p) => p.tasks || []).filter((t) => t.status === 'IN_REVIEW').length : 0
        return daySummary(groupTasks(selectTasks(projects, user?.id, 'mine')), toReview)
    }, [projects, user?.id, isOwner])

    const now = new Date()

    return (
        <div className='max-w-6xl mx-auto'>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">{format(now, 'EEEE, d MMMM')}</p>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                        {greeting(now.getHours())}, {user?.firstName || user?.fullName || 'there'}
                    </h1>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">{summary}</p>
                </div>

                {isOwner && (
                    <>
                        <button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2 px-5 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition" >
                            <Plus size={16} /> New Project
                        </button>
                        <CreateProjectDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
                    </>
                )}
            </div>

            {isOwner && <WorkspaceStats />}

            <div className="grid lg:grid-cols-3 gap-8 items-start">
                {/* What needs you, most pressing first */}
                <div className="lg:col-span-2 min-w-0">
                    <ReviewQueue />
                    <WaitingOnYou />
                    <MyTasksCard />
                    <MyChecklistItems me={user?.id} />
                </div>

                {/* Context */}
                <div className="space-y-8 min-w-0">
                    <HomeProjects />
                    <RecentActivity />
                </div>
            </div>
        </div>
    )
}

export default Dashboard
