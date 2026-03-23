import { Container, Separator } from '@/components/container'
import { Button } from '@/components/ui/button'

import { Hulu } from '@/components/ui/svgs/hulu'
import { PrimeVideo } from '@/components/ui/svgs/prime-video'
import { Vercel } from '@/components/ui/svgs/vercel'
import { FeatureCard, FeatureCardCIllustration, FeatureCardContent, FeatureCardDescription } from '@/components/ui/feature-card'

import Link from 'next/link'
import Image from 'next/image'
import { BERNARD_AVATAR, MESCHAC_AVATAR, SHADCN_AVATAR } from '@/lib/const'

export function TestimonialsSection() {
    return (
        <section>
            <Container className="py-16 lg:py-24">
                <div className="mx-auto w-full max-w-5xl px-6 xl:px-0">
                    <div className="mx-auto max-w-2xl space-y-6 text-center">
                        <h2 className="text-foreground text-balance text-4xl font-semibold lg:text-5xl">What our customers are saying about Tailark Quartz</h2>
                        <p className="text-muted-foreground text-balance text-lg">Join the increasing number of customers and advocates who rely on Tailark for seamless and effective user A/B testing.</p>
                    </div>
                </div>
            </Container>
            <Container
                asGrid
                className="@4xl:grid-cols-23">
                <div className="@max-4xl:hidden col-span-2">
                    <div data-grid-content />
                </div>

                <div className="@4xl:col-span-19 relative">
                    <FeatureCard>
                        <FeatureCardContent className="bg-card! relative">
                            <div className="z-1 relative">
                                <div className="max-w-md">
                                    <PrimeVideo className="mb-8 h-8 w-24" />
                                    <FeatureCardDescription className="text-2xl font-normal">
                                        Prime implemented our streaming optimization suite to <span className="text-foreground font-medium">reduce buffering by 62% during peak viewing hours.</span>
                                    </FeatureCardDescription>

                                    <Button
                                        className="mt-8"
                                        variant="outline"
                                        size="sm"
                                        asChild>
                                        <Link href="#">Read Case Study</Link>
                                    </Button>
                                </div>

                                <p className='mt-12 max-w-lg text-xl before:mr-1 before:font-serif before:content-["\201C"] after:ml-1 after:font-serif after:content-["\201D"]'>Using Tailark has been like unlocking a secret design superpower. It's the perfect fusion of simplicity and versatility, enabling us to create UIs that are as stunning as they are user-friendly.</p>
                            </div>
                            <div className="dither mask-radial-from-35% mask-radial-at-right mask-radial-[100%_90%] absolute inset-y-1 left-1/3 right-1 overflow-hidden rounded-xl">
                                <Image
                                    src="https://res.cloudinary.com/dohqjvu9k/image/upload/v1759211705/grid-2-testimonial-bg_rt6glq.webp"
                                    alt="testimonial background"
                                    className="size-full object-cover contrast-150"
                                    width={1974}
                                    height={1481}
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1520px"
                                />
                            </div>

                            <div className="mask-radial-from-35% mask-b-from-65% mask-radial-at-bottom-right mask-radial-[100%_90%] absolute inset-y-1 left-1/3 right-1 overflow-hidden rounded-xl opacity-75">
                                <Image
                                    src="https://res.cloudinary.com/dohqjvu9k/image/upload/v1759211705/grid-2-testimonial-bg_rt6glq.webp"
                                    alt="testimonial background"
                                    className="size-full object-cover"
                                    width={1974}
                                    height={1481}
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1520px"
                                />
                            </div>
                        </FeatureCardContent>

                        <FeatureCardCIllustration className="@4xl:px-0 @4xl:pb-0 @4xl:pt-0 px-0 pb-0 pt-0">
                            <div className="bg-card @4xl:px-12 grid w-full grid-cols-[1fr_auto] p-6">
                                <div className="grid grid-cols-[auto_1fr] items-center gap-3 pl-px">
                                    <div className="ring-foreground/10 aspect-square size-10 overflow-hidden rounded-lg border border-transparent shadow-md shadow-black/15 ring-1">
                                        <img
                                            src={SHADCN_AVATAR}
                                            alt="Shadcn"
                                            width={460}
                                            height={460}
                                        />
                                    </div>

                                    <div className="text-base *:block">
                                        <span className="text-foreground font-medium">Shadcn</span>
                                        <span className="text-muted-foreground text-sm">Design Engineer</span>
                                    </div>
                                </div>
                            </div>
                        </FeatureCardCIllustration>
                    </FeatureCard>
                </div>

                <div className="@max-4xl:hidden col-span-2">
                    <div data-grid-content />
                </div>
            </Container>

            <Separator className="h-12" />

            <Container
                asGrid
                className="@2xl:grid-cols-2 @4xl:grid-cols-23">
                <div className="@max-4xl:hidden col-span-2">
                    <div data-grid-content />
                </div>

                <div className="@4xl:col-span-9 relative">
                    <FeatureCard>
                        <FeatureCardContent className="bg-card!">
                            <p className='text-lg before:mr-1 before:font-serif before:content-["\201C"] after:ml-1 after:font-serif after:content-["\201D"] lg:text-xl'>Tailus has transformed the way I develop web applications. Their extensive collection of UI components, blocks, and templates has significantly accelerated my workflow. The flexibility to customize every aspect allows me to create unique user experiences.</p>
                        </FeatureCardContent>

                        <FeatureCardCIllustration className="@4xl:px-0 @4xl:pb-0 @4xl:pt-0 px-0 pb-0 pt-0">
                            <div className="bg-card @4xl:px-12 grid w-full grid-cols-[1fr_auto] p-6">
                                <div className="grid grid-cols-[auto_1fr] items-center gap-3 pl-px">
                                    <div className="ring-foreground/10 aspect-square size-10 overflow-hidden rounded-lg border border-transparent shadow-md shadow-black/15 ring-1">
                                        <img
                                            src={MESCHAC_AVATAR}
                                            alt=""
                                        />
                                    </div>
                                    <div className="text-base *:block">
                                        <span className="text-foreground font-medium">Méschac Irung</span>
                                        <span className="text-muted-foreground text-sm">Backend Engineer</span>
                                    </div>
                                </div>

                                <div>
                                    <Hulu className="h-7 w-16" />
                                </div>
                            </div>
                        </FeatureCardCIllustration>
                    </FeatureCard>
                </div>

                <div className="@max-4xl:hidden">
                    <div data-grid-content />
                </div>

                <div className="@4xl:col-span-9">
                    <FeatureCard className="grid-rows-[1fr_auto]">
                        <FeatureCardContent className="bg-background!">
                            <p className='text-lg before:mr-1 before:font-serif before:content-["\201C"] after:ml-1 after:font-serif after:content-["\201D"] lg:text-xl'>Their extensive collection of UI components, blocks, and templates has significantly accelerated my workflow. The flexibility to customize every aspect allows me to create unique user experiences.</p>
                        </FeatureCardContent>

                        <FeatureCardCIllustration className="bg-background! @4xl:px-0 @4xl:pb-0 @4xl:pt-0 px-0 pb-0 pt-0">
                            <div className="border-foreground/10 @3xl:px-12 relative grid w-full grid-cols-[1fr_auto] p-6">
                                <div className="relative grid grid-cols-[auto_1fr] items-center gap-3 pl-px">
                                    <div className="ring-foreground/10 aspect-square size-10 overflow-hidden rounded-lg border border-transparent shadow-md shadow-black/15 ring-1">
                                        <img
                                            src={BERNARD_AVATAR}
                                            alt=""
                                        />
                                    </div>
                                    <div className="text-base *:block">
                                        <span className="text-foreground font-medium">Bernard Ngandu</span>
                                        <span className="text-foreground/65 text-sm">Backend Engineer</span>
                                    </div>
                                </div>

                                <div className="relative">
                                    <Vercel className="size-7" />
                                </div>
                            </div>
                        </FeatureCardCIllustration>
                    </FeatureCard>
                </div>

                <div className="@max-4xl:hidden col-span-2">
                    <div data-grid-content />
                </div>
            </Container>
            <Separator className="h-12" />
        </section>
    )
}