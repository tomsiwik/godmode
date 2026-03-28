'use client'
const Link = 'a' as any
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import React from 'react'
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle } from '@/components/ui/navigation-menu'
import { Menu, X, Shield, SquareActivity, Sparkles, Cpu, Gem, ShoppingBag, BookOpen, Notebook, Croissant, Smartphone, Rocket, Cloud, Bot, Sun, Moon } from 'lucide-react'
import { useMedia } from '@/hooks/use-media'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/accordion'
import { cn } from '@/lib/utils'
import { Container } from '@/components/container'

interface FeatureLink {
    href: string
    name: string
    description?: string
    icon: React.ReactElement
}

interface MobileLink {
    groupName?: string
    links?: FeatureLink[]
    name?: string
    href?: string
}

const features: FeatureLink[] = [
    {
        href: '#ux',
        name: 'AI',
        description: 'Generate Insights and Recommendations',
        icon: <Sparkles className="stroke-foreground fill-green-500/15" />,
    },
    {
        href: '#performance',
        name: 'Performance',
        description: 'Lightning-fast load times',
        icon: <SquareActivity className="stroke-foreground fill-indigo-500/15" />,
    },
    {
        href: '#security',
        name: 'Security',
        description: 'Keep your data safe and secure',
        icon: <Shield className="stroke-foreground fill-blue-500/15" />,
    },
]

const moreFeatures: FeatureLink[] = [
    {
        href: '#ux',
        name: 'Automation',
        description: 'Automate your workflow',
        icon: <Bot className="stroke-foreground fill-yellow-500/15" />,
    },
    {
        href: '#performance',
        name: 'Scalability',
        description: 'Scale your application',
        icon: <Rocket className="stroke-foreground fill-orange-500/15" />,
    },
    {
        href: '#security',
        name: 'Backup',
        description: 'Keep your data backed up',
        icon: <Cloud className="stroke-foreground fill-teal-500/15" />,
    },
    {
        href: '#security',
        name: 'Security',
        description: 'Keep your data safe and secure',
        icon: <Shield className="stroke-foreground fill-blue-500/15" />,
    },
    {
        href: '#support',
        name: 'Partnerships',
        description: 'Get help when you need it',
        icon: <Gem className="stroke-foreground fill-pink-500/15" />,
    },
    {
        href: '#mobile',
        name: 'Mobile App',
        description: 'Get help when you need it',
        icon: <Smartphone className="stroke-foreground fill-zinc-500/15" />,
    },
]

const useCases: FeatureLink[] = [
    {
        href: '#ux',
        name: 'Marketplace',
        description: 'Find and buy AI tools',
        icon: <ShoppingBag className="stroke-foreground fill-emerald-500/25" />,
    },
    {
        href: '#security',
        name: 'API Integration',
        description: 'Integrate AI tools into your app',
        icon: <Cpu className="stroke-foreground fill-blue-500/15" />,
    },
    {
        href: '#support',
        name: 'Partnerships',
        description: 'Get help when you need it',
        icon: <Gem className="stroke-foreground fill-pink-500/15" />,
    },
    {
        href: '#mobile',
        name: 'Mobile App',
        description: 'Get help when you need it',
        icon: <Smartphone className="stroke-foreground fill-zinc-500/15" />,
    },
]

const contentLinks: FeatureLink[] = [
    { name: 'Announcements', href: '#link', icon: <BookOpen className="stroke-foreground fill-purple-500/15" /> },
    { name: 'Resources', href: '#link', icon: <Croissant className="stroke-foreground fill-red-500/15" /> },
    { name: 'Blog', href: '#link', icon: <Notebook className="stroke-foreground fill-zinc-500/15" /> },
]

const mobileLinks: MobileLink[] = [
    {
        groupName: 'Product',
        links: features,
    },
    {
        groupName: 'Solutions',
        links: [...useCases, ...contentLinks],
    },
    { name: 'Pricing', href: '#' },
    { name: 'Company', href: '#' },
]

export default function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
    const [isScrolled, setIsScrolled] = React.useState(false)
    const isLarge = useMedia('(min-width: 64rem)')

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    React.useEffect(() => {
        const originalOverflow = document.body.style.overflow

        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.body.style.overflow = originalOverflow
        }
    }, [isMobileMenuOpen])

    return (
        <header
            role="banner"
            data-state={isMobileMenuOpen ? 'active' : 'inactive'}
            {...(isScrolled && { 'data-scrolled': true })}
            className="fixed inset-x-0 top-0 z-50 bg-indigo-900/10">
            <div className={cn('absolute z-50 w-full transition-all duration-300', !isLarge && 'h-14 overflow-hidden', isMobileMenuOpen && 'bg-background/75 h-screen backdrop-blur')}>
                <Container className="backdrop-blur">
                    <div className="relative flex flex-wrap items-center justify-between px-6 lg:px-12 lg:py-5">
                        <div className="max-lg:border-foreground/5 flex justify-between gap-8 max-lg:h-14 max-lg:w-full max-lg:border-b">
                            <Link
                                href="/"
                                aria-label="home"
                                className="flex items-center space-x-2">
                                <Logo />
                            </Link>

                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                aria-label={isMobileMenuOpen == true ? 'Close Menu' : 'Open Menu'}
                                className="relative z-20 -m-2.5 -mr-3 block cursor-pointer p-2.5 lg:hidden">
                                <Menu className="in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 m-auto size-5 duration-200" />
                                <X className="in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto size-5 -rotate-180 scale-0 opacity-0 duration-200" />
                            </button>
                        </div>

                        {isLarge && (
                            <div className="absolute inset-0 m-auto size-fit">
                                <NavMenu />
                            </div>
                        )}
                        {!isLarge && isMobileMenuOpen && <MobileMenu closeMenu={() => setIsMobileMenuOpen(false)} />}

                        <div className="max-lg:in-data-[state=active]:mt-6 in-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
                            <div className="flex w-full flex-col space-y-3 sm:flex-row sm:items-center sm:gap-3 sm:space-y-0 md:w-fit">
                                <ThemeToggle />
                                <Button
                                    asChild
                                    color="outline"
                                    size="sm">
                                    <Link href="#">
                                        <span>Login</span>
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    size="sm">
                                    <Link href="#">
                                        <span>Get Started</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </Container>
            </div>
        </header>
    )
}

const MobileMenu = ({ closeMenu }: { closeMenu: () => void }) => {
    return (
        <nav
            role="navigation"
            className="w-full [--color-muted:--alpha(var(--color-foreground)/5%)]">
            <Accordion
                type="single"
                collapsible
                className="**:hover:no-underline -mx-4 mt-0.5 space-y-0.5">
                {mobileLinks.map((link, index) => {
                    if (link.groupName && link.links) {
                        return (
                            <AccordionItem
                                key={index}
                                value={link.groupName}
                                className="group relative border-b-0">
                                <AccordionTrigger className="**:font-normal! data-[state=open]:bg-muted flex items-center justify-between px-4 py-3 text-lg">{link.groupName}</AccordionTrigger>
                                <AccordionContent className="pb-5">
                                    <ul>
                                        {link.links.map((feature, featureIndex) => (
                                            <li key={featureIndex}>
                                                <Link
                                                    href={feature.href}
                                                    onClick={closeMenu}
                                                    className="grid grid-cols-[auto_1fr] items-center gap-2.5 px-4 py-2">
                                                    <div
                                                        aria-hidden
                                                        className="flex items-center justify-center *:size-4">
                                                        {feature.icon}
                                                    </div>
                                                    <div className="text-base">{feature.name}</div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    }
                    return null
                })}
            </Accordion>
            {mobileLinks.map((link, index) => {
                if (link.name && link.href) {
                    return (
                        <Link
                            key={index}
                            href={link.href}
                            onClick={closeMenu}
                            className="group relative block py-4 text-lg">
                            {link.name}
                        </Link>
                    )
                }
                return null
            })}
        </nav>
    )
}

const NavMenu = () => {
    return (
        <NavigationMenu className="**:data-[slot=navigation-menu-viewport]:bg-[color-mix(in_oklch,var(--color-muted)_25%,var(--color-background))] **:data-[slot=navigation-menu-viewport]:shadow-lg **:data-[slot=navigation-menu-viewport]:rounded-2xl **:data-[slot=navigation-menu-viewport]:top-4 [--color-muted:color-mix(in_oklch,var(--color-foreground)_5%,transparent)] [--viewport-outer-px:2rem] max-lg:hidden">
            <NavigationMenuList className="gap-3">
                <NavigationMenuItem value="product">
                    <NavigationMenuTrigger>Product</NavigationMenuTrigger>
                    <NavigationMenuContent className="origin-top pb-1.5 pl-1 pr-4 pt-1 backdrop-blur">
                        <div className="min-w-6xl pr-18.5 grid w-full grid-cols-4 gap-1">
                            <div className="bg-card row-span-2 grid grid-rows-subgrid gap-1 rounded-xl border p-1 pt-3">
                                <span className="text-muted-foreground ml-2 text-xs">Features</span>
                                <ul>
                                    {features.map((feature, index) => (
                                        <ListItem
                                            key={index}
                                            href={feature.href}
                                            title={feature.name}
                                            description={feature.description}>
                                            {feature.icon}
                                        </ListItem>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-card col-span-2 row-span-2 grid grid-rows-subgrid gap-1 rounded-xl border p-1 pt-3">
                                <span className="text-muted-foreground ml-2 text-xs">More Features</span>
                                <ul className="grid grid-cols-2">
                                    {moreFeatures.map((feature, index) => (
                                        <ListItem
                                            key={index}
                                            href={feature.href}
                                            title={feature.name}
                                            description={feature.description}>
                                            {feature.icon}
                                        </ListItem>
                                    ))}
                                </ul>
                            </div>
                            <div className="row-span-2 grid grid-rows-subgrid">
                                <div className="bg-linear-to-b inset-ring-foreground/10 inset-ring-1 relative row-span-2 grid overflow-hidden rounded-xl bg-emerald-100 from-white via-white/50 to-sky-100 p-1 transition-colors duration-200 hover:bg-emerald-50">
                                    <div className="aspect-3/2 absolute inset-0 px-6 pt-2">
                                        <div className="mask-b-from-35% before:bg-background before:ring-foreground/10 after:ring-foreground/5 after:bg-background/75 before:z-1 group relative -mx-4 h-4/5 px-4 pt-6 before:absolute before:inset-x-6 before:bottom-0 before:top-4 before:rounded-t-xl before:border before:border-transparent before:ring-1 after:absolute after:inset-x-9 after:bottom-0 after:top-2 after:rounded-t-xl after:border after:border-transparent after:ring-1">
                                            <div className="bg-card ring-foreground/10 relative z-10 h-full overflow-hidden rounded-t-xl border border-transparent p-8 text-sm shadow-xl shadow-black/25 ring-1"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-0.5 self-end p-3">
                                        <NavigationMenuLink
                                            asChild
                                            className="text-foreground p-0 text-sm font-medium before:absolute before:inset-0 hover:bg-transparent focus:bg-transparent">
                                            <Link href="#">Multimodal Learning</Link>
                                        </NavigationMenuLink>
                                        <p className="text-foreground/60 line-clamp-1 text-xs">Explore how our platform integrates text, image, and audio processing into a unified framework.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem value="solutions">
                    <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
                    <NavigationMenuContent className="origin-top pb-1.5 pl-1 pr-4 pt-1 backdrop-blur">
                        <div className="min-w-6xl pr-18.5 grid w-full grid-cols-4 gap-1">
                            <div className="bg-card col-span-2 row-span-2 grid grid-rows-subgrid gap-1 rounded-xl border p-1 pt-3">
                                <span className="text-muted-foreground ml-2 text-xs">Use Cases</span>
                                <ul className="grid grid-cols-2">
                                    {useCases.map((useCase, index) => (
                                        <ListItem
                                            key={index}
                                            href={useCase.href}
                                            title={useCase.name}
                                            description={useCase.description}>
                                            {useCase.icon}
                                        </ListItem>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-card row-span-2 grid grid-rows-subgrid gap-1 rounded-xl border p-1 pt-3">
                                <span className="text-muted-foreground ml-2 text-xs">Apps</span>
                                <ul>
                                    {features.slice(0, features.length - 1).map((feature, index) => (
                                        <ListItem
                                            key={index}
                                            href={feature.href}
                                            title={feature.name}
                                            description={feature.description}>
                                            {feature.icon}
                                        </ListItem>
                                    ))}
                                </ul>
                            </div>
                            <div className="row-span-2 grid grid-rows-subgrid gap-1 p-1 pt-3">
                                <span className="text-muted-foreground ml-2 text-xs">Content</span>
                                <ul>
                                    {contentLinks.map((content, index) => (
                                        <NavigationMenuLink
                                            key={index}
                                            asChild>
                                            <Link
                                                href={content.href}
                                                className="grid grid-cols-[auto_1fr] items-center gap-2.5">
                                                {content.icon}
                                                <div className="text-foreground text-sm font-medium">{content.name}</div>
                                            </Link>
                                        </NavigationMenuLink>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem value="pricing">
                    <NavigationMenuLink
                        asChild
                        className={navigationMenuTriggerStyle()}>
                        <Link href="#">Pricing</Link>
                    </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem value="company">
                    <NavigationMenuLink
                        asChild
                        className={navigationMenuTriggerStyle()}>
                        <Link href="#">Company</Link>
                    </NavigationMenuLink>
                </NavigationMenuItem>
            </NavigationMenuList>
        </NavigationMenu>
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
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
    )
}

function ListItem({ title, description, children, href, ...props }: React.ComponentPropsWithoutRef<'li'> & { href: string; title: string; description?: string }) {
    return (
        <li {...props}>
            <NavigationMenuLink
                asChild
                className="rounded-lg">
                <Link
                    href={href}
                    className="grid grid-cols-[auto_1fr] gap-3.5">
                    <div className="bg-card ring-foreground/10 relative flex size-10 items-center justify-center rounded border border-transparent shadow ring-1">{children}</div>
                    <div className="space-y-0.5">
                        <div className="text-foreground text-sm font-medium">{title}</div>
                        <p className="text-muted-foreground line-clamp-1 text-xs">{description}</p>
                    </div>
                </Link>
            </NavigationMenuLink>
        </li>
    )
}