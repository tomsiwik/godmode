import { BERNARD_AVATAR, GLODIE_AVATAR, THEO_AVATAR } from '@/lib/const'
import { Map } from '@/components/map'

export const MapIllustration = () => (
    <>
        <div
            aria-hidden
            className="absolute inset-6">
            <div className="left-18 absolute top-8 z-10 size-6 -translate-x-full rounded-full bg-white p-0.5 shadow-md shadow-black/15">
                <img
                    className="aspect-square rounded-full object-cover"
                    src={GLODIE_AVATAR}
                    alt="Glodie"
                    height="460"
                    width="460"
                />
            </div>
            <div className="absolute right-1/2 top-1/2 z-10 size-6 -translate-y-full translate-x-full rounded-full bg-white p-0.5 shadow-md shadow-black/15">
                <img
                    className="aspect-square rounded-full object-cover"
                    src={THEO_AVATAR}
                    alt="Theo"
                    height="460"
                    width="460"
                />
            </div>
            <div className="absolute right-1/4 top-1/3 z-10 size-6 -translate-y-full translate-x-full rounded-full bg-white p-0.5 shadow-md shadow-black/15">
                <img
                    className="aspect-square rounded-full object-cover"
                    src={BERNARD_AVATAR}
                    alt="Bernard"
                    height="460"
                    width="460"
                />
            </div>
        </div>
        <div
            aria-hidden
            className="isolate scale-125">
            <Map />
        </div>
    </>
)