import { CalendarDays, Clock2, Database, Globe2, Zap } from 'lucide-react'
import { MapIllustration } from '@/components/illustrations/map-illustration'
import { VisualizationIllustration } from '@/components/illustrations/visualization-illustration'
import { Container } from '@/components/container'
import { FeatureCard, FeatureCardDescription, FeatureCardCIllustration, FeatureCardContent, FeatureCardTitle } from '@/components/ui/feature-card'

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

export function AnalyticsFeatures() {
    return (
        <section className="overflow-hidden">
            <Container className="py-16 lg:py-24">
                <div className="mx-auto max-w-2xl space-y-6 text-center">
                    <h2 className="text-foreground text-balance text-4xl font-semibold lg:text-5xl">Transform your data into visual insights</h2>
                    <p className="text-muted-foreground text-balance text-lg">Our powerful analytics platform helps you visualize complex data, identify trends, and make data-driven decisions with confidence.</p>
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
                        <FeatureCard>
                            <FeatureCardContent>
                                <FeatureCardTitle>
                                    <Globe2 className="size-4" />
                                    Global Data Visualization
                                </FeatureCardTitle>
                                <FeatureCardDescription>
                                    <span className="text-foreground">Visualize data globally.</span> Utilize interactive maps to enhance your data insights.
                                </FeatureCardDescription>
                            </FeatureCardContent>
                            <FeatureCardCIllustration className="@4xl:px-0 relative px-0">
                                <div className="mask-radial-from-35% @4xl:-mx-32 relative w-full self-center">
                                    <MapIllustration />
                                </div>
                            </FeatureCardCIllustration>
                        </FeatureCard>
                    </div>

                    <div className="@4xl:col-span-4">
                        <FeatureCard>
                            <FeatureCardContent>
                                <FeatureCardTitle>
                                    <Database className="size-4" />
                                    Advanced Analytics Engine
                                </FeatureCardTitle>
                                <FeatureCardDescription>
                                    <span className="text-foreground">Leverage advanced analytics.</span> Collaborate on data-driven strategies with precision.
                                </FeatureCardDescription>
                            </FeatureCardContent>
                            <FeatureCardCIllustration>
                                <VisualizationIllustration />
                            </FeatureCardCIllustration>
                        </FeatureCard>
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