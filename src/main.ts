import { DIFFICULTIES } from './domain/config';

const root = document.querySelector('#app');
if (root) {
  root.textContent = DIFFICULTIES.discovery.label;
}
