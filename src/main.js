import Phaser from 'phaser';
import { gameConfig } from './core/GameConfig';
window.addEventListener('load', () => {
    new Phaser.Game(gameConfig);
});
