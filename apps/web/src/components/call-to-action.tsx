import { Button } from '@godmode-cli/ui'
const Link = 'a' as any
import { Container, Separator } from '@godmode-cli/ui'
const Image = 'img' as any

export function CallToAction() {
    return (
        <section className="relative">
            <Separator className="h-16" />

            <Container className="**:data-[slot=content]:py-0 **:data-[slot=content]:bg-linear-to-b **:data-[slot=content]:from-blue-400 **:data-[slot=content]:to-indigo-500 relative">

                <div
                    aria-hidden
                    className="bg-linear-to-b absolute inset-0 to-purple-600 mix-blend-lighten"
                />

                <div className="@3xl:p-20 @lg:p-8 relative overflow-hidden p-6">
                    <div className="mx-auto max-w-xl text-center">
                        <div className="relative">
                            <h2 className="text-foreground text-balance text-4xl font-semibold lg:text-5xl">Create, Sell and Grow</h2>
                            <p className="text-foreground mb-6 mt-4 text-balance text-lg">Join a community of over 1000+ companies and developers who have already discovered the power of Tailark. </p>

                            <Button
                                asChild
                                size="lg"
                                className="border-transparent px-4 text-sm shadow-xl shadow-indigo-900/40">
                                <Link href="#">Start Testing for free</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </Container>

            <Separator className="h-16" />
        </section>
    )
}