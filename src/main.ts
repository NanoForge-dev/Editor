import { mount } from 'svelte';
import 'uno.css';

import App from './App.svelte';
import './app.css';

const app = mount(App, {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  target: document.getElementById('app')!,
});

export default app;
