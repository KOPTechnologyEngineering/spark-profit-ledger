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

interface ChaseReminderProps {
  subject?: string
  bodyText?: string
  customerName?: string
  invoiceNumber?: string
  invoiceAmount?: string
  daysOverdue?: number | string
}

const ChaseReminderEmail = ({
  subject,
  bodyText,
  customerName,
  invoiceNumber,
  invoiceAmount,
  daysOverdue,
}: ChaseReminderProps) => {
  const lines = (bodyText ?? '').split('\n')
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{subject ?? `Reminder from ${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{subject ?? 'Payment reminder'}</Heading>
          {customerName && <Text style={text}>Hi {customerName},</Text>}
          {lines.map((line, i) =>
            line.trim() === '' ? (
              <Text key={i} style={text}>&nbsp;</Text>
            ) : (
              <Text key={i} style={text}>{line}</Text>
            )
          )}
          {(invoiceNumber || invoiceAmount) && (
            <>
              <Hr style={hr} />
              <Text style={meta}>
                {invoiceNumber && <>Invoice: <strong>{invoiceNumber}</strong><br /></>}
                {invoiceAmount && <>Amount due: <strong>{invoiceAmount}</strong><br /></>}
                {daysOverdue !== undefined && <>Days overdue: <strong>{daysOverdue}</strong></>}
              </Text>
            </>
          )}
          <Hr style={hr} />
          <Text style={footer}>Sent by {SITE_NAME} · Collections</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ChaseReminderEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || `Payment reminder from ${SITE_NAME}`,
  displayName: 'Chase reminder',
  previewData: {
    subject: 'Reminder: Invoice INV-001 is overdue',
    bodyText:
      'This is a friendly reminder that your invoice is now past its due date.\n\nPlease arrange payment at your earliest convenience.',
    customerName: 'Acme Ltd',
    invoiceNumber: 'INV-001',
    invoiceAmount: '£1,250.00',
    daysOverdue: 7,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px' }
const meta = { fontSize: '13px', color: '#475569', lineHeight: '1.7', margin: '0' }
const hr = { borderColor: '#e2e8f0', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: 0 }
