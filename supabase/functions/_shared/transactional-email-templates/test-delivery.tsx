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
  callout,
  calloutText,
  container,
  h1,
  main,
  meta,
  shell,
  text,
} from './styles.tsx'

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
        <Section style={shell}>
          <BrandHeader />
          <Section style={bodyPad}>
            <Heading style={h1}>Email delivery test</Heading>
            <Text style={text}>
              {recipientName ? `Hi ${recipientName},` : 'Hi there,'}
            </Text>
            <Section style={callout('brand')}>
              <Text style={calloutText}>
                If you're reading this, the sending domain is configured
                correctly and mail is flowing through the queue.
              </Text>
            </Section>
            {triggeredAt && <Text style={meta}>Triggered at: {triggeredAt}</Text>}
          </Section>
          <BrandFooter note="Sent by the Collections module." />
        </Section>
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
