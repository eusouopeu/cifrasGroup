import { Tuner } from './Tuner'

export function TunerTab() {
  return (
    <div className="library">
      <header className="apphead">
        <h1>Afinação</h1>
      </header>
      <Tuner embedded />
    </div>
  )
}
