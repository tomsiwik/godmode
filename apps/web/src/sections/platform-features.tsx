import { InvoiceIllustration } from '@/components/illustrations/invoice-illustration'
import { FlowIllustration } from '@/components/illustrations/flow-illustration'
import { Container, Separator } from '@godmode-cli/ui'
import { FeatureCard, FeatureCardContent } from '@godmode-cli/ui'
import { CreditCardIllustration } from '@/components/illustrations/credit-card-illustration'
import { VercelWordmark as VercelFull } from '@/components/svgs/vercel'

import { Button } from '@godmode-cli/ui'
const Link = 'a' as any
import { Check, CreditCard, ScanFace, Scroll } from 'lucide-react'
import { MESCHAC_AVATAR } from '@/lib/const'

export function PlatformFeatures() {
    return (
        <section>
            <Container
                asGrid
                className="@4xl:grid-cols-4 grid-cols-2">
                <FeatureCard className="@4xl:col-span-2 col-span-full grid-rows-1">
                    <FeatureCardContent className="flex h-full flex-col space-y-6">
                        <div className="bg-card ring-foreground/3 flex size-12 rounded-full shadow-xl shadow-black/5 ring-1">
                            <Scroll className="text-muted-foreground m-auto size-4" />
                        </div>

                        <h2 className="text-2xl font-semibold">Innovative Invoicing Solutions</h2>

                        <p className="text-muted-foreground text-balance">
                            Elevate your business with our <strong className="text-foreground font-semibold">streamlined invoicing</strong> tools designed to optimize financial operations and enhance productivity.
                        </p>

                        <ul className="w-full space-y-2">
                            {['Automated Invoice Processing', 'Real-time Payment Tracking', 'Multi-currency Support'].map((feature, index) => (
                                <li
                                    key={index}
                                    className="text-muted-foreground flex items-center gap-2">
                                    <Check className="size-4 text-emerald-500" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="mt-auto w-fit">
                            <Link href="#">Learn more</Link>
                        </Button>
                    </FeatureCardContent>
                </FeatureCard>

                <div className="@4xl:col-span-2 col-span-full">
                    <div className="mx-auto self-center">
                        <InvoiceIllustration />
                    </div>
                </div>
            </Container>

            <Separator className="h-24" />

            <Container
                asGrid
                className="@4xl:grid-cols-4 grid-cols-2">
                <div className="@4xl:col-span-2 col-span-full">
                    <div className="mx-auto self-center">
                        <FlowIllustration />
                    </div>
                </div>

                <FeatureCard className="@max-4xl:row-start-1 @4xl:col-span-2 col-span-full grid-rows-1">
                    <FeatureCardContent className="flex h-full flex-col space-y-6">
                        <div className="bg-card ring-foreground/3 flex size-12 rounded-full shadow-xl shadow-black/5 ring-1">
                            <ScanFace className="text-muted-foreground m-auto size-4" />
                        </div>

                        <h2 className="text-2xl font-semibold">Secure ID Verification</h2>

                        <p className="text-muted-foreground text-balance">
                            Ensure the safety and security of your operations with our <strong className="text-foreground font-semibold">comprehensive ID verification</strong> solutions.
                        </p>

                        <ul className="w-full space-y-2">
                            {['Instant Identity Checks', 'Fraud Prevention', 'Global Coverage'].map((feature, index) => (
                                <li
                                    key={index}
                                    className="text-muted-foreground flex items-center gap-2">
                                    <Check className="size-4 text-emerald-500" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="mt-auto w-fit">
                            <Link href="#">Learn more</Link>
                        </Button>
                    </FeatureCardContent>
                </FeatureCard>
            </Container>

            <Separator className="h-24" />

            <Container
                asGrid
                className="@4xl:grid-cols-4 grid-cols-2">
                <FeatureCard className="@4xl:col-span-2 col-span-full grid-rows-1">
                    <FeatureCardContent className="flex h-full flex-col space-y-6">
                        <div className="bg-card ring-foreground/3 flex size-12 rounded-full shadow-xl shadow-black/5 ring-1">
                            <CreditCard className="text-muted-foreground m-auto size-4" />
                        </div>

                        <h2 className="text-2xl font-semibold">Comprehensive Payment Solutions</h2>

                        <p className="text-muted-foreground text-balance">
                            Streamline your transactions with our <strong className="text-foreground font-semibold">cutting-edge payment processing</strong> tools designed to enhance efficiency and security.
                        </p>

                        <ul className="w-full space-y-2">
                            {['Secure Credit Card Transactions', 'Instant Payment Notifications', 'Flexible Payment Options'].map((feature, index) => (
                                <li
                                    key={index}
                                    className="text-muted-foreground flex items-center gap-2">
                                    <Check className="size-4 text-emerald-500" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="mt-auto w-fit">
                            <Link href="#">Learn more</Link>
                        </Button>
                    </FeatureCardContent>
                </FeatureCard>

                <div className="@4xl:col-span-2 col-span-full">
                    <CreditCardIllustration />
                </div>
            </Container>

            <Separator className="h-24" />

            <Container className="bg-background border-dashed">
                <div className="mx-auto max-w-2xl p-6 md:py-12 lg:py-20">
                    <VercelFull className="h-6 w-24" />

                    <div className="mt-6 lg:mt-12">
                        <p className='text-xl *:leading-relaxed before:mr-1 before:content-["\201C"] after:ml-1 after:content-["\201D"] md:text-2xl'>Using Tailark has been like unlocking a secret design superpower. It's the perfect fusion of simplicity and versatility, enabling us to create UIs that are as stunning as they are user-friendly.</p>

                        <div className="mt-12 flex items-center gap-3">
                            <div className="ring-foreground/10 aspect-square size-10 overflow-hidden rounded-lg border border-transparent shadow-md shadow-black/15 ring-1">
                                <img
                                    src={MESCHAC_AVATAR}
                                    alt=""
                                />
                            </div>

                            <div className="space-y-px">
                                <p className="text-sm font-medium">Méschac Irung</p>
                                <p className="text-muted-foreground text-xs">Founder & CEO, Stripe</p>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>

            <Separator className="h-24" />
        </section>
    )
}