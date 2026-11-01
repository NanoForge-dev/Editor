import { describe, expect, it, vi } from 'vitest';

import { changeGroups } from '../../../src/model/change-groups';
import {
  type ChangeGroup,
  GROUP_STOP,
  groupOfStop,
  keyStops,
} from '../../../src/widgets/commit/change-group';
import { type ChangesKeyContext, onChangesKey } from '../../../src/widgets/commit/changes-keys';
import { status } from '../../fixtures/status';

const lists = changeGroups(status());
const groups: ChangeGroup[] = [
  { id: 'changes', title: 'Changes', rows: lists.changes, checkable: true },
  { id: 'unversioned', title: 'Unversioned files', rows: lists.unversioned, checkable: true },
];

const setup = (current: string | undefined, selected: string[] = []) => {
  const folded = new Set<string>();
  const panel = {
    checked: new Set<string>() as ReadonlySet<string>,
    selected: selected as readonly string[],
    selectedGroup: undefined as ChangeGroup['id'] | undefined,
    isFolded: (group: ChangeGroup) => folded.has(group.id),
    setFolded: vi.fn((group: ChangeGroup, on: boolean) => {
      if (on) folded.add(group.id);
      else folded.delete(group.id);
    }),
    setChecked: vi.fn((paths: readonly string[], on: boolean) => {
      panel.checked = new Set(on ? paths : []);
    }),
  };
  const rows = groups.flatMap((group) => group.rows);
  const selectedRows = rows.filter((row) => selected.includes(row.file.path));
  const context: ChangesKeyContext = {
    panel,
    stops: keyStops(groups, panel.isFolded),
    current,
    visiblePaths: rows.map((row) => row.file.path),
    selectedRows,
    unversionedSelected: selectedRows.filter((row) => row.letter === 'U'),
    groupOf: (stop) => groupOfStop(groups, stop),
    goTo: vi.fn(),
    showDiff: vi.fn(),
    jumpToSource: vi.fn(),
    rollback: vi.fn(),
  };
  return { panel, context };
};

const press = (context: ChangesKeyContext, key: string, init: Partial<KeyboardEvent> = {}) => {
  const target = {};
  const event = {
    key,
    target,
    currentTarget: target,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...init,
  };
  onChangesKey(event as unknown as KeyboardEvent, context);
  return event;
};

describe('onChangesKey', () => {
  it('moves the cursor down from a group node to its first file', () => {
    const { context } = setup(`${GROUP_STOP}changes`);
    const event = press(context, 'ArrowDown');
    expect(context.goTo).toHaveBeenCalledWith(lists.changes[0]!.file.path, false);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('folds a group with Left, and goes up to the group from a file', () => {
    const atGroup = setup(`${GROUP_STOP}changes`);
    press(atGroup.context, 'ArrowLeft');
    expect(atGroup.panel.setFolded).toHaveBeenCalledWith(groups[0], true);
    const path = lists.changes[0]!.file.path;
    const atFile = setup(path, [path]);
    press(atFile.context, 'ArrowLeft');
    expect(atFile.context.goTo).toHaveBeenCalledWith(`${GROUP_STOP}changes`);
  });

  it("includes a group's files with Space, and the selection outside groups", () => {
    const atGroup = setup(`${GROUP_STOP}unversioned`);
    press(atGroup.context, ' ');
    expect(atGroup.panel.setChecked).toHaveBeenCalledWith(
      lists.unversioned.map((row) => row.file.path),
      true,
    );
    const path = lists.changes[0]!.file.path;
    const atFile = setup(path, [path]);
    press(atFile.context, ' ');
    expect(atFile.panel.setChecked).toHaveBeenCalledWith([path], true);
  });

  it('shows the diff with Enter and deletes unversioned files with Delete', () => {
    const path = lists.unversioned[0]!.file.path;
    const { context } = setup(path, [path]);
    press(context, 'Enter');
    expect(context.showDiff).toHaveBeenCalledWith(lists.unversioned[0]);
    press(context, 'Delete');
    expect(context.rollback).toHaveBeenCalledWith([lists.unversioned[0]], 'Delete');
  });

  it('leaves other keys and keys from inside a row alone', () => {
    const { context } = setup(undefined);
    expect(press(context, 'x').preventDefault).not.toHaveBeenCalled();
    expect(
      press(context, 'ArrowDown', { target: {} as EventTarget }).preventDefault,
    ).not.toHaveBeenCalled();
    expect(context.goTo).not.toHaveBeenCalled();
  });
});
