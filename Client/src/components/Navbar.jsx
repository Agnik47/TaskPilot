import { PanelLeft } from 'lucide-react'
import NavbarSearch from './NavbarSearch'
import NotificationBell from './NotificationBell'
import { useDispatch, useSelector } from 'react-redux'
import { toggleTheme } from '../features/themeSlice'
import { MoonIcon, SunIcon } from 'lucide-react'
import { UserButton } from '@clerk/clerk-react'

const Navbar = ({ setIsSidebarOpen }) => {

    const dispatch = useDispatch();
    const { theme } = useSelector(state => state.theme);

    return (
        <div className="w-full bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 xl:px-16 py-3 flex-shrink-0">
            <div className="flex items-center justify-between max-w-6xl mx-auto">
                {/* Left section */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Sidebar Trigger */}
                    <button onClick={() => setIsSidebarOpen((prev) => !prev)} className="sm:hidden p-2 rounded-lg transition-colors text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-800" >
                        <PanelLeft size={20} />
                    </button>

                    <NavbarSearch />
                </div>

                {/* Right section */}
                <div className="flex items-center gap-3">

                    <NotificationBell />

                    {/* Theme Toggle */}
                    <button onClick={() => dispatch(toggleTheme())} className="size-8 flex items-center justify-center bg-white dark:bg-zinc-800 shadow rounded-lg transition hover:bg-gray-100 dark:hover:bg-zinc-700">
                        {
                            theme === "light"
                                ? (<MoonIcon className="size-4 text-gray-800 dark:text-gray-200" />)
                                : (<SunIcon className="size-4 text-yellow-400" />)
                        }
                    </button>

                    {/* User Button */}
                    <UserButton />
                </div>
            </div>
        </div>
    )
}

export default Navbar
