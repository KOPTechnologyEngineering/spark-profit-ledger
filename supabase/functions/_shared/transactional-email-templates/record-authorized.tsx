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
  appUrl?: string
}

const RecordAuthorizedEmail = ({ recipientName, recordType = 'transaction', recordLabel, amount, appUrl }: Props) => {
  const url = `${appUrl || APP_URL}/${recordType === 'invoice' ? 'invoices' : 'transactions'}`
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {recordType} has been fully approved</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={shell}>
            <BrandHeader />
            <Section style={bodyPad}>
              <Heading style={h1}>Approved</Heading>
              <Text style={text}>{greeting}</Text>
              <Text style={text}>
                Good news — your {recordType} has been approved by both approvers.
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
  component: RecordAuthorizedEmail,
  subject: (data: Record<string, any>) =>
    `Your ${data?.recordType === 'invoice' ? 'invoice' : 'transaction'} was approved`,
  displayName: 'Record authorized',
  previewData: {
    recipientName: 'Sam',
    recordType: 'invoice',
    recordLabel: 'INV-006',
    amount: '£1,250.00',
    appUrl: APP_URL,
  },
} satisfies TemplateEntry
