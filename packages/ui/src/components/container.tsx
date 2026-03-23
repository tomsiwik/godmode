import { cn } from '@/lib/utils'

export const Container = ({ className, children, asGrid = false, props }: { className?: string; children: React.ReactNode; asGrid?: boolean; props?: React.HTMLAttributes<HTMLDivElement> }) => {
    return (
        <div
            {...props}
            className="@container grid grid-cols-[auto_1fr_auto] xl:grid-cols-[1fr_auto_1fr]">
            <Decorator />
            <div className={cn('max-w-276 xl:min-w-276 mx-auto w-full', !asGrid && 'p-[0.5px]')}>
                {asGrid ? (
                    <div className={cn('dark:bg-white/[0.12] **:data-grid-content:bg-card/90 **:data-grid-content:h-full **:data-grid-content:rounded grid *:p-[0.5px]', className)}>{children}</div>
                ) : (
                    <div
                        data-slot="content"
                        className={cn('bg-card/90 h-full rounded', className)}>
                        {children}
                    </div>
                )}
            </div>
            <Decorator />
        </div>
    )
}

export const Separator = ({ className }: { className?: string }) => {
    return (
        <Container aria-hidden>
            <div className={cn('h-16', className)} />
        </Container>
    )
}

const Decorator = ({ className }: { className?: string }) => {
    return (
        <div
            aria-hidden
            className={cn('p-[0.5px]', className)}>
            <div className="bg-card/90 h-full w-2 rounded lg:w-12 xl:w-full" />
        </div>
    )
}