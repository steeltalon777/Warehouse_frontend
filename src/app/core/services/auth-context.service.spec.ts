import { TestBed } from '@angular/core/testing';
import { AuthContextService } from './auth-context.service';
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

  it('load() falls back to mock on error', async () => {
    bffMock.getData.mockReturnValue(throwError(() => ({ code: 'server_error', message: 'fail' })));

    await service.load();

    const ctx = service.authContext();
    expect(ctx).toBeTruthy();
    expect(ctx!.userId).toBe('mock-user');
    expect(ctx!.role).toBe('root');
    expect(ctx!.defaultSiteId).toBeNull();
  });
});
