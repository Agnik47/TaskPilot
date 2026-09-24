import { Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";
import Layout from "./pages/Layout";
import { Toaster } from "react-hot-toast";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import ProjectDetails from "./pages/ProjectDetails";
import TaskDetails from "./pages/TaskDetails";
import Settings from "./pages/Settings";

// react-hot-toast styles toasts inline (white), so dark mode needs explicit colors.
const toastStyles = {
    light: { background: "#ffffff", color: "#18181b", border: "1px solid #e4e4e7" },
    dark: { background: "#27272a", color: "#f4f4f5", border: "1px solid #3f3f46" },
};

const App = () => {
    const theme = useSelector((state) => state.theme.theme);

    return (
        <>
            <Toaster toastOptions={{ style: { ...toastStyles[theme], fontSize: "14px", boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)" } }} />
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="team" element={<Team />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="projectsDetail" element={<ProjectDetails />} />
                    <Route path="taskDetails" element={<TaskDetails />} />
                    <Route path="settings" element={<Settings />} />
                </Route>
            </Routes>
        </>
    );
};

export default App;
