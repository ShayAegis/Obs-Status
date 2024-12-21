import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

export default class ObsStatus extends Extension {
    _isObsRunning() {
        let windowActors = global.get_window_actors();
        for (let actor of windowActors) {
            let window = actor.get_meta_window();
            let wmClass = window.get_wm_class();
    
            if (Array.isArray(wmClass)) {
                if (wmClass.some(cls => cls.toLowerCase().includes('obs'))) {
                    return true;
                }
            } else if (typeof wmClass === 'string' && wmClass.toLowerCase().includes('obs')) {
                return true;
            }
        }
        return false;
    }

    _drawObsTopBarPanel(status) {
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        let boxContainer = new St.BoxLayout({
            vertical: false,
            style_class: "container"
        });

        let obsIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(`${this.path}/icons/icons-obs-250.svg`),
            icon_size: 20,
            style_class: "obs-icon"
        });

        this.streamingStatusLabel = new St.Label({
            text: status,
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true
        });

        boxContainer.add_child(obsIcon);
        boxContainer.add_child(this.streamingStatusLabel);
        this._indicator.add_child(boxContainer);

        Main.panel.addToStatusArea(this.uuid, this._indicator);
        log('Obs button added to the panel...');
    }

    async _isObsRecording() {
        try {
            const checkRecordingStatus = Gio.Subprocess.new(['pgrep', '-x', 'obs-ffmpeg-mux'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

            const [stdout, stderr] = await checkRecordingStatus.communicate_utf8_async(null, null);
            if (checkRecordingStatus.get_successful()) {
                if (stdout.length > 0) {
                    log("Obs is recording...");
                    return true;
                }
            } else {
                return false;
            }
        } catch (e) {
            logError(e);
        }
        return false;
    }
    async _isObsStreaming() {
        try {
            const checkStreamingStatus = Gio.Subprocess.new(['sh','-c','netstat -anp | grep obs | grep ESTABLISHED'], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            const [stdout, stderr] = await checkStreamingStatus.communicate_utf8_async(null, null);
    
            if (checkStreamingStatus.get_successful()) {
                    const sentDataSize = stdout.split(/\s+/).filter(Boolean)[2];
                    if(sentDataSize>0){
                        log("Obs is Streaming...")
                        return true;
                    }
            }
        } catch (e) {
            logError(e);
        }
        return false;
    }

async _obsStatusMonitor() {
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, async () => {
        if (this._isObsRunning()) {
            const recordingStatus = await this._isObsRecording();
            const streamingStatus = await this._isObsStreaming();
            let statusText = "Idle"; 

            if (recordingStatus && streamingStatus) {
                statusText = "Streaming & Recording";
            } else if (recordingStatus) {
                statusText = "Recording";
            } else if (streamingStatus) {
                statusText = "Streaming";
            }

            if (!this._indicator) {
                this._drawObsTopBarPanel(statusText);
            } else {
                if (this.streamingStatusLabel) {
                    this.streamingStatusLabel.text = statusText;
                }
            }
        } else {
            // Si OBS no está corriendo, destruir el indicador
            if (this._indicator) {
                this._indicator.destroy();
                this._indicator = null;
            }
        }
        return true; // Keep the monitor working
    });
}

    enable() {
        this._obsStatusMonitor();
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
