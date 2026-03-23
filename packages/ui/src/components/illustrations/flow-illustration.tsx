import { ScanIllustration } from '@/components/illustrations/scan-illustration'
import { ShieldCheck } from 'lucide-react'
import Image from 'next/image'

export const FlowIllustration = () => {
    return (
        <div
            aria-hidden
            className="relative">
            <div className="grid grid-cols-4 gap-px">
                <div className="grid grid-rows-3 gap-y-px">
                    <div data-grid-content />

                    <div
                        data-grid-content
                        className="p-6! flex">
                        <div className="bg-radial mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] relative my-auto aspect-square size-fit opacity-75 group-hover:opacity-95">
                            <Image
                                src="https://res.cloudinary.com/dohqjvu9k/image/upload/v1757918276/portrait_vsoxqd.jpg"
                                alt="tailark hero section portrait"
                                className="size-full object-cover"
                                width={200}
                                height={133}
                            />
                        </div>
                    </div>

                    <div data-grid-content />
                </div>

                <div className="col-span-2 space-y-px">
                    <div
                        data-grid-content
                        className="h-fit! p-6!">
                        <div className="w-full space-y-1 text-sm [--color-border:color-mix(in_oklab,var(--color-foreground)10%,transparent)]">
                            <span className="text-muted-foreground mb-3 block size-12 rounded border" />
                            <div className="grid grid-cols-[auto_1fr] items-center">
                                <span className="text-muted-foreground w-18 block">Name</span>
                                <span className="bg-border h-2 w-1/4 rounded-full px-2" />
                            </div>

                            <div className="grid grid-cols-[auto_1fr] items-center">
                                <span className="text-muted-foreground w-18 block">Email</span>
                                <span className="bg-border h-2 w-1/2 rounded-full px-2" />
                            </div>
                            <div className="grid grid-cols-[auto_1fr] items-center">
                                <span className="text-muted-foreground w-18 block">Phone</span>
                                <span className="bg-border h-2 w-3/4 rounded-full px-2" />
                            </div>
                        </div>
                    </div>

                    <div
                        data-grid-content
                        className="h-fit! p-2! relative">
                        <div className="bg-card shadow-black/6 ring-border-illustration relative rounded-xl p-6 shadow-xl ring-1">
                            <ScanIllustration />
                        </div>
                    </div>

                    <div
                        data-grid-content
                        className="h-fit! p-6!">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="size-4 fill-emerald-200 stroke-emerald-900" />
                            <span className="rounded-full text-sm">Verified</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-rows-3 gap-y-px">
                    <div data-grid-content />

                    <div
                        data-grid-content
                        className="p-6! flex">
                        <div className="bg-radial mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] relative my-auto aspect-square size-fit opacity-75 group-hover:opacity-95">
                            <Image
                                src="https://res.cloudinary.com/dohqjvu9k/image/upload/v1757918276/portrait_vsoxqd.jpg"
                                alt="tailark hero section portrait"
                                className="size-full object-cover"
                                width={200}
                                height={133}
                            />
                        </div>
                    </div>

                    <div data-grid-content />
                </div>
            </div>
        </div>
    )
}