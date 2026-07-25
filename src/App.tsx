/**
 * App — root component. Hosts the Three.js canvas (via a ref handed to the
 * Game engine) and overlays React UI based on the current game phase.
 *
 * The Game instance is created once on mount and lives for the session;
 * React only reads/writes the observable GameState store.
 */
import { useEffect, useRef, useState } from 'react';
import { Game } from '@/game/Game';
import { gameState, useGameState } from '@/game/GameState';
import { DEFAULT_SETTINGS, type Settings } from '@/game/types';
import { HUD } from '@/ui/HUD';
import { MainMenu } from '@/ui/MainMenu';
import { SettingsScreen } from '@/ui/SettingsScreen';
import { PauseMenu } from '@/ui/PauseMenu';
import { UpgradeScreen } from '@/ui/UpgradeScreen';
import { EndScreen } from '@/ui/EndScreen';
import { Cutscene } from '@/ui/Cutscene';
import { Codex } from '@/ui/Codex';
import { StoryModal } from '@/ui/StoryModal';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { phase, settings } = useGameState();

  const [bootError, setBootError] = useState<string | null>(null);
  const [showCodex, setShowCodex] = useState(false);

  // Boot the engine once
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    try {
      const game = new Game(containerRef.current, DEFAULT_SETTINGS);
      gameRef.current = game;
      game.start();
    } catch (err) {
      console.error('Game failed to start:', err);
      setBootError(err instanceof Error ? err.message : String(err));
    } finally {
      // Always remove the boot loader, even on failure, so the user
      // never gets stuck on the pulsing loading dot forever.
      const boot = document.getElementById('boot');
      if (boot) boot.remove();
    }

    return () => {
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, []);

  const handleStart = (): void => {
    setShowSettings(false);
    setShowCodex(false);
    gameRef.current?.startNewRun();
  };

  const handleSettingsChange = (s: Settings): void => {
    gameRef.current?.updateSettings(s);
  };

  const handleResume = (): void => {
    setShowCodex(false);
    gameRef.current?.resume();
  };

  const handleSelectUpgrade = (id: string): void => {
    gameRef.current?.selectUpgrade(id);
  };

  const handleCloseStory = (): void => {
    gameRef.current?.closeStoryModal();
  };

  const handleRestart = (): void => {
    setShowSettings(false);
    gameRef.current?.restart();
  };

  const handleQuit = (): void => {
    setShowSettings(false);
    gameRef.current?.toMenu();
  };

  // Which overlay to render
  const renderOverlay = (): React.ReactNode => {
    if (showSettings && (phase === 'menu' || phase === 'paused')) {
      return (
        <SettingsScreen
          settings={settings}
          onChange={handleSettingsChange}
          onBack={() => setShowSettings(false)}
          inGame={phase === 'paused'}
        />
      );
    }

    switch (phase) {
      case 'menu':
        return <MainMenu onStart={handleStart} onOpenSettings={() => setShowSettings(true)} />;
      case 'cutscene':
        return <Cutscene onFinish={handleStart} />;
      case 'playing':
        return <HUD />;
      case 'paused':
        return (
          <PauseMenu
            onResume={handleResume}
            onSettings={() => setShowSettings(true)}
            onRestart={handleRestart}
            onQuit={handleQuit}
          />
        );
      case 'upgrade':
        return <UpgradeScreen onSelect={handleSelectUpgrade} />;
      case 'codex':
        return <Codex onClose={handleResume} />;
      case 'story':
        return <StoryModal onClose={handleCloseStory} />;
      case 'gameover':
      case 'victory':
        return <EndScreen onRestart={handleRestart} onMenu={handleQuit} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, background: '#05050a' }}
      />
      {bootError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(5,5,10,0.92)',
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 480,
              background: '#120808',
              border: '1px solid #b91c1c66',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 0 32px #b91c1c33',
            }}
          >
            <h2 style={{ color: '#ef4444', margin: 0, fontSize: 22, letterSpacing: '0.05em' }}>
              GAME FAILED TO START
            </h2>
            <p style={{ color: '#c0c0c0', marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>
              Something went wrong while loading the game. The error was:
            </p>
            <pre
              style={{
                color: '#fca5a5',
                background: '#1a0a0a',
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowX: 'auto',
              }}
            >
              {bootError}
            </pre>
            <p style={{ color: '#808080', marginTop: 12, fontSize: 12 }}>
              Try refreshing the page. If this persists, open your browser
              console (F12) for more detail.
            </p>
          </div>
        </div>
      )}
      {renderOverlay()}
      {showCodex && phase === 'paused' && <Codex onClose={() => setShowCodex(false)} />}
    </div>
  );
}

export default App;

// Ensure gameState is referenced so tree-shaking keeps it
void gameState;
