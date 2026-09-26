import { useEffect, useMemo, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import MyTasksSidebar from './MyTasksSidebar'
import ProjectSidebar from './ProjectsSidebar'
import WorkspaceDropdown from './WorkspaceDropdown'
import { FolderOpenIcon, LayoutDashboardIcon, ListTodoIcon, SettingsIcon, UsersIcon } from 'lucide-react'
import { useSelector } from 'react-redux'
import { useUser } from '@clerk/clerk-react'
import { groupTasks, selectTasks } from '../lib/myWork'

// Overdue + due-today count for the My Work link (red when anything is overdue).
function useMyWorkBadge() {
    const { user } = useUser()
    const projects = useSelector((state) => state.workspace.projects)
    return useMemo(() => {
        const groups = groupTasks(selectTasks(projects, user?.id, 'mine'))
        return { count: groups.overdue.length + groups.today.length, urgent: groups.overdue.length > 0 }
    }, [projects, user?.id])
}

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {

    const myWork = useMyWorkBadge()
    const menuItems = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboardIcon },
        { name: 'My Work', href: '/my-work', icon: ListTodoIcon, badge: myWork.count, urgent: myWork.urgent },
        { name: 'Projects', href: '/projects', icon: FolderOpenIcon },
        { name: 'Team', href: '/team', icon: UsersIcon },
        { name: 'Settings', href: '/settings', icon: SettingsIcon },
    ]

    const sidebarRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setIsSidebarOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setIsSidebarOpen]);

    return (
        <div ref={sidebarRef} className={`z-10 bg-white dark:bg-zinc-900 min-w-68 flex flex-col h-screen border-r border-gray-200 dark:border-zinc-800 max-sm:absolute transition-all ${isSidebarOpen ? 'left-0' : '-left-full'} `} >
            <WorkspaceDropdown />
            <hr className='border-gray-200 dark:border-zinc-800' />
            <div className='flex-1 overflow-y-scroll no-scrollbar flex flex-col'>
                <div>
                    <div className='p-4'>
                        {menuItems.map((item) => (
                            <NavLink to={item.href} key={item.name} className={({ isActive }) => `flex items-center gap-3 py-2 px-4 text-gray-800 dark:text-zinc-100 cursor-pointer rounded transition-all  ${isActive ? 'bg-gray-100 dark:bg-zinc-900 dark:bg-gradient-to-br dark:from-zinc-800 dark:to-zinc-800/50  dark:ring-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60'}`} >
                                <item.icon size={16} />
                                <p className='text-sm truncate'>{item.name}</p>
                                {item.badge > 0 && (
                                    <span
                                        title={item.urgent ? 'You have overdue tasks' : 'Due today'}
                                        className={`ml-auto min-w-5 px-1.5 py-0.5 rounded-full text-[11px] font-medium text-center tabular-nums ${item.urgent ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-200'}`}
                                    >
                                        {item.badge}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                    <MyTasksSidebar />
                    <ProjectSidebar />
                </div>


            </div>

        </div>
    )
}

export default Sidebar
