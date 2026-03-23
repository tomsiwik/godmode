export const VisualizationIllustration = () => {
    return (
        <div
            aria-hidden
            className="w-full [--color-primary:var(--color-amber-500)]">
            <div className="mb-6 flex gap-2">
                <span className="size-2.5 rounded-full border" />
                <span className="size-2.5 rounded-full border" />
                <span className="size-2.5 rounded-full border" />
            </div>

            <div className="relative z-10 rounded-xl">
                <div className="text-foreground font-medium">Spending Limit</div>
                <div className="text-muted-foreground mt-0.5 text-sm">New users by First user primary channel group</div>

                <div className="relative my-6 grid grid-cols-[auto_1fr] gap-3 border-l">
                    <div className="h-full w-2 bg-[repeating-linear-gradient(var(--color-border),var(--color-border)_1px,transparent_1px,transparent_9px)]" />

                    <div className="**:rounded space-y-3">
                        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <div className="bg-linear-to-l from-primary inset-ring-foreground/10 inset-ring-1 shadow-black/7 h-5 w-full to-purple-500 p-0.5 shadow-md">
                                <div className="h-full bg-[repeating-linear-gradient(-45deg,var(--color-foreground),var(--color-foreground)_1px,transparent_1px,transparent_4px)] opacity-5" />
                            </div>

                            <span className="text-muted-foreground text-xs">32k</span>
                        </div>

                        <div className="grid w-2/3 grid-cols-[1fr_auto] items-center gap-2">
                            <div className="bg-card h-5 rounded-r-md border border-indigo-400 p-0.5">
                                <div className="h-full bg-[repeating-linear-gradient(-45deg,var(--color-indigo-400),var(--color-indigo-400)_1px,transparent_1px,transparent_4px)]" />
                            </div>

                            <span className="text-muted-foreground text-xs">22k</span>
                        </div>

                        <div className="grid w-2/5 grid-cols-[1fr_auto] items-center gap-2">
                            <div className="bg-card h-5 rounded-r-md border p-0.5">
                                <div className="h-full bg-[repeating-linear-gradient(-45deg,var(--color-foreground),var(--color-foreground)_1px,transparent_1px,transparent_4px)] opacity-15" />
                            </div>

                            <span className="text-muted-foreground text-xs">12k</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-1 border-t border-dashed pt-6">
                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <div className="size-1.5 rounded-full bg-indigo-500" />

                        <div className="line-clamp-1 text-sm font-medium">
                            Running <span className="text-muted-foreground">(20%)</span> average of 12 Minutes
                        </div>
                    </div>

                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <div className="bg-primary size-1.5 rounded-full" />

                        <div className="line-clamp-1 text-sm font-medium">
                            Swimming <span className="text-muted-foreground">(20%)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}