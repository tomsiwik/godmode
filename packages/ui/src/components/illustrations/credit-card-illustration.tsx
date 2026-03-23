import { LeapWalletLight as LeapWallet } from '@/components/ui/svgs/leap-wallet'
import { Paypal as PayPal } from '@/components/ui/svgs/paypal'
import { Stripe } from '@/components/ui/svgs/stripe'

export const CreditCardIllustration = () => (
    <div
        aria-hidden
        className="grid h-full grid-cols-6 gap-px">
        <div className="*:p-2! grid grid-rows-3 gap-y-px">
            <div data-grid-content />
            <div data-grid-content />
            <div data-grid-content />
        </div>
        <div className="col-span-4 grid grid-rows-[1fr_auto_1fr] gap-y-px">
            <div data-grid-content />

            <div
                data-grid-content
                className="h-fit! p-2! relative">
                <Card />
            </div>

            <div className="grid grid-cols-3 gap-x-px">
                <div
                    data-grid-content
                    className="p-4! flex items-center justify-center">
                    <Stripe
                        height={20}
                        width={72}
                    />
                </div>
                <div
                    data-grid-content
                    className="p-4! flex items-center justify-center">
                    <PayPal
                        height={22}
                        width={72}
                    />
                </div>
                <div
                    data-grid-content
                    className="p-4! flex items-center justify-center">
                    <LeapWallet
                        height={20}
                        width={72}
                    />
                </div>
            </div>
        </div>
        <div className="*:p-2! grid grid-rows-3 gap-y-px">
            <div data-grid-content />
            <div data-grid-content />
            <div data-grid-content />
        </div>
    </div>
)

const Card = () => {
    return (
        <div className="ring-foreground/15 bg-background relative z-10 flex aspect-video w-full flex-col justify-between overflow-hidden rounded-2xl border border-transparent px-6 py-5 shadow-2xl shadow-emerald-950/15 ring-1">
            <div className="flex justify-between">
                <CardChip />
                <Visa />
            </div>

            <div className="flex justify-between">
                <div className="space-y-0.5 *:block">
                    <span className="text-muted-foreground text-xs">Méschac Irung</span>
                    <span className="font-mono text-sm font-medium">5367 4567 8901 2345</span>
                </div>
                <div className="space-y-0.5 *:block">
                    <span className="text-muted-foreground text-xs">Exp.</span>
                    <span className="font-mono text-sm font-medium">12/25</span>
                </div>
            </div>
        </div>
    )
}

const CardChip = () => {
    return (
        <svg
            width="26"
            height="22"
            viewBox="0 0 26 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
                d="M5.813 0C2.647 0 0 2.648 0 5.813V16.188C0 19.352 2.648 22 5.813 22H20.188C23.352 22 26 19.352 26 16.187V5.813C26 2.649 23.352 0 20.187 0H5.813ZM5.813 2H20.188C22.223 2 24 3.777 24 5.813V7H18C17.445 7 17 6.555 17 6C17 5.445 17.445 5 18 5C18.2652 5 18.5196 4.89464 18.7071 4.70711C18.8946 4.51957 19 4.26522 19 4C19 3.73478 18.8946 3.48043 18.7071 3.29289C18.5196 3.10536 18.2652 3 18 3C16.355 3 15 4.355 15 6C15 7.292 15.844 8.394 17 8.813V13.781C15.802 14.595 15 15.961 15 17.5C15 18.423 15.293 19.281 15.781 20H10.22C10.7254 19.264 10.9973 18.3928 11 17.5C11 15.962 10.198 14.595 9 13.781V8.812C10.156 8.394 11 7.292 11 6C11 4.355 9.645 3 8 3H6C5.96868 2.99853 5.93732 2.99853 5.906 3C5.87502 2.99856 5.84398 2.99856 5.813 3C5.54778 3.0248 5.30328 3.15394 5.13328 3.35901C4.96328 3.56408 4.8817 3.82828 4.9065 4.0935C4.9313 4.35872 5.06044 4.60322 5.26551 4.77322C5.47058 4.94322 5.73478 5.0248 6 5H8C8.555 5 9 5.445 9 6C9 6.555 8.555 7 8 7H2V5.812C2 3.777 3.777 2 5.813 2ZM2 9H7V13H2V9ZM19 9H24V13H19V9ZM2 15H6.5C7.839 15 9 16.161 9 17.5C9 18.839 7.839 20 6.5 20H5.812C3.777 20 2 18.223 2 16.187V15ZM19.5 15H24V16.188C24 18.223 22.223 20 20.187 20H19.5C18.161 20 17 18.839 17 17.5C17 16.161 18.161 15 19.5 15Z"
                fill="currentColor"
            />
        </svg>
    )
}

const Visa = () => (
    <svg
        width="50"
        height="16"
        viewBox="0 0 72 23"
        fill="none"
        xmlns="http://www.w3.org/2000/svg">
        <path
            d="M35.6495 0.413261L30.841 22.6604H25.0219L29.8376 0.413261H35.6495ZM60.1288 14.7776L63.1897 6.42214L64.9541 14.7776H60.1288ZM66.6178 22.6604H72L67.3044 0.413261H62.3374C62.3302 0.413261 62.3206 0.413261 62.3134 0.413261C61.2115 0.413261 60.2657 1.08065 59.8672 2.02829L59.86 2.04492L51.1336 22.6604H57.2409L58.4556 19.3353H65.9192L66.6178 22.6604ZM51.4337 15.3975C51.4577 9.52396 43.2259 9.20095 43.2835 6.57652C43.3028 5.7785 44.0686 4.92823 45.749 4.7121C46.0611 4.68123 46.4212 4.66223 46.7861 4.66223C48.4929 4.66223 50.111 5.04698 51.5514 5.73575L51.4865 5.70725L52.5068 0.988022C50.8912 0.368134 49.0211 0.00712515 47.067 0H47.0646C41.3126 0 37.2675 3.02819 37.2315 7.35791C37.1955 10.5595 40.1195 12.3431 42.3257 13.4119C44.5943 14.5021 45.3553 15.2027 45.3433 16.1741C45.3289 17.6704 43.538 18.3259 41.8624 18.352C41.7855 18.3544 41.6919 18.3544 41.6007 18.3544C39.5097 18.3544 37.5412 17.8343 35.8224 16.9151L35.8872 16.946L34.8333 21.8196C36.7202 22.5677 38.9072 23 41.1974 23C41.2334 23 41.2694 23 41.3054 23H41.3006C47.4126 23 51.4097 20.0146 51.4313 15.3903L51.4337 15.3975ZM27.3361 0.413261L17.9112 22.6604H11.7607L7.1227 4.90211C7.03388 4.03759 6.49853 3.31557 5.75433 2.95456L5.73993 2.94744C4.08829 2.14467 2.16778 1.49153 0.158443 1.08065L0 1.05452L0.139237 0.410885H10.0395C11.3886 0.410885 12.5097 1.38703 12.7186 2.66243L12.721 2.67668L15.172 15.5518L21.2265 0.408509L27.3361 0.413261Z"
            fill="currentColor"
        />
    </svg>
)