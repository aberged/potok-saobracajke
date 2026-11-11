import { render } from 'lit-html';
import { boot, setActionsTranslator } from './store/actions';
import { onChange } from './store/state';
import { appView } from './views/app';
import { setUi, ui } from './views/common';

if (import.meta.env.DEV) {
  const { seedDev } = await import('./dev-tools');
  const { installDevPotok } = await import('./potok-dev');
  seedDev();
  installDevPotok();
}

// No top-level await below this point: the build wrapper (vite.config.ts) runs
// this code inside a plain function.

const root = document.querySelector<HTMLElement>('#saobracajke')!;

setUi(document.documentElement.lang);
setActionsTranslator(ui.t);
onChange(() => render(appView(), root));
render(appView(), root);
void boot();
