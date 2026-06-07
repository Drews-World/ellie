import PersonalPage from './PersonalPage'

// Owner Suite — Drew's personal command floor (calendar, notes, goals, prayer,
// ELLIE memory). Renders the personal widgets inside the biopunk page shell.
export default function OwnerSuitePage() {
  return (
    <div className="biopunk" style={{ minHeight: '100%', padding: 'clamp(20px, 3vw, 40px)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <PersonalPage />
      </div>
    </div>
  )
}
