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
  button,
  callout,
  calloutText,
  card,
  container,
  ctaWrap,
  h1,
  label,
  main,
  shell,
  text,
  value,
} from './styles.tsx'

interface Props {
  recipientName?: string
  recordType?: 'invoice' | 'transaction'
  recordLabel?: string
  amount?: string
  rejectedByName?: string
  appUrl?: string
}

const RecordRejectedEmail = ({
  recipientName,
  recordType = 'transaction',
  recordLabel,
  amount,
  rejectedByName,
  appUrl,
}: Props) => {
  const url = `${appUrl || APP_URL}/${recordType === 'invoice' ? 'invoices' : 'transactions'}`
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {recordType} was rejected</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={shell}>
            <BrandHeader />
            <Section style={bodyPad}>
              <Heading style={h1}>Rejected</Heading>
              <Text style={text}>{greeting}</Text>
              <Text style={text}>
                Your {recordType} was rejected{rejectedByName ? ` by ${rejectedByName}` : ''}.
              </Text>
              <Section style={card}>
                <Text style={label}>{recordType === 'invoice' ? 'Invoice' : 'Description'}</Text>
                <Text style={value}>{recordLabel || '—'}</Text>
                {amount ? (
                  <>
                    <Text style={label}>Amount</Text>
                    <Text style={{ ...value, margin: 0 }}>{amount}</Text>
                  </>
                ) : null}
              </Section>
              <Section style={callout('danger')}>
                <Text style={calloutText}>
                  Sign in to {SITE_NAME} to review the details and, if needed, make changes and resubmit for approval.
                </Text>
              </Section>
              <Section style={ctaWrap}>
                <Button href={url} style={button}>
                  View {recordType === 'invoice' ? 'invoice' : 'transaction'}
                </Button>
              </Section>
            </Section>
            <BrandFooter />
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RecordRejectedEmail,
  subject: (data: Record<string, any>) =>
    `Your ${data?.recordType === 'invoice' ? 'invoice' : 'transaction'} was rejected`,
  displayName: 'Record rejected',
  previewData: {
    recipientName: 'Sam',
    recordType: 'invoice',
    recordLabel: 'INV-006',
    amount: '£1,250.00',
    rejectedByName: 'Alex',
    appUrl: APP_URL,
  },
} satisfies TemplateEntry
