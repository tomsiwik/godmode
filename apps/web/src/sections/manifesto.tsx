'use client'
import { Plus, Minus } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Button } from '@godmode-cli/ui'
import { cn } from '@godmode-cli/ui'
import { Container } from '@godmode-cli/ui'

export function Manifesto() {
    const [isFull, setIsFull] = useState(false)
    return (
        <section>
            <Container className="border-t-0 py-16 max-lg:px-6 lg:py-24">
                <div
                    data-state={isFull ? 'full' : 'collapsed'}
                    className="relative mx-auto max-w-2xl">
                    <motion.div
                        className={cn('relative overflow-hidden', !isFull && 'mask-b-from-45%')}
                        initial={{ height: '22rem' }}
                        animate={{ height: isFull ? 'auto' : '22rem' }}
                        exit={{ height: '22rem' }}>
                        <div className="text-muted-foreground space-y-4 text-xl *:leading-relaxed md:text-2xl">
                            <p>
                                I’m honored to be with you today for your commencement from one of the <strong className="text-foreground font-medium">finest universities</strong> in the world. Truth be told, I <strong className="text-foreground font-medium">never graduated from college</strong>. And this is the closest I’ve ever gotten to a college graduation.
                            </p>
                            <p>
                                Today I want to tell you <strong className="text-foreground font-medium">three stories</strong> from my life. That’s it. No big deal. Just <strong className="text-foreground font-medium">three stories</strong>.
                            </p>
                            <p>
                                The first story is about <strong className="text-foreground font-medium">connecting the dots</strong>. I dropped out of <strong className="text-foreground font-medium">Reed College</strong> after the first six months, but then stayed around as a <strong className="text-foreground font-medium">drop-in</strong> for another 18 months or so before I really quit. So why’d I drop out?
                            </p>
                            <p>
                                It started before I was born. My <strong className="text-foreground font-medium">biological mother</strong> was a young, unwed graduate student, and she decided to put me up for <strong className="text-foreground font-medium">adoption</strong>. She felt very strongly that I should be adopted by <strong className="text-foreground font-medium">college graduates</strong>, so everything was all set for me to be adopted at birth by a{' '}
                                <strong className="text-foreground font-medium">lawyer and his wife</strong>.
                            </p>
                            <p>
                                Except that when I popped out, they decided at the last minute that they really wanted a <strong className="text-foreground font-medium">girl</strong>. So my parents, who were on a <strong className="text-foreground font-medium">waiting list</strong>, got a call in the middle of the night asking, “We’ve got an <strong className="text-foreground font-medium">unexpected baby boy</strong>. Do you want him?” They said, “
                                <strong className="text-foreground font-medium">Of course</strong>.”
                            </p>
                        </div>
                    </motion.div>
                    <div className="group relative mt-6 w-fit">
                        <CardDecorator className="group-hover:scale-115 border-primary size-2" />
                        <Button
                            onClick={() => setIsFull(!isFull)}
                            className="flex rounded pr-2.5"
                            color="ghost"
                            size="sm">
                            <span>Read {isFull ? 'Less' : 'More'}</span>
                            {isFull ? (
                                <Minus
                                    strokeWidth={2.5}
                                    className="size-3.5! opacity-50 duration-300"
                                />
                            ) : (
                                <Plus
                                    strokeWidth={2.5}
                                    className="size-3.5! opacity-50 duration-300 group-hover:rotate-90"
                                />
                            )}
                        </Button>
                    </div>
                </div>
            </Container>
        </section>
    )
}

const CardDecorator = ({ className }: { className?: string }) => (
    <>
        <span className={cn('border-primary rounded-tl-xs absolute -left-px -top-px block size-2 border-l border-t', className)}></span>
        <span className={cn('border-primary rounded-tr-xs absolute -right-px -top-px block size-2 border-r border-t', className)}></span>
        <span className={cn('border-primary rounded-bl-xs absolute -bottom-px -left-px block size-2 border-b border-l', className)}></span>
        <span className={cn('border-primary rounded-br-xs absolute -bottom-px -right-px block size-2 border-b border-r', className)}></span>
    </>
)