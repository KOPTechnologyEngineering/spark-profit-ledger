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
  approverName?: string
  recordType?: 'invoice' | 'transaction'
  recordLabel?: string
  amount?: string
  isResubmission?: boolean
  appUrl?: string
}

const RecordApprovalRequestEmail = ({
  approverName,
  recordType = 'transaction',
  recordLabel,
  amount,
  isResubmission,
  appUrl,
}: Props) => {
  const url = `${appUrl || APP_URL}/approvals`
  const greeting = approverName ? `Hi ${approverName},` : 'Hi there,'
  const verb = isResubmission ? 'was updated and needs your re-approval' : 'needs your approval'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>An {recordType} {verb} on {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={shell}>
            <BrandHeader />
            <Section style={bodyPad}>
              <Heading style={h1}>Approval requested</Heading>
              <Text style={text}>{greeting}</Text>
              <Text style={text}>
                An {recordType} {verb}:
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
                  Review approvals
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
  component: RecordApprovalRequestEmail,
  subject: (data: Record<string, any>) => {
    const type = data?.recordType === 'invoice' ? 'Invoice' : 'Transaction'
    return data?.isResubmission ? `${type} updated — needs your re-approval` : `${type} needs your approval`
  },
  displayName: 'Record approval requested',
  previewData: {
    approverName: 'Sam',
    recordType: 'invoice',
    recordLabel: 'INV-006',
    amount: '£1,250.00',
    isResubmission: false,
    appUrl: APP_URL,
  },
} satisfies TemplateEntry
