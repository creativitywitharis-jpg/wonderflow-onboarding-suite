import * as React from 'react'

import { Button, Link, Text } from '@react-email/components'

import { EmailLayout, styles } from './theme'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailLayout
    preview={`Confirm your email change for ${siteName}`}
    heading="Confirm your email change"
  >
    <Text style={styles.text}>
      You asked to change the email on your{' '}
      <span style={styles.strong}>{siteName}</span> account from{' '}
      <Link href={`mailto:${oldEmail}`} style={styles.link}>
        {oldEmail}
      </Link>{' '}
      to{' '}
      <Link href={`mailto:${newEmail}`} style={styles.link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirm email change
    </Button>
    <Text style={styles.note}>
      If you didn't request this change, secure your account immediately.
    </Text>
  </EmailLayout>
)

export default EmailChangeEmail
