import { DiagnosticsSessionService } from './diagnostics-session.service';

describe('DiagnosticsSessionService', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('persists sessionId in sessionStorage across instantiations', () => {
    const a = new DiagnosticsSessionService();
    expect(sessionStorage.getItem('warehouse.session_id')).toBe(a.sessionId);

    const b = new DiagnosticsSessionService();
    expect(b.sessionId).toBe(a.sessionId);
  });

  it('generates a new sessionId when sessionStorage is empty', () => {
    expect(sessionStorage.getItem('warehouse.session_id')).toBeNull();
    const a = new DiagnosticsSessionService();
    expect(a.sessionId).toBeTruthy();
    expect(sessionStorage.getItem('warehouse.session_id')).toBe(a.sessionId);
  });

  it('produces unique tabId per instance (in-memory only)', () => {
    const a = new DiagnosticsSessionService();
    const b = new DiagnosticsSessionService();
    expect(a.tabId).toBeTruthy();
    expect(b.tabId).toBeTruthy();
    expect(a.tabId).not.toBe(b.tabId);
  });

  it('does not persist tabId to sessionStorage', () => {
    const a = new DiagnosticsSessionService();
    expect(sessionStorage.getItem('warehouse.tab_id')).toBeNull();
    expect(a.tabId).toBeTruthy();
  });

  it('newRequestId returns unique values across calls', () => {
    const svc = new DiagnosticsSessionService();
    const ids = new Set<string>();
    for (let i = 0; i < 25; i++) {
      ids.add(svc.newRequestId());
    }
    expect(ids.size).toBe(25);
  });

  it('newDraftId and newIdempotencyKey return UUID-shaped strings', () => {
    const svc = new DiagnosticsSessionService();
    const draftId = svc.newDraftId();
    const idempotencyKey = svc.newIdempotencyKey();

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(draftId).toMatch(uuidRe);
    expect(idempotencyKey).toMatch(uuidRe);
    expect(draftId).not.toBe(idempotencyKey);
  });

  it('exposes frontendVersion from environment (fallback to dev)', () => {
    const svc = new DiagnosticsSessionService();
    expect(typeof svc.frontendVersion).toBe('string');
    expect(svc.frontendVersion.length).toBeGreaterThan(0);
  });

  it('initialises lastServerRequestId as null and allows mutation', () => {
    const svc = new DiagnosticsSessionService();
    expect(svc.lastServerRequestId).toBeNull();
    svc.lastServerRequestId = 'server-uuid-123';
    expect(svc.lastServerRequestId).toBe('server-uuid-123');
  });
});
