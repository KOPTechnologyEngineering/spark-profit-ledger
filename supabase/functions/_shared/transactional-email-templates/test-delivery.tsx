import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'KOPLedger'

interface TestDeliveryProps {
  recipientName?: string
  triggeredAt?: string
}

const TestDeliveryEmail = ({ recipientName, triggeredAt }: TestDeliveryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{SITE_NAME} email delivery test</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Email delivery test ✅</Heading>
        <Text style={text}>
          {recipientName ? `Hi ${recipientName},` : 'Hi there,'}
        </Text>
        <Text style={text}>
          This is a test email from <strong>{SITE_NAME}</strong> confirming that
          your sending domain is configured correctly and emails are being
          delivered through the queue.
        </Text>
        {triggeredAt && (
          <Text style={meta}>Triggered at: {triggeredAt}</Text>
        )}
        <Hr style={hr} />
        <Text style={footer}>Sent by {SITE_NAME} · Collections module</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TestDeliveryEmail,
  subject: `${SITE_NAME} — Email delivery test`,
  displayName: 'Delivery test',
  previewData: { recipientName: 'Sam', triggeredAt: new Date().toISOString() },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const meta = { fontSize: '12px', color: '#64748b', margin: '8px 0 0' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: 0 }
