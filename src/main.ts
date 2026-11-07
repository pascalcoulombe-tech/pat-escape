import './ui/styles.css';
import { boot } from './ui/app';

const root = document.querySelector('#app');
if (root instanceof HTMLElement) boot(root);
