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

interface RejectedProps {
  recipientName?: string
  rejectionReason?: string
  appUrl?: string
}

const AccountRejectedEmail = ({ recipientName, rejectionReason, appUrl }: RejectedProps) => {
  const url = appUrl || 'https://kopledger.koptechnology.com'
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {SITE_NAME} access request was not approved</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Access request declined</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            An administrator has reviewed your {SITE_NAME} access request and
            was unable to approve it at this time.
          </Text>
          {rejectionReason && (
            <Section style={reasonBox}>
              <Text style={reasonLabel}>Reason from admin</Text>
              <Text style={reasonText}>{rejectionReason}</Text>
            </Section>
          )}
          <Text style={text}>
            You can sign in to view the full details of this decision.
          </Text>
          <Section style={ctaWrap}>
            <Button href={url} style={button}>
              View decision
            </Button>
          </Section>
          <Text style={text}>
            If you believe this was a mistake, please reply to this email or
            contact your {SITE_NAME} administrator.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Sent by {SITE_NAME}.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AccountRejectedEmail,
  subject: `Your ${SITE_NAME} access request was declined`,
  displayName: 'Account rejected',
  previewData: {
    recipientName: 'Sam',
    rejectionReason: 'We could not verify your organisation.',
    appUrl: 'https://kopledger.koptechnology.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '28px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 14px' }
const reasonBox = {
  border: '1px solid #fecaca',
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '12px 14px',
  margin: '4px 0 18px',
}
const reasonLabel = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#b91c1c',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 6px',
}
const reasonText = { fontSize: '14px', color: '#0f172a', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' as const }
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
