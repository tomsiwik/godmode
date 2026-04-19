'use client'
const Link = 'a' as any
import { Button } from '@/components/ui/button'
import React from 'react'
import { Sun, Moon } from 'lucide-react'

// lucide-react removed brand icons in v1.x (trademark). Inline SVG here.
const GithubIcon = ({ className }: { className?: string }) => (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
)
import { cn } from '@/lib/utils'
import { Container } from '@/components/container'

export interface HeaderProps {
    githubUrl?: string
    docsUrl?: string
    title?: string
}

export default function Header({
    githubUrl = 'https://github.com/tomsiwik/godmode',
    docsUrl = '/docs',
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
                                    <GithubIcon className="size-4" />
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
