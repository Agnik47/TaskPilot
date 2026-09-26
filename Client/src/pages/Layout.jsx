import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import ApiTokenSync from '../components/ApiTokenSync'
import { Outlet, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { fetchProjects, fetchMembers, fetchWorkspaceSettings, resetWorkspace } from '../features/workspaceSlice'
import { Loader2Icon } from 'lucide-react'
import { useUser, useOrganization, SignIn } from '@clerk/clerk-react'
import WorkspaceGate from '../components/WorkspaceGate'
import SocketProvider from '../components/SocketProvider'
import NotificationListener from '../components/NotificationListener'
import InteractionSounds from '../components/InteractionSounds'
import BlockerDialogHost from '../components/blockers/BlockerDialogHost'


const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { pathname } = useLocation()
    const { loading } = useSelector((state) => state.workspace)
    const dispatch = useDispatch()
    const { user } = useUser();
    const { organization, isLoaded: isOrgLoaded } = useOrganization();

    // Initial load of theme
    useEffect(() => {
        dispatch(loadTheme())
    }, [])

    // Re-fetch workspace data whenever the active Clerk organization changes
    useEffect(() => {
        if (organization) {
            dispatch(fetchProjects())
            dispatch(fetchMembers())
            dispatch(fetchWorkspaceSettings())
        } else {
            dispatch(resetWorkspace())
        }
    }, [organization?.id])

    if (!user) {
        return (
            <div className='flex justify-center items-center h-screen bg-white dark:bg-zinc-950'>
                <SignIn />
            </div>
        )
    }

    if (!isOrgLoaded) {
        return (
            <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        )
    }

    if (!organization) {
        return (
            <>
                <ApiTokenSync />
                <WorkspaceGate />
            </>
        )
    }

    return (
        <SocketProvider>
            <ApiTokenSync />
            <NotificationListener />
            <BlockerDialogHost />
            <InteractionSounds />
            <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
                <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                <div className="flex-1 flex flex-col h-screen">
                    <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                    <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
                        {loading ? (
                            <div className='flex items-center justify-center h-full'>
                                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
                            </div>
                        ) : (
                            // Keyed on the path (not query) so switching tabs within a page doesn't re-animate.
                            <div key={pathname} className="motion-page">
                                <Outlet />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </SocketProvider>
    )
}

export default Layout
