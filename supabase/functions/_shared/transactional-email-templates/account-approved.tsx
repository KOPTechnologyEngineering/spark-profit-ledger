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

interface ApprovedProps {
  recipientName?: string
  appUrl?: string
}

const AccountApprovedEmail = ({ recipientName, appUrl }: ApprovedProps) => {
  const url = appUrl || 'https://kopledger.koptechnology.com'
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {SITE_NAME} access request has been approved</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Access approved</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Good news — an administrator has approved your {SITE_NAME} access
            request. You can now sign in and start using the app.
          </Text>
          <Section style={ctaWrap}>
            <Button href={url} style={button}>
              Open {SITE_NAME}
            </Button>
          </Section>
          <Text style={text}>
            If the button doesn't work, paste this link into your browser:{' '}
            {url}
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Sent by {SITE_NAME}.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AccountApprovedEmail,
  subject: `Your ${SITE_NAME} access request was approved`,
  displayName: 'Account approved',
  previewData: {
    recipientName: 'Sam',
    appUrl: 'https://kopledger.koptechnology.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '28px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 14px' }
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
