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
  adminName?: string
  newUserName?: string
  newUserEmail?: string
  signedUpAt?: string
  appUrl?: string
}

const AdminApprovalRequest = ({ adminName, newUserName, newUserEmail, signedUpAt, appUrl }: Props) => {
  const url = `${appUrl || APP_URL}/users`
  const greeting = adminName ? `Hi ${adminName},` : 'Hi admin,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New user awaiting approval on {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={shell}>
            <BrandHeader />
            <Section style={bodyPad}>
              <Heading style={h1}>New signup awaiting approval</Heading>
              <Text style={text}>{greeting}</Text>
              <Text style={text}>
                A new user just signed up to {SITE_NAME} and is waiting for admin approval.
              </Text>
              <Section style={card}>
                <Text style={label}>Name</Text>
                <Text style={value}>{newUserName || '—'}</Text>
                <Text style={label}>Email</Text>
                <Text style={value}>{newUserEmail || '—'}</Text>
                {signedUpAt ? (
                  <>
                    <Text style={label}>Signed up</Text>
                    <Text style={{ ...value, margin: 0 }}>{signedUpAt}</Text>
                  </>
                ) : null}
              </Section>
              <Section style={ctaWrap}>
                <Button href={url} style={button}>
                  Review pending approvals
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
  component: AdminApprovalRequest,
  subject: 'New user awaiting approval',
  displayName: 'Admin: new signup approval',
  previewData: {
    adminName: 'Admin',
    newUserName: 'Jane Doe',
    newUserEmail: 'jane@example.com',
    signedUpAt: new Date().toISOString(),
    appUrl: APP_URL,
  },
} satisfies TemplateEntry
