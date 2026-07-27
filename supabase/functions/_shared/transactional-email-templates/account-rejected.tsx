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
  container,
  ctaWrap,
  h1,
  label,
  main,
  palette,
  shell,
  text,
} from './styles.tsx'

interface RejectedProps {
  recipientName?: string
  rejectionReason?: string
  appUrl?: string
}

const reasonText = {
  fontSize: '14px',
  color: palette.heading,
  lineHeight: '1.6',
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
}

const AccountRejectedEmail = ({ recipientName, rejectionReason, appUrl }: RejectedProps) => {
  const url = appUrl || APP_URL
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {SITE_NAME} access request was not approved</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={shell}>
            <BrandHeader />
            <Section style={bodyPad}>
              <Heading style={h1}>Access request declined</Heading>
              <Text style={text}>{greeting}</Text>
              <Text style={text}>
                An administrator has reviewed your {SITE_NAME} access request and
                was unable to approve it at this time.
              </Text>
              {rejectionReason && (
                <Section style={callout('danger')}>
                  <Text style={{ ...label, color: palette.danger }}>Reason from admin</Text>
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
            </Section>
            <BrandFooter />
          </Section>
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
    appUrl: APP_URL,
  },
} satisfies TemplateEntry
