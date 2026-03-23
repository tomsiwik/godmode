'use client'

import { AnimatePresence, motion } from 'motion/react'
import React, { useEffect, useState } from 'react'

import { Beacon } from '@/components/ui/svgs/beacon'
import { Bolt } from '@/components/ui/svgs/bolt'
import { Cisco } from '@/components/ui/svgs/cisco'
import { Hulu } from '@/components/ui/svgs/hulu'
import { OpenaiWordmarkLight as OpenAIFull } from '@/components/ui/svgs/openai'
import { PrimeVideo as Primevideo } from '@/components/ui/svgs/prime-video'
import { Stripe } from '@/components/ui/svgs/stripe'
import { SupabaseDark as Supabase } from '@/components/ui/svgs/supabase'
import { Polars } from '@/components/ui/svgs/polars'
import { VercelWordmark as VercelFull } from '@/components/ui/svgs/vercel'
import { Spotify } from '@/components/ui/svgs/spotify'
import { Paypal as PayPal } from '@/components/ui/svgs/paypal'

import { Container } from '@/components/container'

const aiLogos: React.ReactNode[] = [
    <OpenAIFull
        key="openai"
        height={22}
        width="auto"
    />,
    <Bolt
        key="bolt"
        height={18}
        width="auto"
    />,
    <Cisco
        key="cisco"
        height={30}
        width="auto"
    />,
    <Hulu
        key="hulu"
        height={18}
        width="auto"
    />,
]

const hostingLogos: React.ReactNode[] = [
    <Supabase
        key="supabase"
        height={22}
        width="auto"
    />,
    <Cisco
        key="cisco"
        height={30}
        width="auto"
    />,
    <Hulu
        key="hulu"
        height={18}
        width="auto"
    />,
    <VercelFull
        key="vercel"
        height={18}
        width="auto"
    />,
]

const paymentsLogos: React.ReactNode[] = [
    <Stripe
        key="stripe"
        height={22}
        width="auto"
    />,
    <PayPal
        key="paypal"
        height={22}
        width="auto"
    />,
    <Beacon
        key="beacon"
        height={18}
        width="auto"
    />,
    <Polars
        key="polars"
        height={22}
        width="auto"
    />,
]

const streamingLogos: React.ReactNode[] = [
    <Primevideo
        key="primevideo"
        height={26}
        width="auto"
    />,
    <Hulu
        key="hulu"
        height={18}
        width="auto"
    />,
    <Spotify
        key="spotify"
        height={22}
        width="auto"
    />,
    <Cisco
        key="cisco"
        height={30}
        width="auto"
    />,
]

const logos: Record<'ai' | 'hosting' | 'streaming' | 'payments', React.ReactNode[]> = {
    ai: aiLogos,
    hosting: hostingLogos,
    payments: paymentsLogos,
    streaming: streamingLogos,
}

type LogoGroup = keyof typeof logos

export function LogoCloud() {
    const [currentGroup, setCurrentGroup] = useState<LogoGroup>('ai')

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentGroup((prev) => {
                const groups = Object.keys(logos) as LogoGroup[]
                const currentIndex = groups.indexOf(prev)
                const nextIndex = (currentIndex + 1) % groups.length
                return groups[nextIndex]
            })
        }, 2500)

        return () => clearInterval(interval)
    }, [])

    return (
        <Container
            asGrid
            className="grid-cols-2 md:grid-cols-4">
            <div className="col-span-full">
                <div
                    data-grid-content
                    className="py-20">
                    <p
                        data-current={currentGroup}
                        className="text-muted-foreground mx-auto max-w-xl text-balance text-center md:text-lg lg:text-xl">
                        Tailark is trusted by leading teams from <span className="in-data-[current=ai]:text-indigo-500 transition-colors duration-200">Generative AI Companies,</span> <span className="in-data-[current=hosting]:text-indigo-500 transition-colors duration-200">Hosting Providers,</span> <span className="in-data-[current=payments]:text-indigo-500 transition-colors duration-200">Payments Providers,</span>{' '}
                        <span className="in-data-[current=streaming]:text-indigo-500 transition-colors duration-200">Streaming Providers</span>
                    </p>
                </div>
            </div>
            <AnimatePresence
                initial={false}
                mode="popLayout">
                {logos[currentGroup].map((logo, i) => (
                    <div key={`${currentGroup}-${i}`}>
                        <div
                            data-grid-content
                            className="bg-card!">
                            <motion.div
                                className="**:fill-foreground! flex h-24 items-center justify-center"
                                initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: -24, filter: 'blur(6px)', scale: 0.5 }}
                                transition={{ delay: i * 0.05, duration: 0.4 }}>
                                {logo}
                            </motion.div>
                        </div>
                    </div>
                ))}
            </AnimatePresence>
        </Container>
    )
}