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
  container,
  ctaWrap,
  h1,
  link,
  main,
  meta,
  shell,
  text,
} from './styles.tsx'

interface ApprovedProps {
  recipientName?: string
  appUrl?: string
}

const AccountApprovedEmail = ({ recipientName, appUrl }: ApprovedProps) => {
  const url = appUrl || APP_URL
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {SITE_NAME} access request has been approved</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={shell}>
            <BrandHeader />
            <Section style={bodyPad}>
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
              <Text style={meta}>Or paste this into your browser:</Text>
              <Text style={link}>{url}</Text>
            </Section>
            <BrandFooter />
          </Section>
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
    appUrl: APP_URL,
  },
} satisfies TemplateEntry
