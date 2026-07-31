import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { SubmitErrorService, type ErrorGroup } from './submit-error.service';
import { countErroredLines, parseSubmitErrorResponse } from './parser';
import type { RawSubmitErrorEnvelope, SubmitErrorEnvelope } from './envelope';
import {
  FIXTURE_AGGREGATED_LINE_GROUP,
  FIXTURE_INSUFFICIENT_STOCK_WITH_UNIT,
  FIXTURE_STALE_VERSION,
} from './envelope.fixtures';

describe('SubmitErrorService', () => {
  let service: SubmitErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SubmitErrorService] });
    service = TestBed.inject(SubmitErrorService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('setFromHttpError stores groups with stale:false and sets the envelope', () => {
    service.setFromHttpError(FIXTURE_INSUFFICIENT_STOCK_WITH_UNIT);

    const groups = service.groups();
    const ids = Object.keys(groups);
    expect(ids).toHaveLength(1);

    const group: ErrorGroup = groups[ids[0]];
    expect(group.stale).toBe(false);
    expect(group.receivedAt).toEqual(expect.any(Number));
    expect(group.error.kind).toBe('known_line_group');

    expect(service.envelope()).not.toBeNull();
    expect(service.envelope()!.errors).toHaveLength(1);

    expect(service.linesByGroup().get(1)).toBe(group.id);
    expect(service.linesByGroup().get(2)).toBe(group.id);
    expect(service.erroredLineIds()).toEqual([1, 2]);
    expect(service.firstErroredLineId()).toBe(1);
  });

  it('clearAll resets envelope and groups', () => {
    service.setFromHttpError(FIXTURE_INSUFFICIENT_STOCK_WITH_UNIT);
    expect(Object.keys(service.groups())).toHaveLength(1);

    service.clearAll();

    expect(service.envelope()).toBeNull();
    expect(service.groups()).toEqual({});
    expect(service.linesByGroup().size).toBe(0);
    expect(service.erroredLineIds()).toEqual([]);
    expect(service.firstErroredLineId()).toBeNull();
  });

  it('invalidateByLineIds marks the whole intersecting group as stale, not just one line', () => {
    service.setFromHttpError(FIXTURE_AGGREGATED_LINE_GROUP); // operation_line_ids [1, 4]
    const groupId = Object.keys(service.groups())[0];
    expect(service.groups()[groupId].stale).toBe(false);

    service.invalidateByLineIds([1]);

    const group = service.groups()[groupId];
    expect(group.stale).toBe(true);

    service.clearAll();
    service.setFromHttpError(FIXTURE_AGGREGATED_LINE_GROUP);
    service.invalidateByLineIds([99]);

    expect(Object.values(service.groups())[0].stale).toBe(false);
  });

  it('clearByLineIds removes groups fully covered by the given lines and keeps partial overlaps', () => {
    service.setFromHttpError(FIXTURE_AGGREGATED_LINE_GROUP); // operation_line_ids [1, 4]

    service.clearByLineIds([1]);
    expect(Object.keys(service.groups())).toHaveLength(1);

    service.clearByLineIds([4]);
    expect(Object.keys(service.groups())).toHaveLength(1);

    service.clearByLineIds([1, 4]);
    expect(service.groups()).toEqual({});
  });

  it('firstErroredLineId returns the first line of the first group', () => {
    service.setFromHttpError(makeTwoGroupRawEnvelope());

    expect(service.erroredLineIds()).toEqual([1, 4, 9]);
    expect(service.firstErroredLineId()).toBe(1);
  });

  it('countErroredLines dedupes line ids across groups', () => {
    const envelope = parseSubmitErrorResponse(makeTwoGroupRawEnvelope())
      .envelope as SubmitErrorEnvelope;

    // groups [1,4] and [4,9] → unique ids {1, 4, 9} = 3
    expect(countErroredLines(envelope)).toBe(3);
  });

  it('lifecycle: clearAll on destroy/init prevents state leaking between mounts', () => {
    // mount #1: submit fails, error state is stored
    service.setFromHttpError(FIXTURE_STALE_VERSION);
    expect(service.envelope()).not.toBeNull();
    expect(Object.keys(service.groups())).toHaveLength(1);

    // destroy
    service.clearAll();
    // mount #2: ngOnInit calls clearAll again — nothing from the previous mount is visible
    service.clearAll();

    expect(service.envelope()).toBeNull();
    expect(service.groups()).toEqual({});
    expect(service.firstErroredLineId()).toBeNull();
  });

  it('lifecycle: a component-level provider yields a fresh instance per mount', () => {
    const injector1 = Injector.create({ providers: [SubmitErrorService] });
    const svc1 = injector1.get(SubmitErrorService);
    svc1.setFromHttpError(FIXTURE_INSUFFICIENT_STOCK_WITH_UNIT);
    expect(Object.keys(svc1.groups())).toHaveLength(1);
    expect(svc1.envelope()).not.toBeNull();

    // A second mount gets its own instance with no shared state.
    const injector2 = Injector.create({ providers: [SubmitErrorService] });
    const svc2 = injector2.get(SubmitErrorService);

    expect(svc2).not.toBe(svc1);
    expect(svc2.envelope()).toBeNull();
    expect(svc2.groups()).toEqual({});
    expect(svc2.firstErroredLineId()).toBeNull();
  });
});

function makeTwoGroupRawEnvelope(): RawSubmitErrorEnvelope {
  return {
    type: 'urn:warehouse:problem:operation-submit-rejected',
    title: 'Недостаточно товара',
    status: 409,
    code: 'operation-submit-rejected',
    detail: 'Недостаточно товара: две группы.',
    errors: [
      {
        code: 'insufficient_stock',
        scope: 'line_group',
        operation_line_ids: [1, 4],
        item: { id: 100, name: 'Кабель' },
        stock_site: { id: 1, name: 'Основной склад' },
        required_qty: '120.000',
        available_qty: '80.000',
      },
      {
        code: 'insufficient_stock',
        scope: 'line_group',
        operation_line_ids: [4, 9],
        item: { id: 101, name: 'Болт' },
        stock_site: { id: 1, name: 'Основной склад' },
        required_qty: '40.000',
        available_qty: '10.000',
      },
    ],
  };
}
