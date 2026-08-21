import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// WonderFlow OS email brand — dark glass card, gold AI accent, on a white
// email body (required for broad client support).
export const colors = {
  gold: '#e3b341',
  goldSoft: '#f0cf6e',
  ink: '#0b0b0d',
  card: '#141416',
  border: '#26262b',
  text: '#e8e6e1',
  muted: '#b8b5ad',
  faint: '#8a877f',
}

const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export const styles = {
  main: { backgroundColor: '#ffffff', fontFamily: font, margin: 0, padding: 0 },
  container: { maxWidth: '540px', margin: '0 auto', padding: '32px 20px' },
  brand: {
    fontSize: '19px',
    fontWeight: 700 as const,
    letterSpacing: '-0.01em',
    color: colors.ink,
    margin: '0 0 20px',
  },
  card: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '18px',
    padding: '32px 28px',
  },
  h1: {
    fontSize: '22px',
    fontWeight: 600 as const,
    color: colors.text,
    margin: '0 0 14px',
    letterSpacing: '-0.01em',
  },
  text: {
    fontSize: '15px',
    lineHeight: '1.65',
    color: colors.muted,
    margin: '0 0 22px',
  },
  strong: { color: colors.text },
  link: { color: colors.goldSoft, textDecoration: 'underline' },
  button: {
    display: 'inline-block',
    backgroundColor: colors.gold,
    backgroundImage: `linear-gradient(135deg, ${colors.goldSoft}, #c99a35)`,
    color: '#1a1509',
    fontSize: '14px',
    fontWeight: 600 as const,
    borderRadius: '999px',
    padding: '13px 26px',
    textDecoration: 'none',
  },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Courier, monospace',
    fontSize: '28px',
    fontWeight: 700 as const,
    letterSpacing: '0.24em',
    color: colors.goldSoft,
    backgroundColor: '#0f0f11',
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '16px 20px',
    margin: '0 0 24px',
    textAlign: 'center' as const,
  },
  note: {
    fontSize: '12px',
    lineHeight: '1.6',
    color: colors.faint,
    margin: '22px 0 0',
  },
  footer: {
    fontSize: '11px',
    color: '#9a988f',
    textAlign: 'center' as const,
    margin: '22px 0 0',
  },
}

export function EmailLayout({
  preview,
  heading,
  children,
}: {
  preview: string
  heading: string
  children: React.ReactNode
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Text style={styles.brand}>
            WonderFlow <span style={{ color: colors.gold }}>OS</span>
          </Text>
          <Section style={styles.card}>
            <Heading style={styles.h1}>{heading}</Heading>
            {children}
          </Section>
          <Text style={styles.footer}>
            WonderFlow OS — your AI business operating system.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
