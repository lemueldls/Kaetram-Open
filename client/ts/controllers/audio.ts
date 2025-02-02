import _ from 'underscore';

import Game from '../game';
import Detect from '../utils/detect';
import Modules from '../utils/modules';

interface Song extends HTMLAudioElement {
    name: string;
    fadingIn: number;
    fadingOut: number;
}

export default class Audio {
    audibles: { [name: string]: HTMLAudioElement[] };
    format: string;
    song: Song;
    songName: string;
    enabled: boolean;
    music: { [key: string]: boolean };
    sounds: { [key: string]: boolean };
    newSong: string;

    constructor(public game: Game) {
        this.game = game;

        this.audibles = {};
        this.format = 'mp3';

        this.song = null;
        this.songName = null;

        this.enabled = true;

        this.load();
    }

    load() {
        this.music = {
            codingroom: false,
            smalltown: false,
            village: false,
            beach: false,
            spookyship: false,
            meadowofthepast: false
        };

        this.sounds = {
            loot: false,
            hit1: false,
            hit2: false,
            hurt: false,
            heal: false,
            chat: false,
            revive: false,
            death: false,
            firefox: false,
            achievement: false,
            kill1: false,
            kill2: false,
            noloot: false,
            teleport: false,
            chest: false,
            npc: false,
            'npc-end': false
        };
    }

    parse(path: string, name: string, channels: number, callback?: () => void) {
        const fullPath = `${path}${name}.${this.format}`;
        const sound = document.createElement('audio');

        function event() {
            sound.removeEventListener('canplaythrough', event, false);

            if (callback) callback();
        }
        sound.addEventListener('canplaythrough', event, false);

        sound.addEventListener(
            'error',
            () => {
                console.error(
                    `The audible: ${name} could not be loaded - unsupported extension?`
                );

                this.audibles[name] = null;
            },
            false
        );

        sound.preload = 'auto';
        sound.setAttribute('autobuffer', 'true');
        sound.src = fullPath;

        sound.load();

        this.audibles[name] = [sound];

        _.times(channels - 1, () => {
            this.audibles[name].push(sound.cloneNode(true) as HTMLAudioElement);
        });

        if (name in this.music) this.music[name] = true;
        else if (name in this.sounds) this.sounds[name] = true;
    }

    play(type: number, name: string) {
        if (
            !this.isEnabled() ||
            !this.fileExists(name) ||
            this.game.player.dead
        )
            return;

        if (Detect.isSafari()) return;

        switch (type) {
            case Modules.AudioTypes.Music: {
                this.fadeOut(this.song, () => {
                    this.reset(this.song);
                });

                const song = this.get(name);

                if (!song) return;

                song.volume = 0;

                song.play();

                this.fadeIn(song);

                this.song = song;

                break;
            }
            case Modules.AudioTypes.SFX: {
                if (!this.sounds[name]) this.parse('audio/sounds/', name, 4);

                const sound = this.get(name);

                if (!sound) return;

                sound.volume = this.getSFXVolume();

                sound.play();

                break;
            }
        }
    }

    update() {
        if (!this.isEnabled()) return;

        if (this.newSong === this.song.name) return;

        const song = this.getMusic(this.newSong);

        if (song && !(this.song && this.song.name === song.name)) {
            if (this.game.renderer.mobile) this.reset(this.song);
            else this.fadeSongOut();

            if (song.name in this.music && !this.music[song.name]) {
                this.parse('audio/music/', song.name, 1);

                const music = this.audibles[song.name][0];

                music.loop = true;
                music.addEventListener(
                    'ended',
                    () => {
                        music.play();
                    },
                    false
                );
            }

            this.play(Modules.AudioTypes.Music, song.name);
        } else if (this.game.renderer.mobile) this.reset(this.song);
        else this.fadeSongOut();

        this.songName = this.newSong;
    }

    fadeIn(song: Song) {
        if (!song || song.fadingIn) return;

        this.clearFadeOut(song);

        song.fadingIn = window.setTimeout(() => {
            song.volume += 0.02;

            if (song.volume >= this.getMusicVolume() - 0.02) {
                song.volume = this.getMusicVolume();
                this.clearFadeIn(song);
            }
        }, 100);
    }

    fadeOut(song: Song, callback: Function) {
        if (!song || song.fadingOut) return;

        this.clearFadeIn(song);

        song.fadingOut = window.setTimeout(() => {
            song.volume -= 0.08;

            if (song.volume <= 0.08) {
                song.volume = 0;

                if (callback) callback(song);

                clearInterval(song.fadingOut);
            }
        }, 100);
    }

    fadeSongOut() {
        if (!this.song) return;

        this.fadeOut(this.song, (song: Song) => {
            this.reset(song);
        });

        this.song = null;
    }

    clearFadeIn(song: { fadingIn: number }) {
        if (song.fadingIn) {
            clearInterval(song.fadingIn);
            song.fadingIn = null;
        }
    }

    clearFadeOut(song: Song) {
        if (song.fadingOut) {
            clearInterval(song.fadingOut);
            song.fadingOut = null;
        }
    }

    reset(song: Song) {
        if (!song || !(song.readyState > 0)) return;

        song.pause();
        song.currentTime = 0;
    }

    stop() {
        if (!this.song) return;

        this.fadeOut(this.song, () => {
            this.reset(this.song);
            this.song = null;
        });
    }

    fileExists(name: string) {
        return name in this.music || name in this.sounds;
    }

    get(name: string): Song {
        if (!this.audibles[name]) return null;

        let song = _.find(this.audibles[name], (audible) => {
            return audible.ended || audible.paused;
        });

        if (song && song.ended) song.currentTime = 0;
        else [song] = this.audibles[name];

        return song as Song;
    }

    getMusic(name: string) {
        return {
            sound: this.get(name),
            name
        };
    }

    setSongVolume(volume: number) {
        this.song.volume = volume;
    }

    getSFXVolume() {
        return this.game.storage.data.settings.sfx / 100;
    }

    getMusicVolume() {
        return this.game.storage.data.settings.music / 100;
    }

    isEnabled() {
        return this.game.storage.data.settings.soundEnabled && this.enabled;
    }
}
