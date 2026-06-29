import { useMemo } from 'react'
import { createPiService } from './services/createPiService'
import { piAccessToken, piServerUrl } from './lib/piServer'
import { useAppStore } from './hooks/useAppStore'
import { Sidebar } from './components/Sidebar'
import { MobileNavDrawer, MobileTopBar } from './components/MobileChrome'
import { HomeScreen } from './components/HomeScreen'
import { SessionScreen } from './components/SessionScreen'
import { ReviewScreen } from './components/ReviewScreen'
import { ComposeScreen } from './components/ComposeScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { WorkPanel } from './components/WorkPanel'
import { SessionTree } from './components/SessionTree'

export default function App() {
  // The service is the seam to the Pi Remote Server. With VITE_PI_SERVER_URL set
  // it talks to the live /client socket; otherwise it falls back to the mock.
  const service = useMemo(() => createPiService(piServerUrl, piAccessToken), [])
  const { state, patch, mobile, sessions, activeSession, actions } = useAppStore(service)

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--pi-paper)' }}>
      {!mobile && (
        <Sidebar
          route={state.route}
          sessions={sessions}
          activeId={state.activeId}
          onHome={actions.goHome}
          onSettings={actions.goSettings}
          onOpenSession={actions.openSession}
        />
      )}

      <main style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {mobile && <MobileTopBar onToggleNav={() => patch((s) => ({ mobileNav: !s.mobileNav }))} />}

        {state.route === 'home' && (
          <HomeScreen
            sessions={sessions}
            filter={state.homeFilter}
            onFilter={(key) => patch({ homeFilter: key })}
            onOpenSession={actions.openSession}
          />
        )}

        {state.route === 'session' && activeSession && (
          <SessionScreen
            session={activeSession}
            step={state.step}
            mobile={mobile}
            model={state.model}
            modelMenu={state.modelMenu}
            rightOpen={state.rightOpen}
            composer={state.composer}
            sendMode={state.sendMode}
            queued={state.queued}
            genuiTheme={state.genuiTheme}
            onToggleModelMenu={() => patch((s) => ({ modelMenu: !s.modelMenu }))}
            onPickModel={(id) => patch({ model: id, modelMenu: false })}
            onToggleTree={() => patch((s) => ({ treeOpen: !s.treeOpen, modelMenu: false }))}
            onToggleRight={() => patch((s) => ({ rightOpen: !s.rightOpen }))}
            onGoHome={actions.goHome}
            onComposerChange={(v) => patch({ composer: v })}
            onSend={() => actions.doSend(state.sendMode)}
            onSendMode={(mode) => patch({ sendMode: mode })}
            onRemoveQueued={(i) => patch((s) => ({ queued: s.queued.filter((_, j) => j !== i) }))}
            onStop={actions.stopRun}
            onToggleGenuiTheme={() => patch((s) => ({ genuiTheme: s.genuiTheme === 'dark' ? 'light' : 'dark' }))}
            onPickOption={actions.pickOption}
            onReview={actions.goReview}
          />
        )}

        {state.route === 'review' && activeSession && (
          <ReviewScreen
            session={activeSession}
            diffIndex={state.diffIndex}
            onSelectDiff={(i) => patch({ diffIndex: i })}
            onBack={actions.backToSession}
          />
        )}

        {state.route === 'compose' && (
          <ComposeScreen
            composeText={state.composeText}
            composeRepo={state.composeRepo}
            repoMenu={state.repoMenu}
            skills={state.skills}
            onComposeText={(v) => patch({ composeText: v })}
            onToggleRepoMenu={() => patch((s) => ({ repoMenu: !s.repoMenu }))}
            onPickRepo={(name) => patch({ composeRepo: name, repoMenu: false })}
            onToggleSkill={(key) => patch((s) => ({ skills: { ...s.skills, [key]: !s.skills[key] } }))}
            onUseExample={(text) => patch({ composeText: text })}
            onStart={actions.startTask}
          />
        )}

        {state.route === 'settings' && <SettingsScreen />}
      </main>

      {/* Slide-overs (session-scoped) */}
      {state.rightOpen && activeSession && (
        <WorkPanel
          session={activeSession}
          tab={state.rightTab}
          diffIndex={state.diffIndex}
          onTab={(tab) => patch({ rightTab: tab })}
          onSelectDiff={(i) => patch({ diffIndex: i, rightTab: 'diff', rightOpen: true })}
          onClose={() => patch((s) => ({ rightOpen: !s.rightOpen }))}
        />
      )}

      {state.treeOpen && activeSession && (
        <SessionTree session={activeSession} onClose={() => patch((s) => ({ treeOpen: !s.treeOpen }))} onRewind={() => patch({ treeOpen: false })} />
      )}

      {state.mobileNav && (
        <MobileNavDrawer
          sessions={sessions}
          onClose={() => patch((s) => ({ mobileNav: !s.mobileNav }))}
          onHome={actions.goHome}
          onSettings={actions.goSettings}
          onOpenSession={actions.openSession}
        />
      )}
    </div>
  )
}
