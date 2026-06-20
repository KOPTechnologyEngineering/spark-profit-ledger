/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'KOP Ledger'

interface WelcomeProps {
  recipientName?: string
  appUrl?: string
}

const WelcomeEmail = ({ recipientName, appUrl }: WelcomeProps) => {
  const url = appUrl || 'https://kopledger.koptechnology.com'
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to {SITE_NAME} — your finance workspace is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to {SITE_NAME} 👋</Heading>
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
          <Hr style={hr} />
          <Text style={footer}>
            Sent by {SITE_NAME}. If you didn't create this account, you can
            safely ignore this email.
          </Text>
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
    appUrl: 'https://kopledger.koptechnology.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '28px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 14px' }
const bullet = { fontSize: '14px', color: '#334155', lineHeight: '1.7', margin: '0 0 4px' }
const ctaWrap = { margin: '20px 0 24px' }
const button = {
  backgroundColor: '#10B981',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: 0 }
