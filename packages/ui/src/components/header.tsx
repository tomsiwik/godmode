'use client'
const Link = 'a' as any
import { Button } from '@/components/ui/button'
import React from 'react'
import { Sun, Moon, Github } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Container } from '@/components/container'

export interface HeaderProps {
    githubUrl?: string
    docsUrl?: string
    title?: string
}

export default function Header({
    githubUrl = 'https://github.com/tomsiwik/godmode',
    docsUrl = '/usage',
    title = 'godmode',
}: HeaderProps) {
    const [isScrolled, setIsScrolled] = React.useState(false)

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <header
            role="banner"
            {...(isScrolled && { 'data-scrolled': true })}
            className="fixed inset-x-0 top-0 z-50 bg-indigo-900/10">
            <div className={cn('absolute z-50 w-full transition-all duration-300')}>
                <Container className="backdrop-blur">
                    <div className="relative flex items-center justify-between px-6 h-14 lg:px-12 lg:h-[73px]">
                        <Link
                            href="/"
                            aria-label="home"
                            className="text-foreground text-lg font-semibold tracking-tight">
                            {title}
                        </Link>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <ThemeToggle />
                            <Button
                                asChild
                                color="ghost"
                                size="icon-sm"
                                aria-label="GitHub">
                                <Link
                                    href={githubUrl}
                                    target="_blank"
                                    rel="noopener noreferrer">
                                    <Github className="size-4" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                size="sm">
                                <Link href={docsUrl}>
                                    <span>Documentation</span>
                                </Link>
                            </Button>
                        </div>
                    </div>
                </Container>
            </div>
        </header>
    )
}

function ThemeToggle() {
    const [dark, setDark] = React.useState(false)

    React.useEffect(() => {
        setDark(document.documentElement.classList.contains('dark'))
    }, [])

    const toggle = () => {
        const next = !dark
        setDark(next)
        document.documentElement.classList.toggle('dark', next)
    }

    return (
        <Button
            color="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label="Toggle theme">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
    )
}
