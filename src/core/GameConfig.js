import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { GameScene } from '../scenes/GameScene';
import { ResultScene } from '../scenes/ResultScene';
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
export const gameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: { x: 0, y: 0 },
            debug: false,
        },
    },
    backgroundColor: '#0d0e12',
    scene: [BootScene, GameScene, ResultScene],
    input: {
        mouse: {
            preventDefaultWheel: true,
        },
        touch: false,
    },
    render: {
        pixelArt: false,
        antialias: true,
    },
};
