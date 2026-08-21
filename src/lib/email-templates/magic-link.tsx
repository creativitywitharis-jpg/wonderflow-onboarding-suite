import * as React from 'react'

import { Button, Text } from '@react-email/components'

import { EmailLayout, styles } from './theme'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <EmailLayout
    preview={`Your login link for ${siteName}`}
    heading="Your login link"
  >
    <Text style={styles.text}>
      Tap below to sign in to{' '}
      <span style={styles.strong}>{siteName}</span>. This link expires shortly
      and can only be used once.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Log in
    </Button>
    <Text style={styles.note}>
      If you didn't request this link, you can safely ignore this email.
    </Text>
  </EmailLayout>
)

export default MagicLinkEmail
