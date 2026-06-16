/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Heading,
  Hr,
  Html,
  Head,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

/**
 * Ordo OS email design language.
 * Brand primary: #002726. Light, premium, generous spacing, large radius.
 * Every Ordo email inherits this layout so future modules stay consistent.
 */

export const ordo = {
  primary: '#002726',
  primaryText: '#ffffff',
  ink: '#1A1D1F',
  muted: '#6F767E',
  border: '#E6E8EA',
  surface: '#F0F2F5',
  accent: '#13BB7B',
  radius: '16px',
  font:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
}

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: ordo.font,
  margin: 0,
  padding: '0',
}

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px 48px',
}

const header: React.CSSProperties = {
  paddingBottom: '24px',
}

const brandRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
}

const wordmark: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: ordo.primary,
  margin: 0,
}

const category: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: ordo.muted,
  margin: '0 0 6px',
}

const card: React.CSSProperties = {
  border: `1px solid ${ordo.border}`,
  borderRadius: ordo.radius,
  padding: '28px 28px 30px',
  backgroundColor: '#ffffff',
}

const footer: React.CSSProperties = {
  paddingTop: '28px',
}

const footerText: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '18px',
  color: ordo.muted,
  margin: '0 0 4px',
}

export const styles = {
  heading: {
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: ordo.ink,
    margin: '0 0 12px',
  } as React.CSSProperties,
  text: {
    fontSize: '15px',
    lineHeight: '24px',
    color: ordo.ink,
    margin: '0 0 16px',
  } as React.CSSProperties,
  muted: {
    fontSize: '14px',
    lineHeight: '22px',
    color: ordo.muted,
    margin: '0 0 16px',
  } as React.CSSProperties,
  button: {
    display: 'inline-block',
    backgroundColor: ordo.primary,
    color: ordo.primaryText,
    fontSize: '15px',
    fontWeight: 600,
    textDecoration: 'none',
    padding: '13px 24px',
    borderRadius: '12px',
  } as React.CSSProperties,
  panel: {
    backgroundColor: ordo.surface,
    borderRadius: '12px',
    padding: '16px 18px',
    margin: '0 0 20px',
  } as React.CSSProperties,
  panelLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: ordo.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 4px',
  } as React.CSSProperties,
  panelValue: {
    fontSize: '15px',
    fontWeight: 600,
    color: ordo.ink,
    margin: 0,
  } as React.CSSProperties,
}

interface LayoutProps {
  preview: string
  categoryLabel: string
  children: React.ReactNode
  siteName?: string
}

export function OrdoEmailLayout({
  preview,
  categoryLabel,
  children,
  siteName = 'Ordo',
}: LayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <div style={brandRow}>
              <Text style={wordmark}>{siteName}</Text>
            </div>
          </Section>
          <Section style={card}>
            <Text style={category}>{categoryLabel}</Text>
            {children}
          </Section>
          <Section style={footer}>
            <Hr style={{ borderColor: ordo.border, margin: '0 0 16px' }} />
            <Text style={footerText}>
              {siteName} — accountability, execution, and visibility for your projects.
            </Text>
            <Text style={footerText}>
              You received this because of activity in your {siteName} workspace.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export { Link, Section, Heading, Text }
