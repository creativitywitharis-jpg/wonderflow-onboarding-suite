import * as React from 'react'

import { Button, Text } from '@react-email/components'

import { EmailLayout, styles } from './theme'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <EmailLayout
    preview={`Reset your password for ${siteName}`}
    heading="Reset your password"
  >
    <Text style={styles.text}>
      We received a request to reset the password for your{' '}
      <span style={styles.strong}>{siteName}</span> account. Choose a new one
      below.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Reset password
    </Button>
    <Text style={styles.note}>
      If you didn't request this, you can safely ignore this email — your
      password won't change.
    </Text>
  </EmailLayout>
)

export default RecoveryEmail
