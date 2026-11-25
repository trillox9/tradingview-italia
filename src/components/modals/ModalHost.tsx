import { useEffect } from 'react';
import { TIMEFRAMES } from '../../types';
import { useTradingView } from '../../store';
import '../../styles/modals.css';
import { SymbolSearchModal } from './SymbolSearchModal';
import { IndicatorsModal } from './IndicatorsModal';
import { CompareSymbolModal } from './CompareSymbolModal';
import { CreateAlertModal } from './CreateAlertModal';
import { ChartSettingsModal } from './ChartSettingsModal';
import { ShortcutsModal } from './ShortcutsModal';
import { SnapshotModal } from './SnapshotModal';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

export function ModalHost() {
  const {
    route,
    modals,
    openModal,
    closeAllModals,
    setActiveTool,
    setTimeframe,
  } = useTradingView();

  const anyModalOpen = Object.values(modals).some(Boolean);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const mod = e.ctrlKey || e.metaKey;
      const inEditable = isEditableTarget(e.target);

      // Ctrl+K / Cmd+K opens Global Symbol Search from anywhere (idempotent)
      if (mod && key.toLowerCase() === 'k') {
        e.preventDefault();
        openModal('symbolSearch');
        return;
      }

      // Escape closes any open modal, or resets chart tool to crosshair
      if (key === 'Escape') {
        if (anyModalOpen) {
          e.preventDefault();
          closeAllModals();
        } else if (!inEditable) {
          setActiveTool('crosshair');
        }
        return;
      }

      // Ignore non-modifier shortcuts while typing in inputs/textareas
      if (inEditable) return;

      // `/` opens Global Symbol Search when no modal is open
      if (key === '/' && !mod && !e.altKey && !anyModalOpen) {
        e.preventDefault();
        openModal('symbolSearch');
        return;
      }

      // `?` opens Keyboard Shortcuts modal (idempotent)
      if (key === '?' && !mod && !e.altKey) {
        e.preventDefault();
        openModal('shortcuts');
        return;
      }

      // `1`..`8` switch chart timeframe when on Supercharts and no modal is open
      if (
        route.view === 'chart' &&
        !mod &&
        !e.altKey &&
        !e.shiftKey &&
        !anyModalOpen &&
        key >= '1' &&
        key <= '8'
      ) {
        const tf = TIMEFRAMES[Number(key) - 1];
        if (tf) {
          e.preventDefault();
          setTimeframe(tf);
          return;
        }
      }

      // Alt+A opens Create Alert modal
      if (e.altKey && !mod && key.toLowerCase() === 'a') {
        e.preventDefault();
        openModal('alert');
        return;
      }

      // Alt+S opens Snapshot modal
      if (e.altKey && !mod && key.toLowerCase() === 's') {
        e.preventDefault();
        openModal('snapshot');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    anyModalOpen,
    closeAllModals,
    openModal,
    route.view,
    setActiveTool,
    setTimeframe,
  ]);

  return (
    <>
      {modals.symbolSearch && <SymbolSearchModal />}
      {modals.indicators && <IndicatorsModal />}
      {modals.compare && <CompareSymbolModal />}
      {modals.alert && <CreateAlertModal />}
      {modals.settings && <ChartSettingsModal />}
      {modals.shortcuts && <ShortcutsModal />}
      {modals.snapshot && <SnapshotModal />}
    </>
  );
}

export default ModalHost;
