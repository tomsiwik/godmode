import { CalendarDays, Check, Clock2, Zap, TrendingUp } from 'lucide-react'
import { Container } from '@godmode-cli/ui'
import { FeatureCard, FeatureCardContent } from '@godmode-cli/ui'
import { Button } from '@godmode-cli/ui'
const Link = 'a' as any
import { EnterpriseMessageIllustration } from '@/components/illustrations/enterprise-message-illustration'

const subFeatures = [
    {
        icon: Clock2,
        title: 'Time Management',
        description: 'Effectively manage your time with precision and speed using our tools.',
    },
    {
        icon: Zap,
        title: 'Instant Performance',
        description: 'Experience lightning-fast processing and quick responses.',
    },
    {
        icon: CalendarDays,
        title: 'Schedule Management',
        description: 'Organize your tasks seamlessly with our integrated calendar.',
    },
    {
        icon: CalendarDays,
        title: 'Event Planning',
        description: 'Plan and keep track of your events effortlessly.',
    },
]

export function EnterpriseFeatures() {
    return (
        <section>
            <Container className="py-16 lg:py-24">
                <div className="mx-auto max-w-2xl space-y-6 text-center">
                    <h2 className="text-foreground text-balance text-4xl font-semibold lg:text-5xl">Enterprise Grade Security</h2>
                    <p className="text-muted-foreground text-balance text-lg">Tailark is built with the highest level of security in mind, ensuring that your data is protected from breaches and unauthorized access.</p>
                </div>
            </Container>
            <Container asGrid>
                <div className="@2xl:grid-cols-2 @4xl:grid-cols-10 grid gap-px">
                    <div
                        aria-hidden
                        className="@max-4xl:hidden">
                        <div data-grid-content />
                    </div>
                    <div className="@4xl:col-span-4">
                        <FeatureCard className="@4xl:col-span-2 col-span-full grid-rows-1">
                            <FeatureCardContent className="@4xl:pb-12 flex h-full flex-col space-y-6">
                                <div className="bg-card ring-foreground/3 flex size-12 rounded-full shadow-xl shadow-black/5 ring-1">
                                    <TrendingUp className="text-muted-foreground m-auto size-4" />
                                </div>
                                <h3 className="text-2xl font-semibold">Scale to Infinity</h3>
                                <p className="text-muted-foreground text-balance">Tailark is built to handle the largest volumes of transactions with ease, ensuring that your business can scale to any size.</p>
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
                                    color="outline"
                                    size="sm"
                                    className="mt-auto w-fit">
                                    <Link href="#">Learn more</Link>
                                </Button>
                            </FeatureCardContent>
                        </FeatureCard>
                    </div>
                    <div className="@4xl:col-span-4">
                        <EnterpriseMessageIllustration />
                    </div>
                    <div
                        aria-hidden
                        className="@max-4xl:hidden">
                        <div data-grid-content />
                    </div>
                </div>
            </Container>
            <Container
                asGrid
                className="@4xl:**:data-grid-content:p-8 **:data-grid-content:p-6 @5xl:**:data-grid-content:p-12 @4xl:grid-cols-10 grid-cols-2">
                <div
                    aria-hidden
                    className="@max-4xl:hidden">
                    <div data-grid-content />
                </div>
                <div className="@4xl:grid-cols-3 @sm:grid-cols-2 col-span-8 grid gap-px">
                    {subFeatures.map((feature, index) => (
                        <div
                            key={index}
                            className="@4xl:last:hidden">
                            <div
                                data-grid-content
                                className="space-y-3">
                                <feature.icon className="size-4" />
                                <h3 className="mt-3 font-medium">{feature.title}</h3>
                                <p className="text-muted-foreground line-clamp-2 text-sm">{feature.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div
                    aria-hidden
                    className="@max-4xl:hidden">
                    <div data-grid-content />
                </div>
            </Container>
        </section>
    )
}