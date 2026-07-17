/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'KOP Ledger'

interface Props {
  adminName?: string
  newUserName?: string
  newUserEmail?: string
  signedUpAt?: string
  appUrl?: string
}

const AdminApprovalRequest = ({ adminName, newUserName, newUserEmail, signedUpAt, appUrl }: Props) => {
  const url = `${appUrl || 'https://kopledger.koptechnology.com'}/users`
  const greeting = adminName ? `Hi ${adminName},` : 'Hi admin,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New user awaiting approval on {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
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
                <Text style={value}>{signedUpAt}</Text>
              </>
            ) : null}
          </Section>
          <Section style={ctaWrap}>
            <Button href={url} style={button}>
              Review pending approvals
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Sent by {SITE_NAME}.</Text>
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
    appUrl: 'https://kopledger.koptechnology.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '28px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 14px' }
const card = { backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px 18px', margin: '8px 0 20px' }
const label = { fontSize: '11px', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '6px 0 2px' }
const value = { fontSize: '14px', color: '#0f172a', fontWeight: 600, margin: '0 0 6px' }
const ctaWrap = { margin: '8px 0 24px' }
const button = {
  backgroundColor: '#10B981',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: 0 }
