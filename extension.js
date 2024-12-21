import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

export default class ObsStatus extends Extension {
    constructor(metadata) {
        super(metadata);
        this._settings=this.getSettings();
        this.abbreviatedLabels=this._settings.get_boolean('abbreviated-labels');
    }
    _indicatorDestroy(){
        if (this._indicator) {
            log("Destroying Obs button...");
            this._indicator.destroy();
            this._indicator = null;
        }
    }
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

    _drawObsTopBarPanel(recordingStatus,streamingStatus) {
        let statusText = "Idle"; 
        if (recordingStatus && streamingStatus) {
            statusText = this.abbreviatedLabels? "Str & Rec":"Streaming & Recording";
            } else if (recordingStatus) {
                statusText = this.abbreviatedLabels? "Rec":"Recording";
            } else if (streamingStatus) {
                    statusText = this.abbreviatedLabels?"Str":"Streaming";
            }
            if(!this._indicator){
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
                    text: statusText,
                    y_align: Clutter.ActorAlign.CENTER,
                    y_expand: true
                });

                boxContainer.add_child(obsIcon);
                boxContainer.add_child(this.streamingStatusLabel);
                this._indicator.add_child(boxContainer);

                Main.panel.addToStatusArea(this.uuid, this._indicator);
                log('Obs button added to the panel...');
            }
            else{
                this.streamingStatusLabel.text=statusText;
            }
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
            //Obtain ports being Used by OBS
            const checkStreamingStatus = Gio.Subprocess.new(['sh','-c','netstat -anp | grep obs | grep ESTABLISHED'], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            const [stdout, stderr] = await checkStreamingStatus.communicate_utf8_async(null, null);
    
            if (checkStreamingStatus.get_successful()) {
                    const sentDataSize = stdout.split(/\s+/).slice(2);
                    for(let x=0;x<sentDataSize.length;x+=7){
                        //Check if there is any data being sent through ports
                        const isdataBeingSent=sentDataSize.some(dataBytes=>dataBytes>0);
                        if(isdataBeingSent){
                            log("Obs is Streaming...")
                            return true;
                        }
                    }
            }
        } catch (e) {
            logError(e);
        }
        return false;
    }

    async _obsStatusMonitor() {
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, async () => {
            if(!this.isDisabled){
            if (this._isObsRunning()) {
                const recordingStatus = await this._isObsRecording();
                const streamingStatus = await this._isObsStreaming();
                this._drawObsTopBarPanel(recordingStatus,streamingStatus);
                } else {
                    this._indicatorDestroy();
                }
                return true;
            }
            else{
                return false;
            }
        });
    }
    enable() {
        this.isDisabled=false;
        this._settings.connect('changed::abbreviated-labels', () => {
            this.abbreviatedLabels=this._settings.get_boolean('abbreviated-labels');
        });
        this._obsStatusMonitor();
    }

    disable() {
        this._indicatorDestroy();
        this.isDisabled=true;
    }
}
