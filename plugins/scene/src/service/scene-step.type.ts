import type { HistoryCommand } from '@nanoforge-dev/editor-sdk';

/** One step of a command made of steps run one after the other (each computed on the result of the previous ones). */
export type Step = () => Promise<HistoryCommand | undefined>;
