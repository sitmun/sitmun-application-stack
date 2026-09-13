/** Frozen grammar. Keep identical to sitmun-admin-app .../mia-mapping-testid.ts. */

export type MappingSide = 'mia' | 'child';

export type MappingOwner =
  | {readonly kind: 'included'; readonly taskId: number}
  | {
      readonly kind: 'template';
      readonly rootTemplateTaskId: number;
      readonly childTaskId: number;
      readonly referenceAlias: string;
      readonly depth: number;
    };

export type MappingSelectRef = {
  readonly owner: MappingOwner;
  readonly rowIndex: number;
  readonly side: MappingSide;
};

export type MappingOptionRef = MappingSelectRef & {
  readonly label: string;
};

export type MappingRowIds = {
  readonly miaSelect: string;
  readonly childSelect: string;
  readonly option: (side: MappingSide, label: string) => string;
};

const SEP = '--';

export function includedOwner(taskId: number): MappingOwner {
  return {kind: 'included', taskId};
}

export function templateOwner(parts: {
  readonly rootTemplateTaskId: number;
  readonly childTaskId: number;
  readonly referenceAlias: string;
  readonly depth: number;
}): MappingOwner {
  return {kind: 'template', ...parts};
}

function encodeToken(value: string): string {
  return encodeURIComponent(value).replace(/-/g, '%2D');
}

function ownerBody(owner: MappingOwner): string {
  switch (owner.kind) {
    case 'included':
      return String(owner.taskId);
    case 'template':
      return [
        owner.rootTemplateTaskId,
        owner.childTaskId,
        encodeToken(owner.referenceAlias),
        owner.depth
      ].join(SEP);
    default: {
      const exhaustive: never = owner;
      return exhaustive;
    }
  }
}

export function mappingSelectTestId(ref: MappingSelectRef): string {
  return ['mia-mapping-select', ref.owner.kind, ownerBody(ref.owner), ref.rowIndex, ref.side].join(SEP);
}

export function mappingOptionTestId(ref: MappingOptionRef): string {
  if (!ref.label) {
    throw new Error('mapping option test id requires a non-empty label');
  }
  return [
    'mia-mapping-option',
    ref.owner.kind,
    ownerBody(ref.owner),
    ref.rowIndex,
    ref.side,
    encodeToken(ref.label)
  ].join(SEP);
}

export function mappingAddTestId(owner: MappingOwner): string {
  return ['mia-mapping-add', owner.kind, ownerBody(owner)].join(SEP);
}

export function mappingRowIds(owner: MappingOwner, rowIndex: number): MappingRowIds {
  return {
    miaSelect: mappingSelectTestId({owner, rowIndex, side: 'mia'}),
    childSelect: mappingSelectTestId({owner, rowIndex, side: 'child'}),
    option: (side, label) => mappingOptionTestId({owner, rowIndex, side, label})
  };
}
