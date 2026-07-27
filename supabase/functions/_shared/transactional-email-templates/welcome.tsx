/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Heading,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  APP_URL,
  BrandFooter,
  BrandHeader,
  SITE_NAME,
  bodyPad,
  bullet,
  button,
  container,
  ctaWrap,
  h1,
  main,
  shell,
  text,
} from './styles.tsx'

interface WelcomeProps {
  recipientName?: string
  appUrl?: string
}

const WelcomeEmail = ({ recipientName, appUrl }: WelcomeProps) => {
  const url = appUrl || APP_URL
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to {SITE_NAME} — your finance workspace is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={shell}>
            <BrandHeader />
            <Section style={bodyPad}>
              <Heading style={h1}>Welcome to {SITE_NAME}</Heading>
              <Text style={text}>{greeting}</Text>
              <Text style={text}>
                Your account is ready. {SITE_NAME} helps your team stay on top of
                invoices, transactions, VAT, PAYE and collections — all in one
                place.
              </Text>
              <Section style={ctaWrap}>
                <Button href={url} style={button}>
                  Open {SITE_NAME}
                </Button>
              </Section>
              <Text style={text}>A few things you can do straight away:</Text>
              <Text style={bullet}>• Create your first invoice</Text>
              <Text style={bullet}>• Import or log a transaction</Text>
              <Text style={bullet}>• Review the Collections dashboard</Text>
            </Section>
            <BrandFooter note="If you didn't create this account, you can safely ignore this email." />
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME}`,
  displayName: 'Welcome',
  previewData: {
    recipientName: 'Sam',
    appUrl: APP_URL,
  },
} satisfies TemplateEntry
