// The panel surface used across project tabs, with an optional header row.
export default function Card({ title, icon: Icon, hint, action, className = "", children }) {
    return (
        <section className={`not-dark:bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg p-4 sm:p-5 ${className}`}>
            {(title || action) && (
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 font-medium text-zinc-900 dark:text-white">
                            {Icon && <Icon className="size-4 text-zinc-500 dark:text-zinc-400" />} {title}
                        </h2>
                        {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
                    </div>
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}
