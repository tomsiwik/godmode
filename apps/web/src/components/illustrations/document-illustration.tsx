import { Signature } from 'lucide-react'

export const DocumentIllustation = () => {
    return (
        <div
            aria-hidden
            className="bg-background ring-foreground/5 w-16 space-y-2 rounded-md p-2 shadow-md shadow-black/5 ring-1 [--color-border:color-mix(in_oklab,var(--color-foreground)15%,transparent)]">
            <div className="flex items-center gap-1">
                <div className="bg-foreground/15 size-2.5 rounded-full"></div>
                <div className="bg-foreground/15 h-[3px] w-4 rounded-full"></div>
            </div>
            <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                    <div className="bg-foreground/15 h-[3px] w-2.5 rounded-full"></div>
                    <div className="bg-foreground/15 h-[3px] w-6 rounded-full"></div>
                </div>
                <div className="flex items-center gap-1">
                    <div className="bg-foreground/15 h-[3px] w-2.5 rounded-full"></div>
                    <div className="bg-foreground/15 h-[3px] w-6 rounded-full"></div>
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="bg-foreground/15 h-[3px] w-full rounded-full"></div>
                <div className="flex items-center gap-1">
                    <div className="bg-foreground/15 h-[3px] w-2/3 rounded-full"></div>
                    <div className="bg-foreground/15 h-[3px] w-1/3 rounded-full"></div>
                </div>
            </div>

            <Signature className="ml-auto size-3" />
        </div>
    )
}