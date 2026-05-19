type ErrorKind = 'runtime' | 'promise' | 'network' | 'manual';

interface ErrorEntry {
  id: string;
  timestamp: string;
  type: ErrorKind;
  message: string;
  stack: string | null;
  url: string;
  context: Record<string, unknown>;
}

interface StateSnapshot {
  timestamp: string;
  url: string;
  taskCount: number;
  subjectCount: number;
  activeView: string | null;
}

interface SessionReport {
  sessionId: string;
  startedAt: string;
  exportedAt: string;
  crashDetected: boolean;
  errors: ErrorEntry[];
  stateHistory: StateSnapshot[];
}

const MAX_ERRORS = 100;
const MAX_SNAPSHOTS = 50;

class SessionRecorder {
  private static _instance: SessionRecorder | null = null;

  private readonly sessionId: string;
  private readonly startedAt: string;
  private errors: ErrorEntry[] = [];
  private snapshots: StateSnapshot[] = [];
  private crashDetected = false;

  private constructor() {
    this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.startedAt = new Date().toISOString();
  }

  static getInstance(): SessionRecorder {
    if (!SessionRecorder._instance) {
      SessionRecorder._instance = new SessionRecorder();
    }
    return SessionRecorder._instance;
  }

  recordError(
    error: unknown,
    type: ErrorKind = 'runtime',
    context: Record<string, unknown> = {}
  ): void {
    const entry: ErrorEntry = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      type,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? null) : null,
      url: window.location.href,
      context,
    };

    this.errors.push(entry);
    if (this.errors.length > MAX_ERRORS) this.errors.shift();
  }

  recordState(snapshot: Omit<StateSnapshot, 'timestamp' | 'url'>): void {
    this.snapshots.push({
      ...snapshot,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });
    if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift();
  }

  markCrash(): void {
    this.crashDetected = true;
  }

  getReport(): SessionReport {
    return {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      exportedAt: new Date().toISOString(),
      crashDetected: this.crashDetected,
      errors: [...this.errors],
      stateHistory: [...this.snapshots],
    };
  }

  downloadReport(): void {
    const report = this.getReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `studyplan-session-${this.sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

export const sessionRecorder = SessionRecorder.getInstance();

export function initSessionRecorder(): void {
  window.addEventListener('error', (ev) => {
    sessionRecorder.recordError(
      ev.error ?? new Error(ev.message),
      'runtime',
      { filename: ev.filename, lineno: ev.lineno, colno: ev.colno }
    );
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason =
      ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason ?? 'Unhandled rejection'));
    sessionRecorder.recordError(reason, 'promise');
  });
}
