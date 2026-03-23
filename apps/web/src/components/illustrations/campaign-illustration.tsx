export const CampaignIllustration = () => (
    <div
        aria-hidden
        className="relative z-10 w-full text-xs">
        <div className="mb-6 flex gap-2">
            <span className="size-2.5 rounded-full border"></span>
            <span className="size-2.5 rounded-full border"></span>
            <span className="size-2.5 rounded-full border"></span>
        </div>

        <div>
            <div className="mb-0.5 text-base font-medium">Compaign</div>
            <div className="mb-4 flex gap-2 text-sm">
                <span>Loyalty program</span>
                <span className="text-muted-foreground">loyalty program</span>
            </div>

            <div className="@sm:grid-cols-2 mb-4 grid gap-2">
                <div className="bg-illustration ring-border-illustration flex gap-2 rounded-md p-2 shadow-md shadow-black/5 ring-1">
                    <div className="bg-primary w-1 rounded-full"></div>

                    <div>
                        <div className="text-sm font-medium">Start Date</div>
                        <div className="text-muted-foreground line-clamp-1">Feb 6, 2024 at 00:00</div>
                    </div>
                </div>
                <div className="bg-illustration ring-border-illustration flex gap-2 rounded-md p-2 shadow-md shadow-black/5 ring-1">
                    <div className="bg-primary w-1 rounded-full"></div>

                    <div>
                        <div className="text-sm font-medium">Start Date</div>
                        <div className="text-muted-foreground line-clamp-1">Feb 6, 2024 at 00:00</div>
                    </div>
                </div>
            </div>

            <p className="text-muted-foreground">
                Connected to 12 <span className="text-foreground font-medium">Marketing Campaigns</span>.
            </p>
        </div>
    </div>
)