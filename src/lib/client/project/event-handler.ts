import type { Project } from '$lib/client/project/project';

import { EventEmitter } from '@utils-client/event-emitter';


export class EventHandler {
  private _project: Project;

  private _coreEvents: EventEmitter = new EventEmitter();
  private _editorEvents: EventEmitter = new EventEmitter();

  constructor(project: Project) {
    this._project = project;
  }

  get coreEvents(): EventEmitter {
    return this._coreEvents;
  }

  get editorEvents(): EventEmitter {
    return this._editorEvents;
  }

  emit<K keyof EventEnumType>(event: K keyof EventEnumTypes, ...args: EventEnumTypes[K]); {

  }
}
