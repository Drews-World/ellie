// Public privacy policy for the ELLIE Pinterest app (required for Pinterest
// developer-app review). Intentionally rendered OUTSIDE the Clerk auth gate so
// Pinterest's reviewer can reach it without signing in.
//
// EDIT THESE before deploying:
const OPERATOR = 'ellie by drew'
const CONTACT_EMAIL = 'your-email@example.com'   // ← put a real address you check
const EFFECTIVE_DATE = 'June 3, 2026'

const page = {
  minHeight: '100vh',
  background: 'var(--bp-bg)',
  backgroundImage:
    'radial-gradient(120% 80% at 85% -10%, rgba(95,208,216,0.10) 0%, transparent 45%),' +
    'linear-gradient(180deg, var(--bp-bg) 0%, var(--bp-bg-deep) 100%)',
  color: 'var(--bp-ink-2)',
  fontFamily: 'var(--bp-font-sans)',
  fontSize: 'var(--bp-text-base)',
  padding: 'clamp(28px, 6vw, 64px) 20px',
}
const wrap = {
  maxWidth: 760,
  margin: '0 auto',
  lineHeight: 1.7,
  background: 'var(--bp-surface)',
  border: '1px solid var(--bp-hairline)',
  borderRadius: 'var(--bp-r-lg)',
  boxShadow: 'var(--bp-shadow-md)',
  padding: 'clamp(24px, 5vw, 44px)',
}
const kicker = {
  fontFamily: 'var(--bp-font-mono)',
  fontSize: 'var(--bp-text-2xs)',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'var(--bp-accent-deep)',
  marginBottom: 10,
}
const h1 = {
  fontFamily: 'var(--bp-font-sans)',
  fontSize: 'var(--bp-text-2xl)',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: 'var(--bp-ink)',
  marginBottom: 4,
}
const h2 = {
  fontFamily: 'var(--bp-font-mono)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontSize: 'var(--bp-text-sm)',
  color: 'var(--bp-accent-deep)',
  marginTop: 32,
  marginBottom: 8,
}
const meta = { color: 'var(--bp-ink-faint)', fontSize: 'var(--bp-text-sm)', marginBottom: 24,
  fontFamily: 'var(--bp-font-mono)', letterSpacing: '0.04em' }
const li = { marginBottom: 6 }
const link = { color: 'var(--bp-accent-deep)', textDecoration: 'underline' }

export default function PrivacyPolicy() {
  return (
    <div className="biopunk" style={page}>
      <div style={wrap}>
        <div style={kicker}>ELLIE · Privacy</div>
        <h1 style={h1}>Privacy Policy</h1>
        <div style={meta}>Effective date: {EFFECTIVE_DATE}</div>

        <p>
          ELLIE ("the App") is a personal automation tool operated by {OPERATOR} ("we," "us").
          The App publishes content to the operator's own Pinterest account to promote the
          operator's Etsy shop. This policy explains what the App accesses and how that
          information is handled.
        </p>

        <h2 style={h2}>Who this App is for</h2>
        <p>
          ELLIE is a single-operator, personal-use application. It is <strong>not</strong> offered
          to third-party users, and it does not access, collect, or process data belonging to
          anyone other than its operator.
        </p>

        <h2 style={h2}>Information the App accesses</h2>
        <p>
          When the operator connects their Pinterest account via Pinterest's official OAuth flow,
          the App receives an access token that lets it act on the operator's behalf. Using this
          token, the App may:
        </p>
        <ul>
          <li style={li}>Read the operator's Pinterest boards (to choose where to publish).</li>
          <li style={li}>
            Create Pins on the operator's boards that link to the operator's own Etsy product
            listings.
          </li>
        </ul>
        <p>
          The App accesses only the operator's own Pinterest account. It does <strong>not</strong>{' '}
          access other Pinterest users' accounts, profiles, boards, Pins, or any personal data.
        </p>

        <h2 style={h2}>Information the App does NOT collect</h2>
        <ul>
          <li style={li}>
            We do not collect, store, or process personal information about Pinterest users,
            visitors, or customers.
          </li>
          <li style={li}>
            We do not use tracking cookies, advertising identifiers, or analytics on Pinterest
            users.
          </li>
          <li style={li}>We do not buy, sell, rent, or trade any data.</li>
        </ul>

        <h2 style={h2}>How information is stored and secured</h2>
        <p>
          The Pinterest access token is stored privately in the operator's own server environment
          configuration and is used solely to authenticate requests to the Pinterest API. It is not
          shared with any third party. Records the App keeps (such as which of the operator's
          listings have been published) contain only the operator's own business data, not
          third-party personal data.
        </p>

        <h2 style={h2}>Sharing of information</h2>
        <p>
          We do not share any information obtained through the Pinterest API with third parties. The
          only external service the token is used with is Pinterest's own API, for the purpose
          described above.
        </p>

        <h2 style={h2}>Data retention and deletion</h2>
        <p>
          The access token is retained only while the App is in use and is removed when the operator
          disconnects the integration. The operator may revoke the App's access at any time from
          their Pinterest account settings (Settings → Security → Apps), which immediately
          invalidates the token.
        </p>

        <h2 style={h2}>Compliance with Pinterest policies</h2>
        <p>
          The App uses the Pinterest API in accordance with Pinterest's Developer Guidelines, Terms
          of Service, and Advertising Guidelines, and only for publishing the operator's own
          content.
        </p>

        <h2 style={h2}>Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be reflected by
          updating the effective date above.
        </p>

        <h2 style={h2}>Contact</h2>
        <p>
          Questions about this policy can be directed to:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={link}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  )
}
