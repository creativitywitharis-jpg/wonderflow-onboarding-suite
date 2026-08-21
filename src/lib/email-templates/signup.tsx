import * as React from 'react'

import { Button, Link, Text } from '@react-email/components'

import { EmailLayout, styles } from './theme'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailLayout
    preview={`Confirm your email for ${siteName}`}
    heading="Confirm your email"
  >
    <Text style={styles.text}>
      Welcome to{' '}
      <Link href={siteUrl} style={styles.link}>
        <strong>{siteName}</strong>
      </Link>
      . Confirm{' '}
      <span style={styles.strong}>{recipient}</span> to activate your workspace
      and meet your AI setup assistant.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Verify email
    </Button>
    <Text style={styles.note}>
      If you didn't create an account, you can safely ignore this email.
    </Text>
  </EmailLayout>
)

export default SignupEmail
