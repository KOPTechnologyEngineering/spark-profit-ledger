/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
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
  BrandFooter,
  BrandHeader,
  SITE_NAME,
  bodyPad,
  card,
  container,
  h1,
  label,
  main,
  shell,
  text,
  value,
} from './styles.tsx'

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
          <Section style={shell}>
            <BrandHeader />
            <Section style={bodyPad}>
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
                <Section style={card}>
                  {invoiceNumber && (
                    <>
                      <Text style={label}>Invoice</Text>
                      <Text style={value}>{invoiceNumber}</Text>
                    </>
                  )}
                  {invoiceAmount && (
                    <>
                      <Text style={label}>Amount due</Text>
                      <Text style={value}>{invoiceAmount}</Text>
                    </>
                  )}
                  {daysOverdue !== undefined && (
                    <>
                      <Text style={label}>Days overdue</Text>
                      <Text style={{ ...value, margin: 0 }}>{daysOverdue}</Text>
                    </>
                  )}
                </Section>
              )}
            </Section>
            <BrandFooter note="Sent by the Collections team." />
          </Section>
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
