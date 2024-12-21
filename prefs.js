import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export default class ObsStatusPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'Appearance',
            description: 'Configure the appearance of the extension',
        });
        page.add(group);
        const row = new Adw.SwitchRow({
            title: 'Status Label Abbreviation',
            subtitle: 'Whether to use abbreviated labels like "Rec" instead of "Recording"',
        });
        group.add(row);
        window._settings = this.getSettings();
        window._settings.bind('abbreviated-labels', row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
    }
}