import { type Unsubscriber, get, writable } from 'svelte/store';

import type { AssetPkg } from '$lib/client/action';
import { useProject } from '$lib/client/project';

import { assetTransformer, assetsTransformer } from '../transformers';
import { resetSubscriptions } from '../utils';
import { AssetHandle } from './asset-handle';
import type { Asset } from './asset.type';

const _storage = writable<Asset[]>([]);

const _subscriptions = writable<Record<string, Unsubscriber | null>>({});

export class AssetManager {
  static reset() {
    _storage.set([]);
    resetSubscriptions(_subscriptions);
  }

  constructor(assets: Asset[]) {
    _storage.set(assets);
  }

  get store() {
    return _storage;
  }

  get data() {
    return get(_storage);
  }

  async createMany(files: File[]): Promise<void> {
    const { fs } = useProject();

    await Promise.all(files.map(this.create.bind(this)));

    await this.sync();
    const dir = await fs.getDirectory();
    await dir.readdir(true);
  }

  async create(file: File): Promise<void> {
    const { fs } = useProject();
    const assetDir = await fs.getDirectory('static');
    const assetFile = await assetDir.getFile(file.name);
    const stream = await assetFile.createWritable();
    await file.stream().pipeTo(stream);
    await assetFile.sync();
  }

  add(asset: AssetPkg) {
    this._add(assetTransformer(asset));
  }

  async sync() {
    const { actions } = useProject();
    const assets = await actions.package.getAssets();
    _storage.set(assetsTransformer(assets));
  }

  get(id: string): AssetHandle {
    const asset = get(_storage).find((asset) => asset.id === id);
    if (!asset) throw new Error(`Asset with id ${id} not found`);
    const handle = new AssetHandle(this, asset);

    this._subscribe(id, handle);

    return handle;
  }

  async delete(id: string) {
    const assets = get(_storage);
    const asset = assets.find((c) => c.id === id);

    if (!asset) throw new Error(`System not found: ${id}`);

    _storage.set(assets.filter((c) => c.id !== id));
    const { fs } = useProject();
    const file = await fs.getFile(asset.path);
    await file.delete();

    const subscriptions = get(_subscriptions);
    if (subscriptions[id]) {
      subscriptions[id]();
      subscriptions[id] = null;
      _subscriptions.set(subscriptions);
    }
  }

  private _add(asset: Asset) {
    const assets = get(_storage);
    assets.push(asset);
    _storage.set(assets);
  }

  private _subscribe(id: string, handle: AssetHandle) {
    setTimeout(() => {
      const subscriptions = get(_subscriptions);
      if (subscriptions[id]) return;
      subscriptions[id] = handle.store.subscribe((asset) => this._update(id, asset));
      _subscriptions.set(subscriptions);
    }, 0);
  }

  private _update(id: string, asset: Asset) {
    const assets = get(_storage);
    const index = assets.findIndex((s) => s.id === id);
    if (index === -1) return;
    assets[index] = asset;
    _storage.set(assets);
  }
}
