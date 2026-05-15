import { SignIn } from '@clerk/clerk-react'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  return (
    <div className={styles.root}>
      <div className={styles.brand}>
        <div className={styles.icon}>E</div>
        <div className={styles.name}>ELLIE</div>
        <div className={styles.sub}>EXECUTIVE LIFE LOGIC INTELLIGENCE ENGINE</div>
        <div className={styles.tagline}>DREW COMMAND CENTER // AUTHORIZED ACCESS ONLY</div>
      </div>
      <SignIn
        routing="path"
        path="/login"
        afterSignInUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: '#00d4ff',
            colorBackground: '#060f1a',
            colorText: '#cceeff',
            colorInputBackground: '#091520',
            colorInputText: '#cceeff',
            fontFamily: "'Rajdhani', sans-serif",
          },
          elements: {
            card: { border: '1px solid rgba(0,212,255,0.25)', borderRadius: '4px' },
            headerTitle: { fontFamily: "'Orbitron', sans-serif", letterSpacing: '3px', fontSize: '14px' },
            formButtonPrimary: { background: 'rgba(0,212,255,0.2)', border: '1px solid #00d4ff' },
          }
        }}
      />
    </div>
  )
}
