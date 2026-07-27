/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Column, Row, Section, Text } from 'npm:@react-email/components@0.0.22'

// Shared visual layer for every transactional template, so the palette and
// chrome live in one place instead of being re-declared in each file.
//
// Design: dark brand band on top, white body, grey footer. Full-dark was
// rejected because Gmail/Outlook dark-mode transforms recolour dark bodies
// unpredictably; this keeps the body on a background clients handle
// consistently while still leading with the brand.
//
// Values come from src/index.css (the app's real theme tokens).

export const SITE_NAME = 'KOP Ledger'
export const STRAPLINE = 'Smart Accounting for Modern Business'
export const APP_URL = 'https://kopledger.koptechnology.com'

export const palette = {
  brand: '#10B981', // --primary
  onBrand: '#080C17', // --primary-foreground: near-black on emerald, NOT white.
  // White on #10B981 is ~2.1:1 contrast (fails WCAG); near-black is ~9:1.
  headerBg: '#080C17', // --background
  headerText: '#F1F5F9', // --foreground
  heading: '#0f172a',
  body: '#334155',
  meta: '#64748b',
  footerText: '#94a3b8',
  border: '#e2e8f0',
  footerBg: '#f8fafc',
  cardBg: '#f8fafc',
  warning: '#F59E0B', // --warning
  danger: '#EF4444', // --destructive / --outflow
} as const

const HEADING_FONT = "'Space Grotesk', Helvetica, Arial, sans-serif"
const BODY_FONT = "Inter, Helvetica, Arial, sans-serif"

export const main = { backgroundColor: '#eef2f6', fontFamily: BODY_FONT, margin: 0, padding: '24px 0' }
export const container = { maxWidth: '560px', padding: 0 }

// Rounded outer card. overflow:hidden is what clips the header band to the
// radius; clients that drop it simply render square corners.
export const shell = {
  borderRadius: '12px',
  overflow: 'hidden' as const,
  border: `1px solid ${palette.border}`,
  backgroundColor: '#ffffff',
}

export const bodyPad = { padding: '30px 28px', backgroundColor: '#ffffff' }

export const h1 = {
  fontFamily: HEADING_FONT,
  fontSize: '22px',
  fontWeight: 700,
  color: palette.heading,
  margin: '0 0 14px',
}
export const text = { fontSize: '14px', color: palette.body, lineHeight: '1.65', margin: '0 0 14px' }
export const bullet = { fontSize: '14px', color: palette.body, lineHeight: '1.7', margin: '0 0 4px' }
export const meta = { fontSize: '12px', color: palette.meta, lineHeight: '1.6', margin: '0 0 6px' }
export const link = { fontSize: '12px', color: palette.brand, wordBreak: 'break-all' as const, margin: '0 0 4px' }
export const ctaWrap = { margin: '22px 0 20px' }
export const button = {
  backgroundColor: palette.brand,
  color: palette.onBrand,
  padding: '12px 22px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
export const hr = { borderColor: palette.border, margin: '22px 0' }

// Detail card (label/value pairs) — used by admin-approval-request.
export const card = {
  backgroundColor: palette.cardBg,
  borderRadius: '8px',
  padding: '16px 18px',
  margin: '0 0 18px',
}
export const label = {
  fontSize: '11px',
  color: palette.meta,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  margin: '0 0 2px',
}
export const value = { fontSize: '14px', color: palette.heading, fontWeight: 600, margin: '0 0 12px' }

// Tinted callout. `tone` picks the accent; the 15% tints mirror the app's
// bg-inflow-muted / bg-outflow-muted treatment.
export function callout(tone: 'warning' | 'danger' | 'brand') {
  const accent = tone === 'danger' ? palette.danger : tone === 'warning' ? palette.warning : palette.brand
  const tint = tone === 'danger' ? '#fef2f2' : tone === 'warning' ? '#fffbeb' : '#ecfdf5'
  return {
    backgroundColor: tint,
    borderLeft: `3px solid ${accent}`,
    padding: '12px 16px',
    margin: '0 0 18px',
  }
}
export const calloutText = { fontSize: '13px', color: palette.body, lineHeight: '1.6', margin: 0 }

const headerBand = { backgroundColor: palette.headerBg, padding: '22px 28px' }
const logoBox = {
  backgroundColor: palette.brand,
  borderRadius: '10px',
  width: '36px',
  height: '36px',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}
const wordmark = {
  fontFamily: HEADING_FONT,
  fontSize: '17px',
  fontWeight: 700,
  color: palette.headerText,
  margin: 0,
  paddingLeft: '12px',
}

// Dark band carrying the mark and wordmark.
//
// The lucide TrendingUp glyph is inline SVG, which Gmail strips. That's
// deliberate and safe: the emerald rounded square is a table cell with its own
// background, so where the SVG is dropped the mark degrades to a clean solid
// square rather than a broken image.
export const BrandHeader = () => (
  <Section style={headerBand}>
    <Row>
      <Column style={{ width: '36px' }}>
        <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            <tr>
              <td style={logoBox}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={palette.onBrand}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </td>
            </tr>
          </tbody>
        </table>
      </Column>
      <Column>
        <Text style={wordmark}>{SITE_NAME}</Text>
      </Column>
    </Row>
  </Section>
)

const footerBand = {
  backgroundColor: palette.footerBg,
  padding: '16px 28px',
  borderTop: `1px solid ${palette.border}`,
}
const footerText = { fontSize: '11px', color: palette.footerText, lineHeight: '1.6', margin: 0 }

// `note` carries the per-template safety line (e.g. "if you didn't sign up…").
export const BrandFooter = ({ note }: { note?: string }) => (
  <Section style={footerBand}>
    {note ? <Text style={footerText}>{note}</Text> : null}
    <Text style={footerText}>
      {SITE_NAME} — {STRAPLINE}
    </Text>
  </Section>
)
