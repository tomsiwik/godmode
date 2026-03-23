import { createFileRoute } from '@tanstack/react-router';
import { Button, Container, FeatureCard, FeatureCardDescription, FeatureCardCIllustration, FeatureCardContent, FeatureCardTitle } from '@godmode-cli/ui';
import { LogoCloud } from '@/components/logo-cloud';
import { Manifesto } from '@/sections/manifesto';
import { PlatformFeatures } from '@/sections/platform-features';
import { AnalyticsFeatures } from '@/sections/analytics-features';
import { IntegrationsSection } from '@/sections/integrations-section';
import { TestimonialsSection } from '@/sections/testimonials-section';
import { CallToAction } from '@/components/call-to-action';
import { CampaignIllustration } from '@/components/illustrations/campaign-illustration';
import { MessageIllustration } from '@/components/illustrations/message-illustration';
import { MessageCircle, Target } from 'lucide-react';
import { EnterpriseFeatures } from '@/sections/enterprise-features';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <>
      <section id="home" className="overflow-hidden">
        <div className="relative">
          <div aria-hidden className="h-14 lg:h-[73px]" />

          <Container asGrid className="relative">

            <div aria-hidden className="col-span-full grid grid-cols-10 gap-px">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square">
                  <div data-grid-content />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-10 gap-px">
              <div aria-hidden className="grid grid-rows-4 gap-px">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <div data-grid-content />
                  </div>
                ))}
              </div>

              <div className="col-span-8">
                <div data-grid-content className="py-12 text-center">
                  <div className="relative mx-auto max-w-3xl text-center">
                    <h1 className="text-foreground text-balance text-4xl font-semibold sm:text-5xl md:text-6xl">
                      <span className="@max-md:hidden">Modern</span> Solutions for Customer Engagement
                    </h1>
                    <p className="text-muted-foreground mb-9 mt-5 text-balance text-lg">
                      Our comprehensive analytics and experimentation platform empowers your team to make data-driven decisions.
                    </p>

                    <Button size="lg" className="border-transparent px-4 text-sm shadow-xl shadow-indigo-900/40">
                      <a href="#">Start Testing for free</a>
                    </Button>
                    <span className="text-muted-foreground mt-3 block text-center text-sm">No credit card required!</span>
                  </div>
                </div>
              </div>

              <div aria-hidden className="grid grid-rows-4 gap-px">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <div data-grid-content />
                  </div>
                ))}
              </div>
            </div>

            <div aria-hidden className="col-span-full grid grid-cols-10 gap-px">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square">
                  <div data-grid-content />
                </div>
              ))}
            </div>
          </Container>

          <Container asGrid className="relative shadow-indigo-900/20">
            <h2 className="sr-only">Features</h2>
            <div className="@2xl:grid-cols-2 @4xl:grid-cols-10 grid gap-px [--color-primary:var(--color-indigo-500)]">
              <div className="@max-4xl:hidden">
                <div data-grid-content />
              </div>
              <div className="@4xl:col-span-4">
                <FeatureCard>
                  <FeatureCardContent>
                    <FeatureCardTitle>
                      <Target className="size-4" />
                      Marketing Campaigns
                    </FeatureCardTitle>
                    <FeatureCardDescription>
                      <span className="text-foreground">Launch and manage campaigns seamlessly.</span> Collaborate with your team to deliver impactful strategies.
                    </FeatureCardDescription>
                  </FeatureCardContent>
                  <FeatureCardCIllustration>
                    <CampaignIllustration />
                  </FeatureCardCIllustration>
                </FeatureCard>
              </div>
              <div className="@4xl:col-span-4">
                <FeatureCard>
                  <FeatureCardContent>
                    <FeatureCardTitle>
                      <MessageCircle className="size-4" />
                      Collaborative Campaigns
                    </FeatureCardTitle>
                    <FeatureCardDescription>
                      <span className="text-foreground">Work together for greater impact.</span> Engage with your team on comprehensive campaigns.
                    </FeatureCardDescription>
                  </FeatureCardContent>
                  <FeatureCardCIllustration>
                    <MessageIllustration />
                  </FeatureCardCIllustration>
                </FeatureCard>
              </div>
              <div className="@max-4xl:hidden">
                <div data-grid-content />
              </div>
            </div>
          </Container>
        </div>
        <LogoCloud />
      </section>
      <Manifesto />
      <PlatformFeatures />
      <AnalyticsFeatures />
      <IntegrationsSection />
      <EnterpriseFeatures />
      <TestimonialsSection />
      <CallToAction />
    </>
  );
}
