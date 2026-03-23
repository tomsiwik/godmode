'use client'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { TextScramble } from '@/components/ui/text-scramble'
import { cn } from '@/lib/utils'
import Image from 'next/image'

export const ScanIllustration = () => {
    const [show, setShow] = useState(false)
    const [showName, setShowName] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setShow(true)

            const hideTimer = setTimeout(() => {
                setShow(false)
                setShowName(true)
            }, 100)

            return () => clearTimeout(hideTimer)
        }, 2000)

        return () => clearTimeout(timer)
    }, [])
    return (
        <div>
            <div
                aria-hidden
                className="group relative mx-auto mt-6 w-4/6">
                <div className="absolute inset-0 animate-spin opacity-50 blur-lg duration-[3s]">
                    <div className="bg-linear-to-r/increasing animate-hue-rotate absolute inset-0 rounded-full from-pink-300 to-indigo-300"></div>
                </div>
                <div className="animate-scan absolute inset-0 z-10">
                    <div className="absolute inset-x-0 m-auto h-6 bg-white blur-xl"></div>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.5, type: 'spring' }}
                    className="aspect-2/3 absolute inset-0 z-10 m-auto w-8 border border-emerald-300/15 bg-emerald-300/15 sm:w-14">
                    <CardDecorator className="border-white! scale-125 blur-[3px]" />
                    <motion.div
                        initial={{ '--frame-color': 'white' }}
                        animate={{ '--frame-color': 'var(--color-emerald-300)' }}
                        transition={{ duration: 0.4, delay: 1.5, type: 'spring' }}>
                        <CardDecorator className="border-(--frame-color) z-10" />
                    </motion.div>
                </motion.div>

                {show && <div className="absolute inset-0 z-10 scale-150 rounded-full bg-white mix-blend-overlay blur-xl" />}

                <div className="bg-radial mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] aspect-square max-w-xs group-hover:opacity-95">
                    <Image
                        src="https://res.cloudinary.com/dohqjvu9k/image/upload/v1757918276/portrait_vsoxqd.jpg"
                        alt="tailark hero section portrait"
                        className="size-full object-cover"
                        width={200}
                        height={133}
                    />
                </div>
            </div>
            <div className="flex h-14">
                {showName && (
                    <div className="mx-auto my-auto h-fit w-full text-center">
                        <TextScramble className="text-foreground font-mono text-xs uppercase">Méschac Irung</TextScramble>
                        <TextScramble className="text-muted-foreground text-xs">CEO, Acme</TextScramble>
                    </div>
                )}
            </div>
        </div>
    )
}

export const CardDecorator = ({ className }: { className?: string }) => (
    <>
        <span className={cn('absolute -left-px -top-px block size-2.5 rounded-tl border-l-[1.5px] border-t-[1.5px] border-white', className)}></span>
        <span className={cn('absolute -right-px -top-px block size-2.5 rounded-tr border-r-[1.5px] border-t-[1.5px] border-white', className)}></span>
        <span className={cn('absolute -bottom-px -left-px block size-2.5 rounded-bl border-b-[1.5px] border-l-[1.5px] border-white', className)}></span>
        <span className={cn('absolute -bottom-px -right-px block size-2.5 rounded-br border-b-[1.5px] border-r-[1.5px] border-white', className)}></span>
    </>
)