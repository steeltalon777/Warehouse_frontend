import { TestBed } from '@angular/core/testing';
import { AuthContextService, canWriteCatalogForMode, hasCatalogManagementAccess } from './auth-context.service';
import { BffApiService } from '../api/bff-api.service';
import { of, throwError } from 'rxjs';

describe('AuthContextService', () => {
  let service: AuthContextService;
  let bffMock: { getData: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    bffMock = {
      getData: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthContextService,
        { provide: BffApiService, useValue: bffMock },
      ],
    });

    service = TestBed.inject(AuthContextService);
  });

  it('load() sets authContext from BFF response', async () => {
    bffMock.getData.mockReturnValue(
      of({ user_id: 'u-123', role: 'storekeeper', default_site_id: 'site-1' })
    );

    await service.load();

    const ctx = service.authContext();
    expect(ctx).toBeTruthy();
    expect(ctx!.userId).toBe('u-123');
    expect(ctx!.role).toBe('storekeeper');
    expect(ctx!.defaultSiteId).toBe('site-1');
    expect(ctx!.canManageCatalog).toBeUndefined();
  });

  it('load() sets authContext with null defaultSiteId when absent', async () => {
    bffMock.getData.mockReturnValue(of({ user_id: 'u-456', role: 'root' }));

    await service.load();

    const ctx = service.authContext();
    expect(ctx).toBeTruthy();
    expect(ctx!.userId).toBe('u-456');
    expect(ctx!.role).toBe('root');
    expect(ctx!.defaultSiteId).toBeNull();
  });

  it('load() fails closed on error', async () => {
    bffMock.getData.mockReturnValue(throwError(() => ({ code: 'server_error', message: 'fail' })));

    await service.load();

    expect(service.authContext()).toBeNull();
    expect(service.canManageCatalog()).toBe(false);
  });

  it('prefers explicit can_manage_catalog over role fallback', async () => {
    bffMock.getData.mockReturnValue(
      of({
        user_id: 'u-789',
        role: 'root',
        can_manage_catalog: false,
      })
    );

    await service.load();

    const ctx = service.authContext();
    expect(ctx).toBeTruthy();
    expect(ctx!.canManageCatalog).toBe(false);
    expect(service.canManageCatalog()).toBe(false);
    expect(canWriteCatalogForMode('editable', ctx)).toBe(false);
  });

  it('uses explicit nested can_manage_catalog when present', async () => {
    bffMock.getData.mockReturnValue(
      of({
        data: {
          user: {
            id: 'u-999',
            role: 'observer',
            can_manage_catalog: true,
          },
        },
      })
    );

    await service.load();

    const ctx = service.authContext();
    expect(ctx).toBeTruthy();
    expect(ctx!.canManageCatalog).toBe(true);
    expect(service.canManageCatalog()).toBe(true);
  });

  it('fails closed when explicit can_manage_catalog has unknown shape', async () => {
    bffMock.getData.mockReturnValue(
      of({
        user_id: 'u-321',
        role: 'chief_storekeeper',
        can_manage_catalog: 'yes',
      })
    );

    await service.load();

    const ctx = service.authContext();
    expect(ctx).toBeTruthy();
    expect(ctx!.canManageCatalog).toBe(false);
    expect(service.canManageCatalog()).toBe(false);
  });

  it('canWriteCatalogForMode requires editable mode and catalog management access', () => {
    expect(canWriteCatalogForMode('editable', null)).toBe(false);
    expect(canWriteCatalogForMode('readonly', { role: 'root' })).toBe(false);
    expect(canWriteCatalogForMode('editable', { role: 'observer' })).toBe(false);
    expect(canWriteCatalogForMode('editable', { role: 'chief_storekeeper' })).toBe(true);
    expect(canWriteCatalogForMode('editable', { role: 'root', canManageCatalog: false })).toBe(false);
    expect(canWriteCatalogForMode('editable', { role: 'observer', canManageCatalog: true })).toBe(true);
    expect(hasCatalogManagementAccess({ role: 'root' })).toBe(true);
  });
});
