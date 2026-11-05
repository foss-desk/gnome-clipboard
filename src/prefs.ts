import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Settings from './settings.js';

export default class GnomeClipboardPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: Adw.PreferencesWindow) {
        this._loadPreferencesStyle();

        const settings = this.getSettings(Settings.SCHEMA_ID);

        const page = new Adw.PreferencesPage();
        page.add_css_class('prefs-page');
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: this.gettext('Preferences'),
        });
        page.add(group);

        // History Size
        const historySizeRow = new Adw.ActionRow({
            title: this.gettext('Maximum size of history:'),
        });
        const historySizeSpin = new Gtk.SpinButton({
            valign: Gtk.Align.CENTER,
            css_classes: ['pref-input'],
            adjustment: new Gtk.Adjustment({
                lower: 2,
                upper: 1000,
                step_increment: 1,
            }),
        });
        settings.bind(
            Settings.HISTORY_SIZE,
            historySizeSpin,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );
        historySizeRow.add_suffix(historySizeSpin);
        group.add(historySizeRow);

        // Clipboard Timer
        const timerRow = new Adw.ActionRow({
            title: this.gettext('Read clipboard by timer:'),
        });
        const timerSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            css_classes: ['service-switch'],
        });
        settings.bind(
            Settings.CLIPBOARD_TIMER,
            timerSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT,
        );
        timerRow.add_suffix(timerSwitch);
        group.add(timerRow);

        // Timer Interval
        const intervalRow = new Adw.ActionRow({
            title: this.gettext('Timer interval (Millisecond):'),
        });
        const intervalSpin = new Gtk.SpinButton({
            valign: Gtk.Align.CENTER,
            css_classes: ['pref-input'],
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 100000,
                step_increment: 100,
            }),
        });
        settings.bind(
            Settings.TIMER_INTERVAL,
            intervalSpin,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );
        intervalRow.add_suffix(intervalSpin);
        group.add(intervalRow);

        // Save Pinned Only
        const savePinnedRow = new Adw.ActionRow({
            title: this.gettext('Save only pinned items:'),
        });
        const savePinnedSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            css_classes: ['service-switch'],
        });
        settings.bind(
            Settings.SAVE_PINNED,
            savePinnedSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT,
        );
        savePinnedRow.add_suffix(savePinnedSwitch);
        group.add(savePinnedRow);

        // Show Notifications
        const notificationsRow = new Adw.ActionRow({
            title: this.gettext('Show notifications'),
        });
        const notificationsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            css_classes: ['service-switch'],
        });
        settings.bind(
            Settings.SHOW_NOTIFICATIONS,
            notificationsSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT,
        );
        notificationsRow.add_suffix(notificationsSwitch);
        group.add(notificationsRow);

        // Open Data Folder
        const dataFolderRow = new Adw.ActionRow({
            title: this.gettext('Data folder'),
            subtitle: this.gettext('Open the folder where clipboard history is stored'),
        });
        const openDataFolderButton = new Gtk.Button({
            label: this.gettext('Open'),
            valign: Gtk.Align.CENTER,
            css_classes: ['pref-input'],
        });
        openDataFolderButton.connect('clicked', () => {
            const folderPath = GLib.build_filenamev([GLib.get_user_data_dir(), this.uuid]);
            const folderUri = Gio.File.new_for_path(folderPath).get_uri();
            Gtk.show_uri(window, folderUri, Gdk.CURRENT_TIME);
        });
        dataFolderRow.add_suffix(openDataFolderButton);
        dataFolderRow.set_activatable_widget(openDataFolderButton);
        group.add(dataFolderRow);

        // Images Group
        const imagesGroup = new Adw.PreferencesGroup({
            title: this.gettext('Images'),
        });
        page.add(imagesGroup);

        // Store Images
        const storeImagesRow = new Adw.ActionRow({
            title: this.gettext('Store images:'),
            subtitle: this.gettext('Save images copied to the clipboard in the history'),
        });
        const storeImagesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            css_classes: ['service-switch'],
        });
        settings.bind(
            Settings.STORE_IMAGES,
            storeImagesSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT,
        );
        storeImagesRow.add_suffix(storeImagesSwitch);
        storeImagesRow.set_activatable_widget(storeImagesSwitch);
        imagesGroup.add(storeImagesRow);

        // Maximum Image Size
        const maxImageSizeRow = new Adw.ActionRow({
            title: this.gettext('Maximum image size (MB):'),
            subtitle: this.gettext('Ignore images larger than this size'),
        });
        const maxImageSizeSpin = new Gtk.SpinButton({
            valign: Gtk.Align.CENTER,
            css_classes: ['pref-input'],
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 1024,
                step_increment: 1,
            }),
        });
        settings.bind(
            Settings.MAX_IMAGE_SIZE,
            maxImageSizeSpin,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );
        maxImageSizeRow.add_suffix(maxImageSizeSpin);
        maxImageSizeRow.set_activatable_widget(maxImageSizeSpin);
        imagesGroup.add(maxImageSizeRow);

        // Privacy Group
        const privacyGroup = new Adw.PreferencesGroup({
            title: this.gettext('Privacy'),
        });
        page.add(privacyGroup);

        // Blacklist
        const blacklistRow = new Adw.EntryRow({
            title: this.gettext('Blacklisted App IDs'),
            css_classes: ['pref-input'],
        });

        const blacklistSettings = settings.get_strv(Settings.BLACKLIST).join(', ');
        blacklistRow.set_text(blacklistSettings);
        blacklistRow.connect('changed', () => {
            const list = blacklistRow
                .get_text()
                .split(',')
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0);
            settings.set_strv(Settings.BLACKLIST, list);
        });
        privacyGroup.add(blacklistRow);

        // Shortcuts Group
        const shortcutGroup = new Adw.PreferencesGroup({
            title: this.gettext('Keyboard Shortcuts'),
            description: this.gettext('Use formats like <Super>v, <Control><Alt>c, etc.'),
        });
        page.add(shortcutGroup);

        const addShortcutRow = (key: string, title: string) => {
            shortcutGroup.add(this._createShortcutRow(settings, key, title));
        };

        addShortcutRow(Settings.SHORTCUT_MENU, this.gettext('Toggle History Menu'));
        addShortcutRow(Settings.SHORTCUT_CLEAR, this.gettext('Clear History'));
        addShortcutRow(Settings.SHORTCUT_NEXT, this.gettext('Select Next Item'));
        addShortcutRow(Settings.SHORTCUT_PREV, this.gettext('Select Previous Item'));
    }

    private _loadPreferencesStyle(): void {
        try {
            const cssPath = this.dir.get_child('stylesheet.css').get_path();
            const provider = new Gtk.CssProvider();
            provider.load_from_path(cssPath);

            const display = Gdk.Display.get_default();
            if (display) {
                Gtk.StyleContext.add_provider_for_display(
                    display,
                    provider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
                );
            }
        } catch (error) {
            console.error('Failed to load preferences stylesheet:', error);
        }
    }

    private _createShortcutRow(settings: Gio.Settings, key: string, title: string): Adw.ActionRow {
        const row = new Adw.ActionRow({ title });

        const button = new Gtk.Button({
            valign: Gtk.Align.CENTER,
            has_frame: true,
            css_classes: ['pref-input'],
        });
        row.add_suffix(button);

        const updateButtonLabel = () => {
            const val = settings.get_strv(key);
            button.set_label(val.length > 0 ? val[0] : this.gettext('None'));
        };
        updateButtonLabel();

        const controller = new Gtk.EventControllerKey();
        button.add_controller(controller);

        let isRecording = false;

        button.connect('clicked', () => {
            isRecording = true;
            button.set_label(this.gettext('New shortcut...'));
            button.add_css_class('suggested-action');
        });

        controller.connect(
            'key-pressed',
            (_controller: any, keyval: any, _keycode: any, state: any) => {
                if (!isRecording) return false;

                // Handle Escape to cancel
                if (keyval === Gdk.KEY_Escape) {
                    isRecording = false;
                    button.remove_css_class('suggested-action');
                    updateButtonLabel();
                    return true;
                }

                // Handle Backspace to clear
                if (keyval === Gdk.KEY_BackSpace) {
                    isRecording = false;
                    button.remove_css_class('suggested-action');
                    settings.set_strv(key, []);
                    updateButtonLabel();
                    return true;
                }

                // Mask out unwanted modifiers (like NumLock)
                const mask = state & Gtk.accelerator_get_default_mod_mask();

                // Only accept if at least one modifier is pressed OR it's a function key
                const isModifier = [
                    Gdk.KEY_Shift_L,
                    Gdk.KEY_Shift_R,
                    Gdk.KEY_Control_L,
                    Gdk.KEY_Control_R,
                    Gdk.KEY_Alt_L,
                    Gdk.KEY_Alt_R,
                    Gdk.KEY_Meta_L,
                    Gdk.KEY_Meta_R,
                    Gdk.KEY_Super_L,
                    Gdk.KEY_Super_R,
                ].includes(keyval);

                if (isModifier) return true;

                const accel = Gtk.accelerator_name(keyval, mask);
                if (accel) {
                    settings.set_strv(key, [accel]);
                    isRecording = false;
                    button.remove_css_class('suggested-action');
                    updateButtonLabel();
                    return true;
                }

                return false;
            },
        );

        // Reset state if focus is lost
        button.connect('state-flags-changed', () => {
            if (isRecording && !button.has_focus) {
                isRecording = false;
                button.remove_css_class('suggested-action');
                updateButtonLabel();
            }
        });

        return row;
    }
}
